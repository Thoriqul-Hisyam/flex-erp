import { db, schema } from "@/db";
import { eq, sql, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// Type of the transaction object passed inside `db.transaction(cb)` callbacks.
// Extracted directly from the db's `.transaction` signature so helpers can
// accept either the top-level db or an in-flight transaction.
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Core Stock Movement Engine
 * ---------------------------------------------------------------
 * Every stock operation flows through the functions below so that the
 * immutable `stock_movements` ledger is always written atomically alongside
 * the mutable `warehouse_stocks` balance (and optional `batches`).
 *
 * All mutations run inside a single DB transaction. This guarantees that a
 * movement can never leave the balance updated without its ledger entry (or
 * vice-versa).
 */

export interface MovementContext {
  tenantId: string;
  companyId: string;
  userId?: string | null;
  refType?: string;
  refId?: string;
  note?: string;
}

export interface MovementResult {
  movementId: string;
  productId: string;
  warehouseId: string;
  type: string;
  qty: number;
  beforeQty: number;
  afterQty: number;
  avgCost: number;
}

function num(value: unknown): number {
  return Number(value || 0);
}

/**
 * Returns the current running balance row (or null) for a product+warehouse.
 */
async function getStockRow(
  tx: TxClient,
  companyId: string,
  warehouseId: string,
  productId: string,
) {
  const [row] = await tx
    .select()
    .from(schema.warehouseStocks)
    .where(
      sql`${schema.warehouseStocks.companyId} = ${companyId}
          AND ${schema.warehouseStocks.warehouseId} = ${warehouseId}
          AND ${schema.warehouseStocks.productId} = ${productId}`,
    );
  return row ?? null;
}

/**
 * Creates the balance row if it doesn't exist yet, then returns it.
 */
async function ensureStockRow(
  tx: TxClient,
  ctx: MovementContext,
  warehouseId: string,
  productId: string,
  initialCost = 0,
) {
  let row = await getStockRow(tx, ctx.companyId, warehouseId, productId);
  if (!row) {
    const [created] = await tx
      .insert(schema.warehouseStocks)
      .values({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        warehouseId,
        productId,
        qtyOnHand: "0",
        qtyReserved: "0",
        qtyIncoming: "0",
        avgCost: String(initialCost),
      })
      .returning();
    row = created;
  }
  return row;
}

/**
 * Thread-safe single-row update of qtyOnHand for a product+warehouse.
 * Only applies when the stored qty still equals @param expectedQty.
 */
async function updateQty(
  tx: TxClient,
  companyId: string,
  warehouseId: string,
  productId: string,
  newQty: number,
  expectedQty: number,
): Promise<boolean> {
  const res = await tx
    .update(schema.warehouseStocks)
    .set({
      qtyOnHand: String(newQty),
      lastMovementAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      sql`${schema.warehouseStocks.companyId} = ${companyId}
          AND ${schema.warehouseStocks.warehouseId} = ${warehouseId}
          AND ${schema.warehouseStocks.productId} = ${productId}
          AND ${schema.warehouseStocks.qtyOnHand} = ${String(expectedQty)}`,
    );
  return res.rowCount === 1;
}

/**
 * Recomputes a batch's remaining qty and its status based on in/out totals.
 */
async function refreshBatchState(
  tx: TxClient,
  batchId: string | null | undefined,
) {
  if (!batchId) return;
  const [batch] = await tx
    .select()
    .from(schema.batches)
    .where(eq(schema.batches.id, batchId));
  if (!batch) return;

  const remaining = num(batch.qtyIn) - num(batch.qtyOut);
  let status: "OPEN" | "CONSUMED" | "EXPIRED" = "OPEN";
  if (batch.expiryDate && batch.expiryDate < new Date()) status = "EXPIRED";
  else if (remaining <= 0) status = "CONSUMED";

  await tx
    .update(schema.batches)
    .set({
      qtyRemaining: String(Math.max(remaining, 0)),
      status,
      updatedAt: new Date(),
    })
    .where(eq(schema.batches.id, batchId));
}

/**
 * Internal: posts a single movement and updates the matching warehouse balance.
 * @param direction +1 for increase (IN), -1 for decrease (OUT)
 */
async function applyMovement(
  tx: TxClient,
  ctx: MovementContext,
  opts: {
    type:
      | "STOCK_IN"
      | "STOCK_OUT"
      | "TRANSFER_IN"
      | "TRANSFER_OUT"
      | "ADJUSTMENT_ADD"
      | "ADJUSTMENT_SUBTRACT";
    productId: string;
    warehouseId: string;
    qty: number;
    unitCost?: number;
    batchId?: string | null;
    allowNegative?: boolean;
    warehouseLabel: string;
  },
): Promise<{
  movementId: string;
  beforeQty: number;
  afterQty: number;
  avgCost: number;
}> {
  const row = await ensureStockRow(
    tx,
    ctx,
    opts.warehouseId,
    opts.productId,
    opts.unitCost ?? 0,
  );

  const beforeQty = num(row.qtyOnHand);
  const sign =
    opts.type.endsWith("_OUT") || opts.type === "ADJUSTMENT_SUBTRACT" ? -1 : 1;
  let afterQty = beforeQty + sign * opts.qty;

  if (afterQty < 0 && !opts.allowNegative) {
    const [prod] = await tx
      .select({ name: schema.products.name, sku: schema.products.sku })
      .from(schema.products)
      .where(eq(schema.products.id, opts.productId));
    const [wh] = await tx
      .select({ name: schema.warehouses.name })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, opts.warehouseId));

    const prodLabel = prod ? `"${prod.name}" (${prod.sku || "-"})` : opts.productId;
    const whLabel = wh ? wh.name : opts.warehouseLabel;

    throw new Error(
      `Stok produk ${prodLabel} tidak mencukupi di ${whLabel}: Stok Fisik Tersedia = ${beforeQty}, Dibutuhkan = ${opts.qty}. (Silakan lakukan Penerimaan Barang PO atau Stock In terlebih dahulu).`,
    );
  }

  const ok = await updateQty(
    tx,
    ctx.companyId,
    opts.warehouseId,
    opts.productId,
    afterQty,
    beforeQty,
  );
  if (!ok) {
    throw new Error(
      "Konflik stok: saldo berubah saat transaksi (retry disarankan).",
    );
  }

  // Recompute average cost on IN movements using remaining qty weighted average.
  let avgCost = num(row.avgCost) || opts.unitCost || 0;
  if (sign > 0 && (opts.unitCost ?? 0) > 0) {
    const prevValue = avgCost * Math.max(beforeQty, 0);
    const inCost = opts.unitCost! * opts.qty;
    const newOnHand = Math.max(afterQty, 1);
    avgCost = parseFloat(((prevValue + inCost) / newOnHand).toFixed(2));
  }

  await tx
    .update(schema.warehouseStocks)
    .set({ avgCost: String(avgCost) })
    .where(
      sql`${schema.warehouseStocks.companyId} = ${ctx.companyId}
          AND ${schema.warehouseStocks.warehouseId} = ${opts.warehouseId}
          AND ${schema.warehouseStocks.productId} = ${opts.productId}`,
    );

  // Batch out/in qty tracking (best effort, uses provided batchId).
  if (opts.batchId) {
    if (sign > 0) {
      await tx
        .update(schema.batches)
        .set({
          qtyIn: sql`${schema.batches.qtyIn} + ${String(opts.qty)}`,
        })
        .where(eq(schema.batches.id, opts.batchId));
    } else {
      await tx
        .update(schema.batches)
        .set({
          qtyOut: sql`${schema.batches.qtyOut} + ${String(opts.qty)}`,
        })
        .where(eq(schema.batches.id, opts.batchId));
    }
    await refreshBatchState(tx, opts.batchId);
  }

  const [movement] = await tx
    .insert(schema.stockMovements)
    .values({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      type: opts.type,
      productId: opts.productId,
      warehouseId: opts.warehouseId,
      qty: String(opts.qty),
      unitCost: String(opts.unitCost ?? avgCost),
      beforeQty: String(beforeQty),
      afterQty: String(afterQty),
      batchId: opts.batchId ?? null,
      refType: ctx.refType ?? null,
      refId: ctx.refId ?? null,
      note: ctx.note ?? null,
      userId: ctx.userId ?? null,
    })
    .returning({ id: schema.stockMovements.id });

  return { movementId: movement.id, beforeQty, afterQty, avgCost };
}

