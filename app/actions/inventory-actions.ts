"use server";

import { db, schema } from "@/db";
import { eq, sql, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  adjustStock,
  receiveStock,
  issueStock,
  transferStock,
  type MovementContext,
} from "@/lib/inventory/stock-engine";
import type { ActionResult } from "./crud-actions";

export interface WarehouseStockRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseType?: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyIncoming: number;
  qtyAvailable: number;
  avgCost: number;
  stockValue: number;
  reorderLevel: number;
  status: string;
  lastMovementAt?: string;
}

export interface StockMovementRow {
  id: string;
  type: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId?: string;
  warehouseName?: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  qty: number;
  unitCost: number;
  beforeQty: number;
  afterQty: number;
  batchNo?: string;
  refType?: string;
  refId?: string;
  note?: string;
  createdAt: string;
}

export interface BatchRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productSku: string;
  batchNo: string;
  expiryDate?: string;
  qtyIn: number;
  qtyOut: number;
  qtyRemaining: number;
  costPrice: number;
  status: string;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

async function resolveCompanyContext() {
  const user = await getSessionUser();
  if (!user) return null;

  let companyId = user.companyId;
  if (!companyId) {
    const [comp] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.tenantId, user.tenantId))
      .limit(1);
    companyId = comp?.id ?? null;
  }

  return { tenantId: user.tenantId, companyId, userId: user.id };
}

function toMovementCtx(ctx: {
  tenantId: string;
  companyId: string | null;
  userId: string;
}): MovementContext {
  return {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId ?? "",
    userId: ctx.userId,
  };
}

/**
 * Returns the enriched list of warehouse stocks for a given warehouse
 * (or all warehouses when none provided).
 */
export async function fetchWarehouseStocksAction(
  warehouseId?: string,
): Promise<ActionResult<WarehouseStockRow[]>> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const whereClause = sql`${schema.warehouseStocks.companyId} = ${ctx.companyId} ${
      warehouseId
        ? sql`AND ${schema.warehouseStocks.warehouseId} = ${warehouseId}`
        : sql``
    }`;

    const rows = await db
      .select()
      .from(schema.warehouseStocks)
      .where(whereClause);

    const [whList, prodList] = await Promise.all([
      db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.products)
        .where(eq(schema.products.companyId, ctx.companyId)),
    ]);
    const whMap = new Map(whList.map((w) => [w.id, w]));
    const prodMap = new Map(prodList.map((p) => [p.id, p]));

    const data: WarehouseStockRow[] = rows.map((r) => {
      const wh = whMap.get(r.warehouseId);
      const prod = prodMap.get(r.productId);
      const qtyOnHand = Number(r.qtyOnHand || 0);
      const avgCost = Number(r.avgCost || 0);
      return {
        id: r.id,
        warehouseId: r.warehouseId,
        warehouseName: wh?.name || wh?.code || "Unknown Warehouse",
        warehouseType: wh?.type || "COMMERCIAL",
        productId: r.productId,
        productName: prod?.name || "Unknown Product",
        productSku: prod?.sku || prod?.code || "-",
        unit: prod?.unit || "PCS",
        qtyOnHand,
        qtyReserved: Number(r.qtyReserved || 0),
        qtyIncoming: Number(r.qtyIncoming || 0),
        qtyAvailable: qtyOnHand - Number(r.qtyReserved || 0),
        avgCost,
        stockValue: qtyOnHand * avgCost,
        reorderLevel: Number(prod?.reorderLevel || 0),
        status: prod?.status || "ACTIVE",
        lastMovementAt: r.lastMovementAt
          ? new Date(r.lastMovementAt).toISOString()
          : undefined,
      };
    });

    return { success: true, data };
  } catch (err: any) {
    console.error("[fetchWarehouseStocksAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Failed to fetch stocks" };
  }
}

/**
 * Returns the stock movement ledger (stock_in / stock_out / etc), enriched.
 */
