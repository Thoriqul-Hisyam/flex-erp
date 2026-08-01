"use server";

import { db, schema } from "@/db";
import { eq, sql, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { processOpnameAdjustment, type MovementContext } from "@/lib/inventory/stock-engine";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface StockOpnameRow {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  warehouseName: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ADJUSTED" | "CANCELLED";
  notes?: string | null;
  totalItems: number;
  totalDiscrepancies: number;
  totalVarianceCost: number;
  createdByName?: string | null;
  adjustedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameItemRow {
  id: string;
  opnameId: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  batchNo?: string | null;
  systemQty: number;
  physicalQty: number | null;
  varianceQty: number;
  unitCost: number;
  varianceCost: number;
  notes?: string | null;
}

function num(val: unknown): number {
  return Number(val || 0);
}

/**
 * Fetch list of stock opname sessions
 */
export async function fetchStockOpnamesAction(warehouseIdFilter?: string): Promise<ActionResult<StockOpnameRow[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const companyId = user.companyId;

    const opnames = await db
      .select({
        id: schema.stockOpnames.id,
        opnameNumber: schema.stockOpnames.opnameNumber,
        warehouseId: schema.stockOpnames.warehouseId,
        warehouseName: schema.warehouses.name,
        status: schema.stockOpnames.status,
        notes: schema.stockOpnames.notes,
        createdById: schema.stockOpnames.createdById,
        adjustedById: schema.stockOpnames.adjustedById,
        createdAt: schema.stockOpnames.createdAt,
        updatedAt: schema.stockOpnames.updatedAt,
      })
      .from(schema.stockOpnames)
      .leftJoin(schema.warehouses, eq(schema.stockOpnames.warehouseId, schema.warehouses.id))
      .where(
        warehouseIdFilter && warehouseIdFilter !== "ALL"
          ? sql`${schema.stockOpnames.companyId} = ${companyId} AND ${schema.stockOpnames.warehouseId} = ${warehouseIdFilter}`
          : sql`${schema.stockOpnames.companyId} = ${companyId}`
      )
      .orderBy(desc(schema.stockOpnames.createdAt));

    const result: StockOpnameRow[] = [];

    for (const op of opnames) {
      const items = await db
        .select({
          varianceQty: schema.stockOpnameItems.varianceQty,
          varianceCost: schema.stockOpnameItems.varianceCost,
        })
        .from(schema.stockOpnameItems)
        .where(eq(schema.stockOpnameItems.opnameId, op.id));

      const totalItems = items.length;
      const totalDiscrepancies = items.filter((i) => num(i.varianceQty) !== 0).length;
      const totalVarianceCost = items.reduce((acc, i) => acc + num(i.varianceCost), 0);

      let createdByName = "System";
      if (op.createdById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, op.createdById));
        if (u) createdByName = u.name;
      }

      let adjustedByName = null;
      if (op.adjustedById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, op.adjustedById));
        if (u) adjustedByName = u.name;
      }

      result.push({
        id: op.id,
        opnameNumber: op.opnameNumber,
        warehouseId: op.warehouseId,
        warehouseName: op.warehouseName || "Unknown Warehouse",
        status: op.status,
        notes: op.notes,
        totalItems,
        totalDiscrepancies,
        totalVarianceCost,
        createdByName,
        adjustedByName,
        createdAt: op.createdAt ? new Date(op.createdAt).toISOString() : "",
        updatedAt: op.updatedAt ? new Date(op.updatedAt).toISOString() : "",
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("fetchStockOpnamesAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil data Stock Opname." };
  }
}

/**
 * Fetch single Stock Opname detail header & items
 */