/**
 * Stock adjustment (manual add/subtract). Best for stock opname corrections.
 */
export async function adjustStock(
  ctx: MovementContext,
  params: {
    productId: string;
    warehouseId: string;
    direction: "add" | "subtract";
    qty: number;
    unitCost?: number;
    reason?: string;
  },
): Promise<MovementResult> {
  if (params.qty <= 0) throw new Error("Qty harus > 0.");
  const type =
    params.direction === "add"
      ? ("ADJUSTMENT_ADD" as const)
      : ("ADJUSTMENT_SUBTRACT" as const);
  const allowNegative = type === "ADJUSTMENT_ADD"; // adding never negative

  return (await db.transaction(async (tx) => {
    const result = await applyMovement(tx, ctx, {
      type,
      productId: params.productId,
      warehouseId: params.warehouseId,
      qty: params.qty,
      unitCost: params.unitCost,
      allowNegative,
      warehouseLabel: "gudang",
    });
    return {
      movementId: result.movementId,
      productId: params.productId,
      warehouseId: params.warehouseId,
      type,
      qty: params.qty,
      beforeQty: result.beforeQty,
      afterQty: result.afterQty,
      avgCost: result.avgCost,
    };
  })) as MovementResult;
}

/**
 * Stock IN — receiving inventory into a warehouse (purchase receipt, return, etc).
 */
