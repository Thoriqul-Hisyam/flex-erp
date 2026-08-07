"use server";

import { db, schema } from "@/db";
import { eq, desc, or, type SQL } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { denyIfUnauthorized } from "@/lib/auth/server-permissions";
import {
  getScopeContext,
  withScope,
  assertCompanyScopedWarehouse,
  type ScopeContext,
} from "@/lib/auth/scope";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  adjustStock,
  receiveStock,
  issueStock,
  transferStock,
  type MovementContext,
} from "@/lib/inventory/stock-engine";
import type { ActionResult } from "./crud-actions";
import { getErrorMessage } from "@/lib/utils";
import {
  postAdjustmentSchema,
  postStockInSchema,
  postStockOutSchema,
  postTransferSchema,
} from "@/lib/validation/inventory";

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

async function resolveInventoryContext(): Promise<
  (ScopeContext & { userId: string }) | null
> {
  const user = await getSessionUser();
  if (!user) return null;
  return { ...getScopeContext(user), userId: user.id };
}

/**
 * Fetches reference/lookup rows (for resolving names on an already-scoped
 * result set) filtered by company only, never by branch/warehouse - a
 * branch-scoped user must still be able to resolve the name of a
 * company-wide warehouse that legitimately shows up in their stock/movement
 * rows (see withScope's branch-tier OR-with-company-wide rule).
 */