export async function fetchStockOpnameDetailAction(
  opnameId: string
): Promise<ActionResult<{ header: StockOpnameRow; items: StockOpnameItemRow[] }>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const companyId = user.companyId;

    const [op] = await db
      .select({
        id: schema.stockOpnames.id,
        opnameNumber: schema.stockOpnames.opnameNumber,
        warehouseId: schema.stockOpnames.warehouseId,
        warehouseName: schema.warehouses.name,
        status: schema.stockOpnames.status,
        notes: schema.stockOpnames.notes,
        createdById: schema.stockOpnames.createdById,
        adjustedById: schema.stockOpnames.adjustedById,
        createdAt: schema.stockOpnames.createdAt,
        updatedAt: schema.stockOpnames.updatedAt,
      })
      .from(schema.stockOpnames)
      .leftJoin(schema.warehouses, eq(schema.stockOpnames.warehouseId, schema.warehouses.id))
      .where(
        sql`${schema.stockOpnames.id} = ${opnameId} AND ${schema.stockOpnames.companyId} = ${companyId}`
      );

    if (!op) return { success: false, message: "Stock Opname tidak ditemukan." };

    const rawItems = await db
      .select({
        id: schema.stockOpnameItems.id,
        opnameId: schema.stockOpnameItems.opnameId,
        productId: schema.stockOpnameItems.productId,
        productName: schema.products.name,
        productSku: schema.products.sku,
        productUnit: schema.products.unit,
        batchNo: schema.stockOpnameItems.batchNo,
        systemQty: schema.stockOpnameItems.systemQty,
        physicalQty: schema.stockOpnameItems.physicalQty,
        varianceQty: schema.stockOpnameItems.varianceQty,
        unitCost: schema.stockOpnameItems.unitCost,
        varianceCost: schema.stockOpnameItems.varianceCost,
        notes: schema.stockOpnameItems.notes,
      })
      .from(schema.stockOpnameItems)
      .leftJoin(schema.products, eq(schema.stockOpnameItems.productId, schema.products.id))
      .where(eq(schema.stockOpnameItems.opnameId, opnameId));

    const items: StockOpnameItemRow[] = rawItems.map((item) => ({
      id: item.id,
      opnameId: item.opnameId,
      productId: item.productId,
      productName: item.productName || "Unknown Product",
      productSku: item.productSku || "-",
      unit: item.productUnit || "Pcs",
      batchNo: item.batchNo,
      systemQty: num(item.systemQty),
      physicalQty: item.physicalQty !== null ? num(item.physicalQty) : null,
      varianceQty: num(item.varianceQty),
      unitCost: num(item.unitCost),
      varianceCost: num(item.varianceCost),
      notes: item.notes,
    }));

    const totalItems = items.length;
    const totalDiscrepancies = items.filter((i) => i.varianceQty !== 0).length;
    const totalVarianceCost = items.reduce((acc, i) => acc + i.varianceCost, 0);

    let createdByName = "System";
    if (op.createdById) {
      const [u] = await db
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, op.createdById));
      if (u) createdByName = u.name;
    }

    let adjustedByName = null;
    if (op.adjustedById) {
      const [u] = await db
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, op.adjustedById));
      if (u) adjustedByName = u.name;
    }

    const header: StockOpnameRow = {
      id: op.id,
      opnameNumber: op.opnameNumber,
      warehouseId: op.warehouseId,
      warehouseName: op.warehouseName || "Unknown Warehouse",
      status: op.status,
      notes: op.notes,
      totalItems,
      totalDiscrepancies,
      totalVarianceCost,
      createdByName,
      adjustedByName,
      createdAt: op.createdAt ? new Date(op.createdAt).toISOString() : "",
      updatedAt: op.updatedAt ? new Date(op.updatedAt).toISOString() : "",
    };

    return { success: true, data: { header, items } };
  } catch (error: any) {
    console.error("fetchStockOpnameDetailAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil detail Stock Opname." };
  }
}

/**
 * Create a new Stock Opname session and auto-snapshot items from warehouseStocks.
 */