export async function fetchStockMovementsAction(opts?: {
  productId?: string;
  warehouseId?: string;
  limit?: number;
}): Promise<ActionResult<StockMovementRow[]>> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    let condition = sql`${schema.stockMovements.companyId} = ${ctx.companyId}`;
    if (opts?.productId)
      condition = sql`${condition} AND ${schema.stockMovements.productId} = ${opts.productId}`;
    if (opts?.warehouseId)
      condition = sql`${condition} AND (${schema.stockMovements.warehouseId} = ${opts.warehouseId} OR ${schema.stockMovements.fromWarehouseId} = ${opts.warehouseId} OR ${schema.stockMovements.toWarehouseId} = ${opts.warehouseId})`;

    const rows = await db
      .select()
      .from(schema.stockMovements)
      .where(condition)
      .orderBy(desc(schema.stockMovements.createdAt))
      .limit(opts?.limit ?? 200);

    const [prodList, whList, batchList] = await Promise.all([
      db
        .select()
        .from(schema.products)
        .where(eq(schema.products.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.batches)
        .where(eq(schema.batches.companyId, ctx.companyId)),
    ]);
    const prodMap = new Map(prodList.map((p) => [p.id, p]));
    const whMap = new Map(whList.map((w) => [w.id, w]));
    const batchMap = new Map(batchList.map((b) => [b.id, b]));

    const data: StockMovementRow[] = rows.map((r) => {
      const prod = prodMap.get(r.productId);
      return {
        id: r.id,
        type: r.type,
        productId: r.productId,
        productName: prod?.name || "Unknown Product",
        productSku: prod?.sku || prod?.code || "-",
        warehouseId: r.warehouseId || undefined,
        warehouseName: r.warehouseId
          ? whMap.get(r.warehouseId)?.name
          : undefined,
        fromWarehouseName: r.fromWarehouseId
          ? whMap.get(r.fromWarehouseId)?.name
          : undefined,
        toWarehouseName: r.toWarehouseId
          ? whMap.get(r.toWarehouseId)?.name
          : undefined,
        qty: Number(r.qty || 0),
        unitCost: Number(r.unitCost || 0),
        beforeQty: Number(r.beforeQty || 0),
        afterQty: Number(r.afterQty || 0),
        batchNo: r.batchId ? batchMap.get(r.batchId)?.batchNo : undefined,
        refType: r.refType || undefined,
        refId: r.refId || undefined,
        note: r.note || undefined,
        createdAt: new Date(r.createdAt ?? Date.now()).toISOString(),
      };
    });

    return { success: true, data };
  } catch (err: any) {
    console.error("[fetchStockMovementsAction] Error:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Failed to fetch movements",
    };
  }
}

/**
 * Adjusts stock (add/subtract) for stock opname corrections.
 */
export async function postAdjustmentAction(params: {
  productId: string;
  warehouseId: string;
  direction: "add" | "subtract";
  qty: number;
  unitCost?: number;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const result = await adjustStock(toMovementCtx(ctx), {
      productId: params.productId,
      warehouseId: params.warehouseId,
      direction: params.direction,
      qty: params.qty,
      unitCost: params.unitCost,
      reason: params.reason,
    });

    await logAuditEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "POST",
      entity: "Stock Adjustment",
      entityId: result.movementId,
      newPayload: { ...params, result },
    });

    return { success: true, data: result, message: "Adjustment recorded." };
  } catch (err: any) {
    console.error("[postAdjustmentAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Adjustment failed" };
  }
}

/**
 * Receives stock into a warehouse (purchase receipt / returns).
 */
export async function postStockInAction(params: {
  productId: string;
  warehouseId: string;
  qty: number;
  unitCost?: number;
  batchNo?: string;
  expiryDate?: string;
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const result = await receiveStock(
      {
        ...toMovementCtx(ctx),
        refType: params.refType,
        refId: params.refId,
        note: params.note,
      },
      {
        productId: params.productId,
        warehouseId: params.warehouseId,
        qty: params.qty,
        unitCost: params.unitCost,
        batch: params.batchNo
          ? {
              batchNo: params.batchNo,
              expiryDate: params.expiryDate
                ? new Date(params.expiryDate)
                : undefined,
            }
          : null,
      },
    );

    await logAuditEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "POST",
      entity: "Stock In",
      entityId: result.movementId,
      newPayload: { ...params, result },
    });

    return { success: true, data: result, message: "Stock received." };
  } catch (err: any) {
    console.error("[postStockInAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Stock IN failed" };
  }
}

/**
 * Issues stock out of a warehouse (sales delivery / usage).
 */
export async function postStockOutAction(params: {
  productId: string;
  warehouseId: string;
  qty: number;
  batchId?: string;
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const result = await issueStock(
      {
        ...toMovementCtx(ctx),
        refType: params.refType,
        refId: params.refId,
        note: params.note,
      },
      {
        productId: params.productId,
        warehouseId: params.warehouseId,
        qty: params.qty,
        batchId: params.batchId,
      },
    );

    await logAuditEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "POST",
      entity: "Stock Out",
      entityId: result.movementId,
      newPayload: { ...params, result },
    });

    return { success: true, data: result, message: "Stock issued." };
  } catch (err: any) {
    console.error("[postStockOutAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Stock OUT failed" };
  }
}

/**
 * Transfers stock between two warehouses.
 */
export async function postTransferAction(params: {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
  note?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const result = await transferStock(toMovementCtx(ctx), {
      productId: params.productId,
      fromWarehouseId: params.fromWarehouseId,
      toWarehouseId: params.toWarehouseId,
      qty: params.qty,
    });

    await logAuditEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "POST",
      entity: "Stock Transfer",
      entityId: result.out.movementId,
      newPayload: { ...params, result },
    });

    return { success: true, data: result, message: "Stock transferred." };
  } catch (err: any) {
    console.error("[postTransferAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Transfer failed" };
  }
}

/**
 * Returns the list of batches (with expiry status flags).
 */