export async function receiveStock(
  ctx: MovementContext,
  params: {
    productId: string;
    warehouseId: string;
    qty: number;
    unitCost?: number;
    batch?: { batchNo: string; expiryDate?: Date } | null;
  },
): Promise<MovementResult> {
  if (params.qty <= 0) throw new Error("Qty harus > 0.");

  return (await db.transaction(async (tx) => {
    let batchId: string | null = null;
    if (params.batch) {
      if (!params.batch.batchNo) throw new Error("Batch number wajib diisi.");
      const [batch] = await tx
        .insert(schema.batches)
        .values({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          warehouseId: params.warehouseId,
          productId: params.productId,
          batchNo: params.batch.batchNo,
          expiryDate: params.batch.expiryDate ?? null,
          qtyIn: String(params.qty),
          qtyOut: "0",
          qtyRemaining: String(params.qty),
          costPrice: String(params.unitCost ?? 0),
        })
        .returning({ id: schema.batches.id });
      batchId = batch.id;
    }

    const result = await applyMovement(tx, ctx, {
      type: "STOCK_IN",
      productId: params.productId,
      warehouseId: params.warehouseId,
      qty: params.qty,
      unitCost: params.unitCost,
      batchId,
      warehouseLabel: "gudang tujuan",
    });

    return {
      movementId: result.movementId,
      productId: params.productId,
      warehouseId: params.warehouseId,
      type: "STOCK_IN",
      qty: params.qty,
      beforeQty: result.beforeQty,
      afterQty: result.afterQty,
      avgCost: result.avgCost,
    };
  })) as MovementResult;
}

/**
 * Stock OUT — issuing inventory out of a warehouse (sales delivery, usage, etc).
 */
export async function issueStock(
  ctx: MovementContext,
  params: {
    productId: string;
    warehouseId: string;
    qty: number;
    batchId?: string | null;
    batchNo?: string | null;
  },
): Promise<MovementResult> {
  if (params.qty <= 0) throw new Error("Qty harus > 0.");

  return (await db.transaction(async (tx) => {
    let resolvedBatchId = params.batchId || null;
    if (!resolvedBatchId && params.batchNo) {
      const [foundBatch] = await tx
        .select({ id: schema.batches.id })
        .from(schema.batches)
        .where(
          and(
            eq(schema.batches.companyId, ctx.companyId),
            eq(schema.batches.warehouseId, params.warehouseId),
            eq(schema.batches.productId, params.productId),
            eq(schema.batches.batchNo, params.batchNo)
          )
        )
        .limit(1);
      if (foundBatch) resolvedBatchId = foundBatch.id;
    }

    const result = await applyMovement(tx, ctx, {
      type: "STOCK_OUT",
      productId: params.productId,
      warehouseId: params.warehouseId,
      qty: params.qty,
      batchId: resolvedBatchId,
      warehouseLabel: "gudang asal",
    });
    return {
      movementId: result.movementId,
      productId: params.productId,
      warehouseId: params.warehouseId,
      type: "STOCK_OUT",
      qty: params.qty,
      beforeQty: result.beforeQty,
      afterQty: result.afterQty,
      avgCost: result.avgCost,
    };
  })) as MovementResult;
}

/**
 * Transfer stock between two warehouses. Posts a TRANSFER_OUT on source and a
 * TRANSFER_IN on destination within a single transaction.
 */