export async function createStockOpnameAction(params: {
  warehouseId: string;
  notes?: string;
}): Promise<ActionResult<{ id: string; opnameNumber: string }>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.warehouseId) {
      return { success: false, message: "Gudang wajib dipilih." };
    }

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastOp] = await db
      .select({ opnameNumber: schema.stockOpnames.opnameNumber })
      .from(schema.stockOpnames)
      .where(sql`${schema.stockOpnames.companyId} = ${companyId}`)
      .orderBy(desc(schema.stockOpnames.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastOp?.opnameNumber) {
      const parts = lastOp.opnameNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const opnameNumber = `OPN-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    const stocks = await db
      .select({
        productId: schema.warehouseStocks.productId,
        qtyOnHand: schema.warehouseStocks.qtyOnHand,
        avgCost: schema.warehouseStocks.avgCost,
      })
      .from(schema.warehouseStocks)
      .where(
        sql`${schema.warehouseStocks.companyId} = ${companyId} AND ${schema.warehouseStocks.warehouseId} = ${params.warehouseId}`
      );

    let itemsToInsert = stocks.map((s) => ({
      productId: s.productId,
      systemQty: s.qtyOnHand || "0",
      unitCost: s.avgCost || "0",
    }));

    if (itemsToInsert.length === 0) {
      const prods = await db
        .select({ id: schema.products.id, costPrice: schema.products.costPrice })
        .from(schema.products)
        .where(eq(schema.products.companyId, companyId));
      itemsToInsert = prods.map((p) => ({
        productId: p.id,
        systemQty: "0",
        unitCost: p.costPrice || "0",
      }));
    }

    const newOpname = await db.transaction(async (tx) => {
      const [op] = await tx
        .insert(schema.stockOpnames)
        .values({
          tenantId,
          companyId,
          opnameNumber,
          warehouseId: params.warehouseId,
          status: "DRAFT",
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      if (itemsToInsert.length > 0) {
        await tx.insert(schema.stockOpnameItems).values(
          itemsToInsert.map((item) => ({
            tenantId,
            companyId,
            opnameId: op.id,
            productId: item.productId,
            systemQty: item.systemQty,
            physicalQty: null,
            varianceQty: "0",
            unitCost: item.unitCost,
            varianceCost: "0",
          }))
        );
      }

      return op;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "StockOpname",
      entityId: newOpname.id,
    });

    revalidatePath("/inventory/opnames");
    return {
      success: true,
      message: `Sesi Stock Opname ${opnameNumber} berhasil dibuat dengan ${itemsToInsert.length} SKU.`,
      data: { id: newOpname.id, opnameNumber },
    };
  } catch (error: any) {
    console.error("createStockOpnameAction Error:", error);
    return { success: false, message: error.message || "Gagal membuat sesi Stock Opname." };
  }
}

/**
 * Update physical counts for items in a Stock Opname session.
 */
export async function updatePhysicalCountAction(params: {
  opnameId: string;
  items: Array<{
    id: string;
    physicalQty: number | null;
    notes?: string;
  }>;
}): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const companyId = user.companyId;

    const [opname] = await db
      .select()
      .from(schema.stockOpnames)
      .where(
        sql`${schema.stockOpnames.id} = ${params.opnameId} AND ${schema.stockOpnames.companyId} = ${companyId}`
      );

    if (!opname) return { success: false, message: "Stock Opname tidak ditemukan." };
    if (opname.status === "ADJUSTED" || opname.status === "CANCELLED") {
      return { success: false, message: `Tidak dapat mengubah opname dengan status ${opname.status}.` };
    }

    await db.transaction(async (tx) => {
      for (const itemInput of params.items) {
        const [existing] = await tx
          .select()
          .from(schema.stockOpnameItems)
          .where(eq(schema.stockOpnameItems.id, itemInput.id));

        if (!existing) continue;

        const systemQty = num(existing.systemQty);
        const physicalQty = itemInput.physicalQty !== null ? num(itemInput.physicalQty) : null;
        const varianceQty = physicalQty !== null ? physicalQty - systemQty : 0;
        const unitCost = num(existing.unitCost);
        const varianceCost = varianceQty * unitCost;

        await tx
          .update(schema.stockOpnameItems)
          .set({
            physicalQty: physicalQty !== null ? String(physicalQty) : null,
            varianceQty: String(varianceQty),
            varianceCost: String(varianceCost),
            notes: itemInput.notes || null,
            updatedAt: new Date(),
          })
          .where(eq(schema.stockOpnameItems.id, itemInput.id));
      }

      if (opname.status === "DRAFT") {
        await tx
          .update(schema.stockOpnames)
          .set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(eq(schema.stockOpnames.id, params.opnameId));
      }
    });

    revalidatePath(`/inventory/opnames/${params.opnameId}`);
    return { success: true, message: "Hasil perhitungan fisik berhasil disimpan." };
  } catch (error: any) {
    console.error("updatePhysicalCountAction Error:", error);
    return { success: false, message: error.message || "Gagal menyimpan perhitungan fisik." };
  }
}

/**
 * Complete physical count phase and mark status as COMPLETED.
 */
export async function completeOpnameAction(opnameId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const companyId = user.companyId;

    const [opname] = await db
      .select()
      .from(schema.stockOpnames)
      .where(
        sql`${schema.stockOpnames.id} = ${opnameId} AND ${schema.stockOpnames.companyId} = ${companyId}`
      );

    if (!opname) return { success: false, message: "Stock Opname tidak ditemukan." };
    if (opname.status === "ADJUSTED" || opname.status === "CANCELLED") {
      return { success: false, message: `Opname ini berstatus ${opname.status}.` };
    }

    await db
      .update(schema.stockOpnames)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(schema.stockOpnames.id, opnameId));

    revalidatePath("/inventory/opnames");
    revalidatePath(`/inventory/opnames/${opnameId}`);
    return { success: true, message: "Perhitungan Stock Opname telah ditandai Selesai." };
  } catch (error: any) {
    console.error("completeOpnameAction Error:", error);
    return { success: false, message: error.message || "Gagal menyelesaikan Stock Opname." };
  }
}

/**
 * Execute final Stock Adjustment on ledger for all items with varianceQty !== 0.
 */
export async function adjustOpnameAction(opnameId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const ctx: MovementContext = {
      tenantId,
      companyId,
      userId: user.id,
      refType: "STOCK_OPNAME",
      refId: opnameId,
    };

    const result = await processOpnameAdjustment(ctx, opnameId);

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "POST",
      entity: "StockOpname",
      entityId: opnameId,
    });

    revalidatePath("/inventory/opnames");
    revalidatePath(`/inventory/opnames/${opnameId}`);
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return {
      success: true,
      message: `Penyesuaian stok berhasil diposting. Total ${result.adjustedCount} SKU ter-update di ledger gudang.`,
    };
  } catch (error: any) {
    console.error("adjustOpnameAction Error:", error);
    return { success: false, message: error.message || "Gagal memposting penyesuaian Stock Opname." };
  }
}

/**
 * Cancel a Stock Opname session
 */
export async function cancelOpnameAction(opnameId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized: mohon login kembali." };
    }
    const companyId = user.companyId;

    const [opname] = await db
      .select()
      .from(schema.stockOpnames)
      .where(
        sql`${schema.stockOpnames.id} = ${opnameId} AND ${schema.stockOpnames.companyId} = ${companyId}`
      );

    if (!opname) return { success: false, message: "Stock Opname tidak ditemukan." };
    if (opname.status === "ADJUSTED") {
      return { success: false, message: "Opname yang sudah di-adjust tidak dapat dibatalkan." };
    }

    await db
      .update(schema.stockOpnames)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(schema.stockOpnames.id, opnameId));

    revalidatePath("/inventory/opnames");
    return { success: true, message: "Sesi Stock Opname berhasil dibatalkan." };
  } catch (error: any) {
    console.error("cancelOpnameAction Error:", error);
    return { success: false, message: error.message || "Gagal membatalkan Stock Opname." };
  }
}