export async function fetchBatchesAction(
  productId?: string,
  warehouseId?: string,
): Promise<ActionResult<BatchRow[]>> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    let condition = sql`${schema.batches.companyId} = ${ctx.companyId}`;
    if (productId)
      condition = sql`${condition} AND ${schema.batches.productId} = ${productId}`;
    if (warehouseId)
      condition = sql`${condition} AND ${schema.batches.warehouseId} = ${warehouseId}`;

    const rows = await db
      .select()
      .from(schema.batches)
      .where(condition)
      .orderBy(desc(schema.batches.createdAt));

    const [whList, prodList] = await Promise.all([
      db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.products)
        .where(eq(schema.products.companyId, ctx.companyId)),
    ]);
    const whMap = new Map(whList.map((w) => [w.id, w]));
    const prodMap = new Map(prodList.map((p) => [p.id, p]));
    const now = new Date();

    const data: BatchRow[] = rows.map((r) => {
      const wh = whMap.get(r.warehouseId);
      const prod = prodMap.get(r.productId);
      const expiry = r.expiryDate ? new Date(r.expiryDate) : null;
      const isExpired = expiry ? expiry < now : false;
      const isExpiringSoon = expiry
        ? !isExpired &&
          expiry.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000
        : false;
      return {
        id: r.id,
        warehouseId: r.warehouseId,
        warehouseName: wh?.name || wh?.code || "Unknown Warehouse",
        productId: r.productId,
        productName: prod?.name || "Unknown Product",
        productSku: prod?.sku || prod?.code || "-",
        batchNo: r.batchNo,
        expiryDate: r.expiryDate
          ? new Date(r.expiryDate).toISOString()
          : undefined,
        qtyIn: Number(r.qtyIn || 0),
        qtyOut: Number(r.qtyOut || 0),
        qtyRemaining: Number(r.qtyRemaining || 0),
        costPrice: Number(r.costPrice || 0),
        status: r.status ?? "OPEN",
        isExpiringSoon,
        isExpired,
      };
    });

    return { success: true, data };
  } catch (err: any) {
    console.error("[fetchBatchesAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Failed to fetch batches" };
  }
}

/**
 * Returns an inventory overview summary (KPIs + low stock + by warehouse).
 */
export async function getInventoryOverviewAction(): Promise<ActionResult<any>> {
  try {
    const ctx = await resolveCompanyContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const [stocks, products, whList, batches] = await Promise.all([
      db
        .select()
        .from(schema.warehouseStocks)
        .where(eq(schema.warehouseStocks.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.products)
        .where(eq(schema.products.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.companyId, ctx.companyId)),
      db
        .select()
        .from(schema.batches)
        .where(eq(schema.batches.companyId, ctx.companyId)),
    ]);

    const prodMap = new Map(products.map((p) => [p.id, p]));
    const whMap = new Map(whList.map((w) => [w.id, w]));
    const now = new Date();

    let totalSkuItems = 0;
    let stockValue = 0;
    const byWarehouseMap = new Map<
      string,
      {
        warehouseId: string;
        warehouseName: string;
        qtyOnHand: number;
        stockValue: number;
      }
    >();

    for (const s of stocks) {
      const qty = Number(s.qtyOnHand || 0);
      if (qty > 0) totalSkuItems++;
      const val = qty * Number(s.avgCost || 0);
      stockValue += val;
      const entry = byWarehouseMap.get(s.warehouseId) || {
        warehouseId: s.warehouseId,
        warehouseName: whMap.get(s.warehouseId)?.name || "Unknown",
        qtyOnHand: 0,
        stockValue: 0,
      };
      entry.qtyOnHand += qty;
      entry.stockValue += val;
      byWarehouseMap.set(s.warehouseId, entry);
    }

    const lowStockItems: any[] = [];
    const productStockMap = new Map<string, number>();
    stocks.forEach((s) => {
      const current = productStockMap.get(s.productId) || 0;
      productStockMap.set(s.productId, current + Number(s.qtyOnHand || 0));
    });

    for (const p of products) {
      const totalQty = productStockMap.get(p.id) ?? Number(p.stockOnHand || 0);
      if (p.type === "GOODS" && totalQty <= Number(p.reorderLevel || 0)) {
        lowStockItems.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku || p.code,
          warehouseName: whList[0]?.name || "N/A",
          qtyOnHand: totalQty,
          reorderLevel: Number(p.reorderLevel || 0),
        });
      }
    }

    const expiredCount = batches.filter(
      (b) =>
        b.expiryDate && b.expiryDate < now && Number(b.qtyRemaining || 0) > 0,
    ).length;
    const expiringSoonCount = batches.filter((b) => {
      if (!b.expiryDate || b.expiryDate < now) return false;
      return b.expiryDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      success: true,
      data: {
        totalSku: totalSkuItems,
        totalWarehouses: whList.length,
        stockValue,
        lowStockCount: lowStockItems.length,
        expiredCount,
        expiringSoonCount,
        byWarehouse: Array.from(byWarehouseMap.values()),
        lowStockItems,
      },
    };
  } catch (err: any) {
    console.error("[getInventoryOverviewAction] Error:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Failed to fetch overview",
    };
  }
}