export async function transferStock(
  ctx: MovementContext,
  params: {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    qty: number;
  },
): Promise<{ out: MovementResult; in: MovementResult }> {
  if (params.qty <= 0) throw new Error("Qty harus > 0.");
  if (params.fromWarehouseId === params.toWarehouseId)
    throw new Error("Gudang asal dan tujuan tidak boleh sama.");

  return (await db.transaction(async (tx) => {
    const out = await applyMovement(tx, ctx, {
      type: "TRANSFER_OUT",
      productId: params.productId,
      warehouseId: params.fromWarehouseId,
      qty: params.qty,
      warehouseLabel: "gudang asal",
    });

    const inRes = await applyMovement(tx, ctx, {
      type: "TRANSFER_IN",
      productId: params.productId,
      warehouseId: params.toWarehouseId,
      qty: params.qty,
      unitCost: out.avgCost,
      warehouseLabel: "gudang tujuan",
    });

    // Record source/destination on the OUT ledger row for full audit trace.
    await tx
      .update(schema.stockMovements)
      .set({ toWarehouseId: params.toWarehouseId })
      .where(eq(schema.stockMovements.id, out.movementId));
    await tx
      .update(schema.stockMovements)
      .set({ fromWarehouseId: params.fromWarehouseId })
      .where(eq(schema.stockMovements.id, inRes.movementId));

    return {
      out: {
        movementId: out.movementId,
        productId: params.productId,
        warehouseId: params.fromWarehouseId,
        type: "TRANSFER_OUT",
        qty: params.qty,
        beforeQty: out.beforeQty,
        afterQty: out.afterQty,
        avgCost: out.avgCost,
      },
      in: {
        movementId: inRes.movementId,
        productId: params.productId,
        warehouseId: params.toWarehouseId,
        type: "TRANSFER_IN",
        qty: params.qty,
        beforeQty: inRes.beforeQty,
        afterQty: inRes.afterQty,
        avgCost: inRes.avgCost,
      },
    };
  })) as { out: MovementResult; in: MovementResult };
}

/**
 * Process Stock Opname adjustment:
 * Iterates through items in a Stock Opname session and posts adjustments for any varianceQty !== 0.
 */
export async function processOpnameAdjustment(
  ctx: MovementContext,
  opnameId: string,
): Promise<{ adjustedCount: number; opnameNumber: string }> {
  return (await db.transaction(async (tx) => {
    const [opname] = await tx
      .select()
      .from(schema.stockOpnames)
      .where(
        sql`${schema.stockOpnames.id} = ${opnameId} AND ${schema.stockOpnames.companyId} = ${ctx.companyId}`,
      );

    if (!opname) throw new Error("Sesi Stock Opname tidak ditemukan.");
    if (opname.status === "ADJUSTED")
      throw new Error("Sesi Stock Opname ini sudah diposting penyesuaiannya.");
    if (opname.status === "CANCELLED")
      throw new Error("Sesi Stock Opname ini telah dibatalkan.");

    const items = await tx
      .select()
      .from(schema.stockOpnameItems)
      .where(eq(schema.stockOpnameItems.opnameId, opnameId));

    let adjustedCount = 0;

    for (const item of items) {
      const variance = num(item.varianceQty);
      if (variance === 0) continue;

      const direction = variance > 0 ? "add" : "subtract";
      const absQty = Math.abs(variance);
      const unitCost = num(item.unitCost);

      const type =
        direction === "add" ? "ADJUSTMENT_ADD" : "ADJUSTMENT_SUBTRACT";

      await applyMovement(
        tx,
        {
          ...ctx,
          refType: "STOCK_OPNAME",
          refId: opnameId,
          note: `Stock Opname ${opname.opnameNumber}: ${item.notes || (direction === "add" ? "Selisih lebih opname" : "Selisih kurang opname")}`,
        },
        {
          type,
          productId: item.productId,
          warehouseId: opname.warehouseId,
          qty: absQty,
          unitCost,
          allowNegative: direction === "add",
          warehouseLabel: "gudang",
        },
      );

      adjustedCount++;
    }

    await tx
      .update(schema.stockOpnames)
      .set({
        status: "ADJUSTED",
        adjustedById: ctx.userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.stockOpnames.id, opnameId));

    return { adjustedCount, opnameNumber: opname.opnameNumber };
  })) as { adjustedCount: number; opnameNumber: string };
}