async function fetchCompanyScoped(table: any, ctx: ScopeContext) {
  return ctx.companyId
    ? db.select().from(table).where(eq(table.companyId, ctx.companyId))
    : db.select().from(table);
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
    const denied = await denyIfUnauthorized("inv_stocks", "read");
    if (denied) return denied;

    const ctx = await resolveInventoryContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const whereClause = await withScope(
      schema.warehouseStocks,
      ctx,
      warehouseId ? [eq(schema.warehouseStocks.warehouseId, warehouseId)] : undefined,
    );

    const rows = whereClause
      ? await db.select().from(schema.warehouseStocks).where(whereClause)
      : await db.select().from(schema.warehouseStocks);

    const [whList, prodList] = await Promise.all([
      fetchCompanyScoped(schema.warehouses, ctx),
      fetchCompanyScoped(schema.products, ctx),
    ]);
    const whMap = new Map(whList.map((w: any) => [w.id, w]));
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
  } catch (err) {
    console.error("[fetchWarehouseStocksAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Failed to fetch stocks" };
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
    const denied = await denyIfUnauthorized("inv_movements", "read");
    if (denied) return denied;

    const ctx = await resolveInventoryContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const extra: SQL[] = [];
    if (opts?.productId) {
      extra.push(eq(schema.stockMovements.productId, opts.productId));
    }
    if (opts?.warehouseId) {
      extra.push(
        or(
          eq(schema.stockMovements.warehouseId, opts.warehouseId),
          eq(schema.stockMovements.fromWarehouseId, opts.warehouseId),
          eq(schema.stockMovements.toWarehouseId, opts.warehouseId),
        ) as SQL,
      );
    }
    const whereClause = await withScope(schema.stockMovements, ctx, extra);

    const baseQuery = db.select().from(schema.stockMovements);
    const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(desc(schema.stockMovements.createdAt))
      .limit(opts?.limit ?? 200);

    const [prodList, whList, batchList] = await Promise.all([
      fetchCompanyScoped(schema.products, ctx),
      fetchCompanyScoped(schema.warehouses, ctx),
      fetchCompanyScoped(schema.batches, ctx),
    ]);
    const prodMap = new Map(prodList.map((p: any) => [p.id, p]));
    const whMap = new Map(whList.map((w: any) => [w.id, w]));
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
  } catch (err) {
    console.error("[fetchStockMovementsAction] Error:", getErrorMessage(err) || err);
    return {
      success: false,
      error: getErrorMessage(err) || "Failed to fetch movements",
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
    const denied = await denyIfUnauthorized("inv_adjustments", "create");
    if (denied) return denied;

    const parsed = postAdjustmentSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const ctx = await resolveInventoryContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      ctx.companyId,
      params.warehouseId,
      ctx.branchId ?? null,
    );
    if (!resolvedWarehouseId) {
      return { success: false, error: "Warehouse is required" };
    }

    const result = await adjustStock(toMovementCtx(ctx), {
      productId: params.productId,
      warehouseId: resolvedWarehouseId,
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
  } catch (err) {
    console.error("[postAdjustmentAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Adjustment failed" };
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
    const denied = await denyIfUnauthorized("inv_movements", "create");
    if (denied) return denied;

    const parsed = postStockInSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const ctx = await resolveInventoryContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      ctx.companyId,
      params.warehouseId,
      ctx.branchId ?? null,
    );
    if (!resolvedWarehouseId) {
      return { success: false, error: "Warehouse is required" };
    }

    const result = await receiveStock(
      {
        ...toMovementCtx(ctx),
        refType: params.refType,
        refId: params.refId,
        note: params.note,
      },
      {
        productId: params.productId,
        warehouseId: resolvedWarehouseId,
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
  } catch (err) {
    console.error("[postStockInAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Stock IN failed" };
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
    const denied = await denyIfUnauthorized("inv_movements", "create");
    if (denied) return denied;

    const parsed = postStockOutSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const ctx = await resolveInventoryContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      ctx.companyId,
      params.warehouseId,
      ctx.branchId ?? null,
    );
    if (!resolvedWarehouseId) {
      return { success: false, error: "Warehouse is required" };
    }

    const result = await issueStock(
      {
        ...toMovementCtx(ctx),
        refType: params.refType,
        refId: params.refId,
        note: params.note,
      },
      {
        productId: params.productId,
        warehouseId: resolvedWarehouseId,
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
  } catch (err) {
    console.error("[postStockOutAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Stock OUT failed" };
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
    const denied = await denyIfUnauthorized("inv_transfers", "create");
    if (denied) return denied;

    const parsed = postTransferSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const ctx = await resolveInventoryContext();
    if (!ctx || !ctx.companyId)
      return { success: false, error: "Company context not found" };

    const fromWarehouseId = await assertCompanyScopedWarehouse(
      ctx.companyId,
      params.fromWarehouseId,
      ctx.branchId ?? null,
    );
    const toWarehouseId = await assertCompanyScopedWarehouse(
      ctx.companyId,
      params.toWarehouseId,
      ctx.branchId ?? null,
    );
    if (!fromWarehouseId || !toWarehouseId) {
      return { success: false, error: "Both source and destination warehouses are required" };
    }

    const result = await transferStock(toMovementCtx(ctx), {
      productId: params.productId,
      fromWarehouseId,
      toWarehouseId,
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
  } catch (err) {
    console.error("[postTransferAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Transfer failed" };
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
    const denied = await denyIfUnauthorized("inv_batches", "read");
    if (denied) return denied;

    const ctx = await resolveInventoryContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const extra: SQL[] = [];
    if (productId) extra.push(eq(schema.batches.productId, productId));
    if (warehouseId) extra.push(eq(schema.batches.warehouseId, warehouseId));
    const whereClause = await withScope(schema.batches, ctx, extra);

    const baseQuery = db.select().from(schema.batches);
    const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery).orderBy(
      desc(schema.batches.createdAt),
    );

    const [whList, prodList] = await Promise.all([
      fetchCompanyScoped(schema.warehouses, ctx),
      fetchCompanyScoped(schema.products, ctx),
    ]);
    const whMap = new Map(whList.map((w: any) => [w.id, w]));
    const prodMap = new Map(prodList.map((p: any) => [p.id, p]));
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
  } catch (err) {
    console.error("[fetchBatchesAction] Error:", getErrorMessage(err) || err);
    return { success: false, error: getErrorMessage(err) || "Failed to fetch batches" };
  }
}

/**
 * Returns an inventory overview summary (KPIs + low stock + by warehouse).
 */
export async function getInventoryOverviewAction(): Promise<ActionResult<any>> {
  try {
    const denied = await denyIfUnauthorized("inv_stocks", "read");
    if (denied) return denied;

    const ctx = await resolveInventoryContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const [stocksWhere, batchesWhere] = await Promise.all([
      withScope(schema.warehouseStocks, ctx),
      withScope(schema.batches, ctx),
    ]);

    const [stocks, products, whList, batches] = await Promise.all([
      stocksWhere
        ? db.select().from(schema.warehouseStocks).where(stocksWhere)
        : db.select().from(schema.warehouseStocks),
      fetchCompanyScoped(schema.products, ctx),
      fetchCompanyScoped(schema.warehouses, ctx),
      batchesWhere
        ? db.select().from(schema.batches).where(batchesWhere)
        : db.select().from(schema.batches),
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
  } catch (err) {
    console.error("[getInventoryOverviewAction] Error:", getErrorMessage(err) || err);
    return {
      success: false,
      error: getErrorMessage(err) || "Failed to fetch overview",
    };
  }
}
