"use server";

import { db, schema } from "@/db";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { denyIfUnauthorized } from "@/lib/auth/server-permissions";
import {
  getScopeContext,
  withScope,
  assertCompanyScopedBranch,
  assertCompanyScopedWarehouse,
} from "@/lib/auth/scope";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  assertSufficientStockForReservation,
  issueStock,
  receiveStock,
  type MovementContext,
} from "@/lib/inventory/stock-engine";
import { revalidatePath } from "next/cache";
import { nextDocumentNumber } from "@/lib/documents/sequence";
import { getErrorMessage } from "@/lib/utils";
import {
  createSalesQuotationSchema,
  createSalesOrderSchema,
  createDeliveryOrderSchema,
  createSalesReturnSchema,
  closeSalesOrderShortSchema,
  recordCustomerPaymentSchema,
} from "@/lib/validation/sales";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

function num(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// -----------------------------------------------------------------------------
// 1. SALES QUOTATIONS (SQ / Penawaran Harga)
// -----------------------------------------------------------------------------

export async function fetchSalesQuotationsAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("sal_quotations", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const sqWhere = await withScope(schema.salesQuotations, scope);

    const sqBaseQuery = db
      .select({
        id: schema.salesQuotations.id,
        sqNumber: schema.salesQuotations.sqNumber,
        customerId: schema.salesQuotations.customerId,
        customerName: schema.customers.name,
        branchId: schema.salesQuotations.branchId,
        branchName: schema.branches.name,
        status: schema.salesQuotations.status,
        subtotal: schema.salesQuotations.subtotal,
        taxAmount: schema.salesQuotations.taxAmount,
        totalAmount: schema.salesQuotations.totalAmount,
        validUntil: schema.salesQuotations.validUntil,
        notes: schema.salesQuotations.notes,
        createdById: schema.salesQuotations.createdById,
        createdAt: schema.salesQuotations.createdAt,
        updatedAt: schema.salesQuotations.updatedAt,
      })
      .from(schema.salesQuotations)
      .leftJoin(schema.customers, eq(schema.salesQuotations.customerId, schema.customers.id))
      .leftJoin(schema.branches, eq(schema.salesQuotations.branchId, schema.branches.id));
    const sqs = await (sqWhere ? sqBaseQuery.where(sqWhere) : sqBaseQuery).orderBy(
      desc(schema.salesQuotations.createdAt),
    );

    const result = [];
    for (const sq of sqs) {
      const items = await db
        .select({
          id: schema.salesQuotationItems.id,
          productId: schema.salesQuotationItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          qtyRequested: schema.salesQuotationItems.qtyRequested,
          unitPrice: schema.salesQuotationItems.unitPrice,
          discount: schema.salesQuotationItems.discount,
          totalPrice: schema.salesQuotationItems.totalPrice,
        })
        .from(schema.salesQuotationItems)
        .leftJoin(schema.products, eq(schema.salesQuotationItems.productId, schema.products.id))
        .where(eq(schema.salesQuotationItems.sqId, sq.id));

      // Check if SO is linked
      const [linkedSo] = await db
        .select({ id: schema.salesOrders.id, soNumber: schema.salesOrders.soNumber })
        .from(schema.salesOrders)
        .where(
          and(
            eq(schema.salesOrders.sqId, sq.id),
            ne(schema.salesOrders.status, "CANCELLED")
          )
        );

      let createdByName = "System";
      if (sq.createdById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, sq.createdById));
        if (u) createdByName = u.name;
      }

      result.push({
        id: sq.id,
        sqNumber: sq.sqNumber,
        soId: linkedSo?.id || null,
        soNumber: linkedSo?.soNumber || null,
        customerId: sq.customerId,
        customerName: sq.customerName || "Unknown Customer",
        branchId: sq.branchId,
        branchName: sq.branchName || "-",
        status: sq.status,
        subtotal: num(sq.subtotal),
        taxAmount: num(sq.taxAmount),
        totalAmount: num(sq.totalAmount),
        validUntil: sq.validUntil ? new Date(sq.validUntil).toISOString() : "",
        notes: sq.notes,
        createdByName,
        createdAt: sq.createdAt ? new Date(sq.createdAt).toISOString() : "",
        updatedAt: sq.updatedAt ? new Date(sq.updatedAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          qtyRequested: num(i.qtyRequested),
          unitPrice: num(i.unitPrice),
          discount: num(i.discount),
          totalPrice: num(i.totalPrice),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchSalesQuotationsAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Penawaran Harga (Sales Quotation)." };
  }
}

export async function createSalesQuotationAction(params: {
  customerId: string;
  branchId?: string;
  validUntil?: string;
  taxRate?: number;
  notes?: string;
  items: Array<{ productId: string; qtyRequested: number; unitPrice: number; discount?: number }>;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_quotations", "create");
    if (denied) return denied;

    const parsed = createSalesQuotationSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.customerId) {
      return { success: false, message: "Pelanggan / Customer wajib dipilih." };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk harus diisi." };
    }

    const resolvedBranchId = await assertCompanyScopedBranch(
      companyId,
      params.branchId,
      user.branchId,
    );

    let subtotal = 0;
    const itemData = params.items.map((i) => {
      const qty = i.qtyRequested || 1;
      const price = i.unitPrice || 0;
      const disc = i.discount || 0;
      const total = qty * price - disc;
      subtotal += total;
      return {
        productId: i.productId,
        qtyRequested: String(qty),
        unitPrice: String(price),
        discount: String(disc),
        totalPrice: String(total),
      };
    });

    const taxPct = params.taxRate ?? 11;
    const taxAmount = (subtotal * taxPct) / 100;
    const totalAmount = subtotal + taxAmount;

    const newSq = await db.transaction(async (tx) => {
      const sqNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "SQ" });
      const [sq] = await tx
        .insert(schema.salesQuotations)
        .values({
          tenantId,
          companyId,
          sqNumber,
          customerId: params.customerId,
          branchId: resolvedBranchId || null,
          validUntil: params.validUntil ? new Date(params.validUntil) : null,
          status: "DRAFT",
          subtotal: String(subtotal),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(schema.salesQuotationItems).values(
        itemData.map((i) => ({
          tenantId,
          companyId,
          sqId: sq.id,
          ...i,
        }))
      );

      return sq;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "SalesQuotation",
      entityId: newSq.id,
    });

    revalidatePath("/sales/quotations");
    return { success: true, message: `Sales Quotation ${newSq.sqNumber} berhasil dibuat.` };
  } catch (error) {
    console.error("createSalesQuotationAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membuat Sales Quotation." };
  }
}

export async function acceptSalesQuotationAction(sqId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_quotations", "approve");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    await db
      .update(schema.salesQuotations)
      .set({ status: "ACCEPTED", updatedAt: new Date() })
      .where(
        sql`${schema.salesQuotations.id} = ${sqId} AND ${schema.salesQuotations.companyId} = ${user.companyId}`
      );

    revalidatePath("/sales/quotations");
    return { success: true, message: "Penawaran harga disetujui (ACCEPTED)." };
  } catch (error) {
    console.error("acceptSalesQuotationAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menyetujui Penawaran." };
  }
}

// -----------------------------------------------------------------------------
// 2. SALES ORDERS (SO / Pesanan Penjualan & Stock Reservation)
// -----------------------------------------------------------------------------

export async function fetchSalesOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("sal_orders", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const soWhere = await withScope(schema.salesOrders, scope);

    const soBaseQuery = db
      .select({
        id: schema.salesOrders.id,
        soNumber: schema.salesOrders.soNumber,
        sqId: schema.salesOrders.sqId,
        sqNumber: schema.salesQuotations.sqNumber,
        customerId: schema.salesOrders.customerId,
        customerName: schema.customers.name,
        branchId: schema.salesOrders.branchId,
        branchName: schema.branches.name,
        warehouseId: schema.salesOrders.warehouseId,
        warehouseName: schema.warehouses.name,
        status: schema.salesOrders.status,
        subtotal: schema.salesOrders.subtotal,
        taxAmount: schema.salesOrders.taxAmount,
        totalAmount: schema.salesOrders.totalAmount,
        notes: schema.salesOrders.notes,
        createdById: schema.salesOrders.createdById,
        createdAt: schema.salesOrders.createdAt,
        updatedAt: schema.salesOrders.updatedAt,
      })
      .from(schema.salesOrders)
      .leftJoin(schema.salesQuotations, eq(schema.salesOrders.sqId, schema.salesQuotations.id))
      .leftJoin(schema.customers, eq(schema.salesOrders.customerId, schema.customers.id))
      .leftJoin(schema.branches, eq(schema.salesOrders.branchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.salesOrders.warehouseId, schema.warehouses.id));
    const sos = await (soWhere ? soBaseQuery.where(soWhere) : soBaseQuery).orderBy(
      desc(schema.salesOrders.createdAt),
    );

    const result = [];
    for (const so of sos) {
      const items = await db
        .select({
          id: schema.salesOrderItems.id,
          productId: schema.salesOrderItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          qtyOrdered: schema.salesOrderItems.qtyOrdered,
          qtyDelivered: schema.salesOrderItems.qtyDelivered,
          unitPrice: schema.salesOrderItems.unitPrice,
          discount: schema.salesOrderItems.discount,
          totalPrice: schema.salesOrderItems.totalPrice,
        })
        .from(schema.salesOrderItems)
        .leftJoin(schema.products, eq(schema.salesOrderItems.productId, schema.products.id))
        .where(eq(schema.salesOrderItems.soId, so.id));

      let createdByName = "System";
      if (so.createdById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, so.createdById));
        if (u) createdByName = u.name;
      }

      result.push({
        id: so.id,
        soNumber: so.soNumber,
        sqId: so.sqId,
        sqNumber: so.sqNumber || null,
        customerId: so.customerId,
        customerName: so.customerName || "Unknown Customer",
        branchId: so.branchId,
        branchName: so.branchName || "-",
        warehouseId: so.warehouseId,
        warehouseName: so.warehouseName || "-",
        status: so.status,
        subtotal: num(so.subtotal),
        taxAmount: num(so.taxAmount),
        totalAmount: num(so.totalAmount),
        notes: so.notes,
        createdByName,
        createdAt: so.createdAt ? new Date(so.createdAt).toISOString() : "",
        updatedAt: so.updatedAt ? new Date(so.updatedAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          qtyOrdered: num(i.qtyOrdered),
          qtyDelivered: num(i.qtyDelivered),
          unitPrice: num(i.unitPrice),
          discount: num(i.discount),
          totalPrice: num(i.totalPrice),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchSalesOrdersAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Sales Orders." };
  }
}

export async function createSalesOrderAction(params: {
  customerId: string;
  warehouseId: string;
  branchId?: string;
  sqId?: string;
  taxRate?: number;
  notes?: string;
  items: Array<{ productId: string; qtyOrdered: number; unitPrice: number; discount?: number }>;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_orders", "create");
    if (denied) return denied;

    const parsed = createSalesOrderSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.customerId || !params.warehouseId) {
      return { success: false, message: "Customer dan Gudang pengiriman wajib dipilih." };
    }

    const resolvedBranchId = await assertCompanyScopedBranch(
      companyId,
      params.branchId,
      user.branchId,
    );
    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      companyId,
      params.warehouseId,
      user.branchId,
    );

    if (!resolvedWarehouseId) {
      return { success: false, message: "Gudang pengiriman wajib dipilih." };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk pesanan harus diisi." };
    }

    let subtotal = 0;
    const itemData = params.items.map((i) => {
      const qty = i.qtyOrdered || 1;
      const price = i.unitPrice || 0;
      const disc = i.discount || 0;
      const total = qty * price - disc;
      subtotal += total;
      return {
        productId: i.productId,
        qtyOrdered: String(qty),
        qtyDelivered: "0",
        unitPrice: String(price),
        discount: String(disc),
        totalPrice: String(total),
      };
    });

    const taxPct = params.taxRate ?? 11;
    const taxAmount = (subtotal * taxPct) / 100;
    const totalAmount = subtotal + taxAmount;

    const newSo = await db.transaction(async (tx) => {
      const soNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "SO" });
      const [so] = await tx
        .insert(schema.salesOrders)
        .values({
          tenantId,
          companyId,
          soNumber,
          sqId: params.sqId || null,
          customerId: params.customerId,
          branchId: resolvedBranchId || null,
          warehouseId: resolvedWarehouseId,
          status: "DRAFT",
          subtotal: String(subtotal),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(schema.salesOrderItems).values(
        itemData.map((i) => ({
          tenantId,
          companyId,
          soId: so.id,
          ...i,
        }))
      );

      return so;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "SalesOrder",
      entityId: newSo.id,
    });

    revalidatePath("/sales/orders");
    return { success: true, message: `Sales Order ${newSo.soNumber} berhasil dibuat.` };
  } catch (error) {
    console.error("createSalesOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membuat Sales Order." };
  }
}

export async function confirmSalesOrderAction(soId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_orders", "approve");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${soId} AND ${schema.salesOrders.companyId} = ${companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (so.status !== "DRAFT") return { success: false, message: "SO telah dikonfirmasi sebelumnya." };

    const [customer] = await db
      .select({
        creditLimit: schema.customers.creditLimit,
        balanceOutstanding: schema.customers.balanceOutstanding,
        name: schema.customers.name,
      })
      .from(schema.customers)
      .where(eq(schema.customers.id, so.customerId));

    const creditLimit = num(customer?.creditLimit);
    if (creditLimit > 0) {
      const projectedBalance = num(customer?.balanceOutstanding) + num(so.totalAmount);
      if (projectedBalance > creditLimit) {
        return {
          success: false,
          message: `Konfirmasi ditolak: limit kredit pelanggan ${customer?.name || ""} terlampaui. Limit = Rp ${creditLimit.toLocaleString("id-ID")}, Outstanding + SO ini = Rp ${projectedBalance.toLocaleString("id-ID")}.`,
        };
      }
    }

    const items = await db
      .select()
      .from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.soId, so.id));

    await db.transaction(async (tx) => {
      await tx
        .update(schema.salesOrders)
        .set({ status: "CONFIRMED", updatedAt: new Date() })
        .where(eq(schema.salesOrders.id, so.id));

      if (so.warehouseId) {
        for (const item of items) {
          const qty = num(item.qtyOrdered);
          if (qty <= 0) continue;

          const [existingStock] = await tx
            .select()
            .from(schema.warehouseStocks)
            .where(
              and(
                eq(schema.warehouseStocks.companyId, companyId),
                eq(schema.warehouseStocks.warehouseId, so.warehouseId),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );

          const currentOnHand = num(existingStock?.qtyOnHand);
          const currentReserved = num(existingStock?.qtyReserved);
          assertSufficientStockForReservation(currentOnHand, currentReserved, qty);

          if (existingStock) {
            await tx
              .update(schema.warehouseStocks)
              .set({
                qtyReserved: sql`${schema.warehouseStocks.qtyReserved} + ${qty}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.warehouseStocks.id, existingStock.id));
          } else {
            await tx.insert(schema.warehouseStocks).values({
              tenantId,
              companyId,
              warehouseId: so.warehouseId,
              productId: item.productId,
              qtyOnHand: "0",
              qtyReserved: String(qty),
              qtyIncoming: "0",
              avgCost: String(item.unitPrice),
            });
          }
        }
      }
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "SalesOrder",
      entityId: so.id,
    });

    revalidatePath("/sales/orders");
    return { success: true, message: `Sales Order ${so.soNumber} berhasil dikonfirmasi (Stok Dialokasikan).` };
  } catch (error) {
    console.error("confirmSalesOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengonfirmasi Sales Order." };
  }
}

/**
 * Cancels a Sales Order that has not yet completed delivery, releasing any
 * stock reserved at confirmation time back into available inventory.
 */
export async function cancelSalesOrderAction(
  soId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_orders", "delete");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan pembatalan wajib diisi." };
    }

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${soId} AND ${schema.salesOrders.companyId} = ${user.companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (so.status === "CANCELLED") return { success: false, message: "Sales Order sudah dibatalkan." };
    if (so.status === "DELIVERED" || so.status === "PARTIALLY_DELIVERED") {
      return {
        success: false,
        message: "Sales Order yang sudah memiliki Surat Jalan tidak bisa dibatalkan langsung. Batalkan/retur Surat Jalan terkait terlebih dahulu.",
      };
    }

    await db.transaction(async (tx) => {
      if (so.status === "CONFIRMED" && so.warehouseId) {
        const items = await tx
          .select()
          .from(schema.salesOrderItems)
          .where(eq(schema.salesOrderItems.soId, so.id));

        for (const item of items) {
          const outstandingReserved = num(item.qtyOrdered) - num(item.qtyDelivered);
          if (outstandingReserved <= 0) continue;

          await tx
            .update(schema.warehouseStocks)
            .set({
              qtyReserved: sql`GREATEST(0, ${schema.warehouseStocks.qtyReserved} - ${outstandingReserved})`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.warehouseStocks.companyId, user.companyId!),
                eq(schema.warehouseStocks.warehouseId, so.warehouseId!),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );
        }
      }

      await tx
        .update(schema.salesOrders)
        .set({
          status: "CANCELLED",
          cancelReason: reason,
          cancelledById: user.id,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.salesOrders.id, so.id));
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "SalesOrder",
      entityId: so.id,
    });

    revalidatePath("/sales/orders");
    revalidatePath("/inventory/stocks");
    return { success: true, message: `Sales Order ${so.soNumber} berhasil dibatalkan & reservasi stok dilepas.` };
  } catch (error) {
    console.error("cancelSalesOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Sales Order." };
  }
}

/**
 * Closes a Partially Delivered Sales Order as final ("short") when the
 * remaining un-delivered qty will never be shipped (e.g. customer only wants
 * what's already been sent, or stock permanently unavailable). Releases the
 * outstanding reserved stock for the shortfall and, if a whole-SO customer
 * invoice already exists, adjusts it down to the value actually delivered -
 * mirrors closePurchaseOrderShortAction's behavior on the purchasing side.
 */
export async function closeSalesOrderShortAction(
  soId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_orders", "approve");
    if (denied) return denied;

    const parsed = closeSalesOrderShortSchema.safeParse({ soId, reason });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${soId} AND ${schema.salesOrders.companyId} = ${companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (so.status !== "PARTIALLY_DELIVERED") {
      return {
        success: false,
        message: "Hanya SO berstatus Partially Delivered yang dapat ditutup sebagai short.",
      };
    }

    const items = await db
      .select()
      .from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.soId, soId));

    const shortItems = items.filter((i) => num(i.qtyOrdered) > num(i.qtyDelivered));
    if (shortItems.length === 0) {
      return { success: false, message: "Tidak ada sisa qty yang kurang pada SO ini." };
    }

    const deliveredValue = items.reduce((sum, i) => {
      const ordered = num(i.qtyOrdered);
      const perUnitValue = ordered > 0 ? num(i.totalPrice) / ordered : num(i.unitPrice);
      return sum + perUnitValue * num(i.qtyDelivered);
    }, 0);

    const [wholeSoInvoice] = await db
      .select()
      .from(schema.customerInvoices)
      .where(
        and(
          eq(schema.customerInvoices.soId, soId),
          sql`${schema.customerInvoices.doId} IS NULL`
        )
      );

    const taxRate = num(so.subtotal) > 0 ? num(so.taxAmount) / num(so.subtotal) : 0;
    const newSubtotal = deliveredValue;
    const newTaxAmount = newSubtotal * taxRate;
    const newInvoiceTotal = newSubtotal + newTaxAmount;

    if (wholeSoInvoice && wholeSoInvoice.status !== "CANCELLED" && num(wholeSoInvoice.amountPaid) > newInvoiceTotal) {
      return {
        success: false,
        message: `Faktur Penjualan ${wholeSoInvoice.invoiceNumber} sudah dibayar Rp ${num(wholeSoInvoice.amountPaid).toLocaleString("id-ID")}, lebih besar dari nilai barang yang benar-benar dikirim (Rp ${newInvoiceTotal.toLocaleString("id-ID")}). Selesaikan kelebihan bayar dengan pelanggan sebelum menutup SO ini.`,
      };
    }

    await db.transaction(async (tx) => {
      if (so.warehouseId) {
        for (const item of shortItems) {
          const shortQty = num(item.qtyOrdered) - num(item.qtyDelivered);
          await tx
            .update(schema.warehouseStocks)
            .set({
              qtyReserved: sql`GREATEST(0, ${schema.warehouseStocks.qtyReserved} - ${shortQty})`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.warehouseStocks.companyId, companyId),
                eq(schema.warehouseStocks.warehouseId, so.warehouseId!),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );
        }
      }

      await tx
        .update(schema.salesOrders)
        .set({
          status: "DELIVERED",
          notes: sql`CONCAT(COALESCE(notes, ''), ' [SO ditutup short: ', ${reason}::text, ']')`,
          updatedAt: new Date(),
        })
        .where(eq(schema.salesOrders.id, soId));

      if (wholeSoInvoice && wholeSoInvoice.status !== "CANCELLED") {
        let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
        if (num(wholeSoInvoice.amountPaid) >= newInvoiceTotal && newInvoiceTotal > 0) newStatus = "PAID";
        else if (num(wholeSoInvoice.amountPaid) > 0) newStatus = "PARTIALLY_PAID";

        await tx
          .update(schema.customerInvoices)
          .set({
            subtotal: String(newSubtotal),
            taxAmount: String(newTaxAmount),
            totalAmount: String(newInvoiceTotal),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(schema.customerInvoices.id, wholeSoInvoice.id));
      }
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "SalesOrder",
      entityId: soId,
      newPayload: { shortClosed: true, reason, shortItems: shortItems.map((i) => i.productId) },
    });

    revalidatePath("/sales/orders");
    revalidatePath("/sales/invoices");
    revalidatePath("/inventory/stocks");

    return {
      success: true,
      message: `SO ${so.soNumber} ditutup sebagai short (sisa qty tidak akan dikirim).${wholeSoInvoice ? " Faktur penjualan disesuaikan ke nilai yang benar-benar dikirim." : ""}`,
    };
  } catch (error) {
    console.error("closeSalesOrderShortAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menutup SO short." };
  }
}

// -----------------------------------------------------------------------------
// 3. DELIVERY ORDERS (DO / Surat Jalan & Stock OUT Execution)
// -----------------------------------------------------------------------------

export async function fetchDeliveryOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("sal_deliveries", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const doWhere = await withScope(schema.deliveryOrders, scope);

    const doBaseQuery = db
      .select({
        id: schema.deliveryOrders.id,
        doNumber: schema.deliveryOrders.doNumber,
        soId: schema.deliveryOrders.soId,
        soNumber: schema.salesOrders.soNumber,
        customerId: schema.deliveryOrders.customerId,
        customerName: schema.customers.name,
        warehouseId: schema.deliveryOrders.warehouseId,
        warehouseName: schema.warehouses.name,
        status: schema.deliveryOrders.status,
        shippedAt: schema.deliveryOrders.shippedAt,
        driverName: schema.deliveryOrders.driverName,
        vehicleNumber: schema.deliveryOrders.vehicleNumber,
        notes: schema.deliveryOrders.notes,
        createdById: schema.deliveryOrders.createdById,
        createdAt: schema.deliveryOrders.createdAt,
      })
      .from(schema.deliveryOrders)
      .leftJoin(schema.salesOrders, eq(schema.deliveryOrders.soId, schema.salesOrders.id))
      .leftJoin(schema.customers, eq(schema.deliveryOrders.customerId, schema.customers.id))
      .leftJoin(schema.warehouses, eq(schema.deliveryOrders.warehouseId, schema.warehouses.id));
    const dos = await (doWhere ? doBaseQuery.where(doWhere) : doBaseQuery).orderBy(
      desc(schema.deliveryOrders.createdAt),
    );

    const result = [];
    for (const d of dos) {
      const items = await db
        .select({
          id: schema.deliveryOrderItems.id,
          productId: schema.deliveryOrderItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          batchNo: schema.deliveryOrderItems.batchNo,
          qtyShipped: schema.deliveryOrderItems.qtyShipped,
          unitPrice: schema.deliveryOrderItems.unitPrice,
        })
        .from(schema.deliveryOrderItems)
        .leftJoin(schema.products, eq(schema.deliveryOrderItems.productId, schema.products.id))
        .where(eq(schema.deliveryOrderItems.doId, d.id));

      result.push({
        id: d.id,
        doNumber: d.doNumber,
        soId: d.soId,
        soNumber: d.soNumber || "-",
        customerId: d.customerId,
        customerName: d.customerName || "Unknown Customer",
        warehouseId: d.warehouseId,
        warehouseName: d.warehouseName || "-",
        status: d.status,
        driverName: d.driverName || "-",
        vehicleNumber: d.vehicleNumber || "-",
        shippedAt: d.shippedAt ? new Date(d.shippedAt).toISOString() : "",
        notes: d.notes,
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          batchNo: i.batchNo || "-",
          qtyShipped: num(i.qtyShipped),
          unitPrice: num(i.unitPrice),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchDeliveryOrdersAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Surat Jalan (Delivery Orders)." };
  }
}

export async function createDeliveryOrderAction(params: {
  soId: string;
  driverName?: string;
  vehicleNumber?: string;
  notes?: string;
  items: Array<{ productId: string; qtyShipped: number; batchNo?: string }>;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_deliveries", "create");
    if (denied) return denied;

    const parsed = createDeliveryOrderSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${params.soId} AND ${schema.salesOrders.companyId} = ${companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (so.status === "DRAFT") return { success: false, message: "Sales Order belum dikonfirmasi sehingga surat jalan belum bisa dibuat." };
    if (so.status === "DELIVERED") return { success: false, message: "Sales Order sudah selesai dikirim." };
    if (!so.warehouseId) return { success: false, message: "Gudang pengiriman SO tidak valid." };

    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      companyId,
      so.warehouseId,
      user.branchId,
    );
    if (!resolvedWarehouseId) {
      return { success: false, message: "Gudang pengiriman SO tidak valid." };
    }
    const warehouseId = resolvedWarehouseId;

    const newDo = await db.transaction(async (tx) => {
      const doNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "DO" });
      const [doRecord] = await tx
        .insert(schema.deliveryOrders)
        .values({
          tenantId,
          companyId,
          doNumber,
          soId: so.id,
          customerId: so.customerId,
          warehouseId: so.warehouseId!,
          status: "SHIPPED",
          driverName: params.driverName || null,
          vehicleNumber: params.vehicleNumber || null,
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(schema.deliveryOrderItems).values(
        params.items.map((i) => ({
          tenantId,
          companyId,
          doId: doRecord.id,
          productId: i.productId,
          batchNo: i.batchNo || null,
          qtyShipped: String(i.qtyShipped),
          unitPrice: "0",
        }))
      );

      const ctx: MovementContext = {
        tenantId,
        companyId,
        userId: user.id,
        refType: "DELIVERY_ORDER",
        refId: doRecord.id,
        note: `Pengiriman Barang ${doNumber} untuk SO ${so.soNumber}`,
      };

      for (const item of params.items) {
        if (item.qtyShipped <= 0) continue;

        const [soItem] = await tx
          .select()
          .from(schema.salesOrderItems)
          .where(
            and(
              eq(schema.salesOrderItems.soId, so.id),
              eq(schema.salesOrderItems.productId, item.productId)
            )
          );

        const alreadyDelivered = num(soItem?.qtyDelivered);
        const ordered = num(soItem?.qtyOrdered);
        if (alreadyDelivered + item.qtyShipped > ordered) {
          throw new Error(`Jumlah pengiriman untuk produk ${item.productId} melebihi sisa qty SO.`);
        }

        await issueStock(ctx, {
          productId: item.productId,
          warehouseId,
          qty: item.qtyShipped,
          batchNo: item.batchNo || undefined,
        }, tx);

        await tx
          .update(schema.warehouseStocks)
          .set({
            qtyReserved: sql`GREATEST(0, ${schema.warehouseStocks.qtyReserved} - ${item.qtyShipped})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.warehouseStocks.companyId, companyId),
              eq(schema.warehouseStocks.warehouseId, warehouseId),
              eq(schema.warehouseStocks.productId, item.productId)
            )
          );

        await tx
          .update(schema.salesOrderItems)
          .set({
            qtyDelivered: sql`${schema.salesOrderItems.qtyDelivered} + ${item.qtyShipped}`,
          })
          .where(
            and(
              eq(schema.salesOrderItems.soId, so.id),
              eq(schema.salesOrderItems.productId, item.productId)
            )
          );
      }

      const soItems = await tx
        .select()
        .from(schema.salesOrderItems)
        .where(eq(schema.salesOrderItems.soId, so.id));

      const allDelivered = soItems.every((i) => num(i.qtyDelivered) >= num(i.qtyOrdered));
      await tx
        .update(schema.salesOrders)
        .set({
          status: allDelivered ? "DELIVERED" : "PARTIALLY_DELIVERED",
          updatedAt: new Date(),
        })
        .where(eq(schema.salesOrders.id, so.id));

      return doRecord;
    });

    revalidatePath("/sales/deliveries");
    revalidatePath("/sales/orders");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return { success: true, message: `Surat Jalan ${newDo.doNumber} berhasil terbit & Stok Berhasil Keluar (Stock OUT).` };
  } catch (error) {
    console.error("createDeliveryOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menerbitkan Surat Jalan." };
  }
}

/**
 * Cancels a Delivery Order, reversing the STOCK_OUT it posted (stock returns
 * to the warehouse) and rolling back the qtyDelivered it recorded on the SO.
 * Blocked once a non-cancelled Customer Invoice already exists for the SO -
 * post-invoice corrections must go through a Sales Return instead.
 */
export async function cancelDeliveryOrderAction(
  doId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_deliveries", "delete");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan pembatalan wajib diisi." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [doRecord] = await db
      .select()
      .from(schema.deliveryOrders)
      .where(
        sql`${schema.deliveryOrders.id} = ${doId} AND ${schema.deliveryOrders.companyId} = ${companyId}`
      );

    if (!doRecord) return { success: false, message: "Surat Jalan tidak ditemukan." };
    if (doRecord.status === "CANCELLED") {
      return { success: false, message: "Surat Jalan sudah dibatalkan." };
    }

    const [existingInv] = await db
      .select({ id: schema.customerInvoices.id, invoiceNumber: schema.customerInvoices.invoiceNumber })
      .from(schema.customerInvoices)
      .where(
        and(
          eq(schema.customerInvoices.soId, doRecord.soId),
          ne(schema.customerInvoices.status, "CANCELLED")
        )
      );

    if (existingInv) {
      return {
        success: false,
        message: `Surat Jalan tidak bisa dibatalkan karena Faktur ${existingInv.invoiceNumber} sudah diterbitkan untuk SO ini. Gunakan Retur Penjualan.`,
      };
    }

    const items = await db
      .select()
      .from(schema.deliveryOrderItems)
      .where(eq(schema.deliveryOrderItems.doId, doId));

    await db.transaction(async (tx) => {
      const ctx: MovementContext = {
        tenantId,
        companyId,
        userId: user.id,
        refType: "DELIVERY_ORDER_CANCEL",
        refId: doId,
        note: `Pembatalan Surat Jalan ${doRecord.doNumber}: ${reason}`,
      };

      for (const item of items) {
        const qty = num(item.qtyShipped);
        if (qty <= 0) continue;

        await receiveStock(ctx, {
          productId: item.productId,
          warehouseId: doRecord.warehouseId,
          qty,
          batch: item.batchNo ? { batchNo: item.batchNo } : null,
        }, tx);

        await tx
          .update(schema.salesOrderItems)
          .set({
            qtyDelivered: sql`GREATEST(0, ${schema.salesOrderItems.qtyDelivered} - ${qty})`,
          })
          .where(
            and(
              eq(schema.salesOrderItems.soId, doRecord.soId),
              eq(schema.salesOrderItems.productId, item.productId)
            )
          );
      }

      await tx
        .update(schema.deliveryOrders)
        .set({
          status: "CANCELLED",
          cancelReason: reason,
          cancelledById: user.id,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.deliveryOrders.id, doId));

      const soItems = await tx
        .select()
        .from(schema.salesOrderItems)
        .where(eq(schema.salesOrderItems.soId, doRecord.soId));

      const anyDelivered = soItems.some((i) => num(i.qtyDelivered) > 0);
      const allDelivered = soItems.every((i) => num(i.qtyDelivered) >= num(i.qtyOrdered));

      await tx
        .update(schema.salesOrders)
        .set({
          status: allDelivered ? "DELIVERED" : anyDelivered ? "PARTIALLY_DELIVERED" : "CONFIRMED",
          updatedAt: new Date(),
        })
        .where(eq(schema.salesOrders.id, doRecord.soId));
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "DeliveryOrder",
      entityId: doId,
    });

    revalidatePath("/sales/deliveries");
    revalidatePath("/sales/orders");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return { success: true, message: `Surat Jalan ${doRecord.doNumber} berhasil dibatalkan & stok dikembalikan ke gudang.` };
  } catch (error) {
    console.error("cancelDeliveryOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Surat Jalan." };
  }
}

// -----------------------------------------------------------------------------
// 4. CUSTOMER INVOICES & PAYMENTS (Faktur Penjualan & Pelunasan)
// -----------------------------------------------------------------------------

export async function fetchCustomerInvoicesAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("sal_invoices", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const invWhere = await withScope(schema.customerInvoices, scope);

    const invBaseQuery = db
      .select({
        id: schema.customerInvoices.id,
        invoiceNumber: schema.customerInvoices.invoiceNumber,
        soId: schema.customerInvoices.soId,
        soNumber: schema.salesOrders.soNumber,
        doId: schema.customerInvoices.doId,
        doNumber: schema.deliveryOrders.doNumber,
        customerId: schema.customerInvoices.customerId,
        customerName: schema.customers.name,
        status: schema.customerInvoices.status,
        subtotal: schema.customerInvoices.subtotal,
        taxAmount: schema.customerInvoices.taxAmount,
        totalAmount: schema.customerInvoices.totalAmount,
        amountPaid: schema.customerInvoices.amountPaid,
        dueDate: schema.customerInvoices.dueDate,
        createdAt: schema.customerInvoices.createdAt,
      })
      .from(schema.customerInvoices)
      .leftJoin(schema.salesOrders, eq(schema.customerInvoices.soId, schema.salesOrders.id))
      .leftJoin(schema.deliveryOrders, eq(schema.customerInvoices.doId, schema.deliveryOrders.id))
      .leftJoin(schema.customers, eq(schema.customerInvoices.customerId, schema.customers.id));
    const invs = await (invWhere ? invBaseQuery.where(invWhere) : invBaseQuery).orderBy(
      desc(schema.customerInvoices.createdAt),
    );

    const result = [];
    for (const inv of invs) {
      const payments = await db
        .select()
        .from(schema.customerPayments)
        .where(eq(schema.customerPayments.invoiceId, inv.id))
        .orderBy(desc(schema.customerPayments.paymentDate));

      result.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        soId: inv.soId,
        soNumber: inv.soNumber || "-",
        doId: inv.doId,
        doNumber: inv.doNumber || null,
        customerId: inv.customerId,
        customerName: inv.customerName || "Unknown Customer",
        status: inv.status,
        subtotal: num(inv.subtotal),
        taxAmount: num(inv.taxAmount),
        totalAmount: num(inv.totalAmount),
        amountPaid: num(inv.amountPaid),
        remainingAmount: Math.max(num(inv.totalAmount) - num(inv.amountPaid), 0),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : "",
        createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : "",
        payments: payments.map((p) => ({
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: num(p.amount),
          paymentMethod: p.paymentMethod || "TRANSFER",
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : "",
          referenceNo: p.referenceNo || "-",
          notes: p.notes || "-",
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchCustomerInvoicesAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Faktur Penjualan." };
  }
}

export async function createCustomerInvoiceAction(params: {
  soId: string;
  doId?: string;
  dueDate?: string;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_invoices", "create");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${params.soId} AND ${schema.salesOrders.companyId} = ${companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };

    // Partial invoicing: bill only the items shipped on a specific DO.
    let invoiceSubtotal = num(so.subtotal);
    let invoiceTaxAmount = num(so.taxAmount);
    let invoiceTotalAmount = num(so.totalAmount);
    let doRecord: typeof schema.deliveryOrders.$inferSelect | null = null;

    if (params.doId) {
      const [dr] = await db
        .select()
        .from(schema.deliveryOrders)
        .where(
          sql`${schema.deliveryOrders.id} = ${params.doId} AND ${schema.deliveryOrders.companyId} = ${companyId} AND ${schema.deliveryOrders.soId} = ${so.id}`
        );
      if (!dr) return { success: false, message: "Surat Jalan tidak ditemukan untuk SO ini." };
      doRecord = dr;

      const [existingDoInv] = await db
        .select()
        .from(schema.customerInvoices)
        .where(
          and(
            eq(schema.customerInvoices.doId, params.doId),
            ne(schema.customerInvoices.status, "CANCELLED")
          )
        );
      if (existingDoInv) {
        return { success: false, message: `Faktur untuk Surat Jalan ${dr.doNumber} sudah diterbitkan (${existingDoInv.invoiceNumber}).` };
      }

      const [doItems, soItems] = await Promise.all([
        db.select().from(schema.deliveryOrderItems).where(eq(schema.deliveryOrderItems.doId, params.doId)),
        db.select().from(schema.salesOrderItems).where(eq(schema.salesOrderItems.soId, so.id)),
      ]);
      const unitPriceByProduct = new Map(soItems.map((i) => [i.productId, num(i.unitPrice)]));

      invoiceSubtotal = doItems.reduce(
        (sum, i) => sum + num(i.qtyShipped) * (unitPriceByProduct.get(i.productId) || 0),
        0,
      );
      const taxRate = num(so.subtotal) > 0 ? num(so.taxAmount) / num(so.subtotal) : 0;
      invoiceTaxAmount = invoiceSubtotal * taxRate;
      invoiceTotalAmount = invoiceSubtotal + invoiceTaxAmount;
    } else {
      // Whole-SO invoicing (existing behavior): only one such invoice per SO.
      const [existingInv] = await db
        .select()
        .from(schema.customerInvoices)
        .where(
          and(
            eq(schema.customerInvoices.soId, so.id),
            ne(schema.customerInvoices.status, "CANCELLED")
          )
        );

      if (existingInv) {
        return { success: false, message: `Faktur untuk SO ${so.soNumber} sudah diterbitkan (${existingInv.invoiceNumber}).` };
      }
    }

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    const inv = await db.transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "INV" });
      const [created] = await tx
        .insert(schema.customerInvoices)
        .values({
          tenantId,
          companyId,
          invoiceNumber,
          soId: so.id,
          doId: doRecord?.id || null,
          customerId: so.customerId,
          status: "UNPAID",
          subtotal: String(invoiceSubtotal),
          taxAmount: String(invoiceTaxAmount),
          totalAmount: String(invoiceTotalAmount),
          amountPaid: "0",
          dueDate: params.dueDate ? new Date(params.dueDate) : defaultDueDate,
        })
        .returning();

      await tx
        .update(schema.customers)
        .set({
          balanceOutstanding: sql`${schema.customers.balanceOutstanding} + ${invoiceTotalAmount}`,
        })
        .where(eq(schema.customers.id, so.customerId));

      return created;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "CustomerInvoice",
      entityId: inv.id,
    });

    revalidatePath("/sales/invoices");
    return { success: true, message: `Faktur Penjualan ${inv.invoiceNumber} berhasil diterbitkan.` };
  } catch (error) {
    console.error("createCustomerInvoiceAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menerbitkan Faktur Penjualan." };
  }
}

export async function recordCustomerPaymentAction(params: {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_invoices", "update");
    if (denied) return denied;

    const parsed = recordCustomerPaymentSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [inv] = await db
      .select()
      .from(schema.customerInvoices)
      .where(
        sql`${schema.customerInvoices.id} = ${params.invoiceId} AND ${schema.customerInvoices.companyId} = ${companyId}`
      );

    if (!inv) return { success: false, message: "Faktur Penjualan tidak ditemukan." };
    if (inv.status === "CANCELLED") return { success: false, message: "Faktur ini sudah dibatalkan." };

    const remainingAmount = num(inv.totalAmount) - num(inv.amountPaid);
    if (params.amount > remainingAmount) {
      return {
        success: false,
        message: `Jumlah pembayaran (Rp ${params.amount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${remainingAmount.toLocaleString("id-ID")}).`,
      };
    }

    const paymentNumber = await db.transaction(async (tx) => {
      const paymentNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "PAY" });
      await tx.insert(schema.customerPayments).values({
        tenantId,
        companyId,
        paymentNumber,
        invoiceId: inv.id,
        customerId: inv.customerId,
        amount: String(params.amount),
        paymentMethod: params.paymentMethod || "TRANSFER",
        referenceNo: params.referenceNo || null,
        notes: params.notes || null,
        createdById: user.id,
      });

      const newAmountPaid = num(inv.amountPaid) + params.amount;
      const totalAmt = num(inv.totalAmount);
      let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
      if (newAmountPaid >= totalAmt) {
        newStatus = "PAID";
      }

      await tx
        .update(schema.customerInvoices)
        .set({
          amountPaid: String(newAmountPaid),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.customerInvoices.id, inv.id));

      await tx
        .update(schema.customers)
        .set({
          balanceOutstanding: sql`GREATEST(0, ${schema.customers.balanceOutstanding} - ${params.amount})`,
        })
        .where(eq(schema.customers.id, inv.customerId));

      return paymentNumber;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "POST",
      entity: "CustomerPayment",
      entityId: inv.id,
    });

    revalidatePath("/sales/invoices");
    return { success: true, message: `Pembayaran ${paymentNumber} sejumlah Rp ${params.amount.toLocaleString("id-ID")} berhasil dicatat.` };
  } catch (error) {
    console.error("recordCustomerPaymentAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mencatat pembayaran." };
  }
}

// -----------------------------------------------------------------------------
// 5. SALES RETURNS (Retur Penjualan) - for goods returned after delivery,
//    including after the customer invoice has already been issued/paid.
// -----------------------------------------------------------------------------

export async function fetchSalesReturnsAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("sal_deliveries", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const retWhere = await withScope(schema.salesReturns, scope);

    const retBaseQuery = db
      .select({
        id: schema.salesReturns.id,
        returnNumber: schema.salesReturns.returnNumber,
        soId: schema.salesReturns.soId,
        soNumber: schema.salesOrders.soNumber,
        customerId: schema.salesReturns.customerId,
        customerName: schema.customers.name,
        warehouseId: schema.salesReturns.warehouseId,
        warehouseName: schema.warehouses.name,
        status: schema.salesReturns.status,
        reason: schema.salesReturns.reason,
        createdAt: schema.salesReturns.createdAt,
      })
      .from(schema.salesReturns)
      .leftJoin(schema.salesOrders, eq(schema.salesReturns.soId, schema.salesOrders.id))
      .leftJoin(schema.customers, eq(schema.salesReturns.customerId, schema.customers.id))
      .leftJoin(schema.warehouses, eq(schema.salesReturns.warehouseId, schema.warehouses.id));
    const returns = await (retWhere ? retBaseQuery.where(retWhere) : retBaseQuery).orderBy(
      desc(schema.salesReturns.createdAt),
    );

    const result = [];
    for (const r of returns) {
      const items = await db
        .select({
          id: schema.salesReturnItems.id,
          productId: schema.salesReturnItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          qtyReturned: schema.salesReturnItems.qtyReturned,
          unitPrice: schema.salesReturnItems.unitPrice,
        })
        .from(schema.salesReturnItems)
        .leftJoin(schema.products, eq(schema.salesReturnItems.productId, schema.products.id))
        .where(eq(schema.salesReturnItems.returnId, r.id));

      result.push({
        id: r.id,
        returnNumber: r.returnNumber,
        soId: r.soId,
        soNumber: r.soNumber || "-",
        customerId: r.customerId,
        customerName: r.customerName || "Unknown Customer",
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName || "-",
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          qtyReturned: num(i.qtyReturned),
          unitPrice: num(i.unitPrice),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchSalesReturnsAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Retur Penjualan." };
  }
}

export async function createSalesReturnAction(params: {
  soId: string;
  reason: string;
  items: Array<{ productId: string; qtyReturned: number; batchNo?: string }>;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sal_deliveries", "create");
    if (denied) return denied;

    const parsed = createSalesReturnSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${params.soId} AND ${schema.salesOrders.companyId} = ${companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (!so.warehouseId) return { success: false, message: "Gudang SO tidak valid." };

    const soItems = await db
      .select()
      .from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.soId, so.id));
    const soItemMap = new Map(soItems.map((i) => [i.productId, i]));

    const priorReturnedRows = await db
      .select({
        productId: schema.salesReturnItems.productId,
        qtyReturned: schema.salesReturnItems.qtyReturned,
      })
      .from(schema.salesReturnItems)
      .innerJoin(schema.salesReturns, eq(schema.salesReturnItems.returnId, schema.salesReturns.id))
      .where(
        and(
          eq(schema.salesReturns.soId, so.id),
          ne(schema.salesReturns.status, "CANCELLED")
        )
      );
    const priorReturnedMap = new Map<string, number>();
    for (const row of priorReturnedRows) {
      priorReturnedMap.set(row.productId, (priorReturnedMap.get(row.productId) || 0) + num(row.qtyReturned));
    }

    for (const item of params.items) {
      const soItem = soItemMap.get(item.productId);
      const delivered = num(soItem?.qtyDelivered);
      const alreadyReturned = priorReturnedMap.get(item.productId) || 0;
      const availableToReturn = delivered - alreadyReturned;
      if (item.qtyReturned <= 0 || item.qtyReturned > availableToReturn) {
        return {
          success: false,
          message: `Qty retur untuk produk melebihi qty yang sudah dikirim & belum diretur (tersedia untuk diretur: ${availableToReturn}).`,
        };
      }
    }

    const [existingInv] = await db
      .select()
      .from(schema.customerInvoices)
      .where(
        and(
          eq(schema.customerInvoices.soId, so.id),
          ne(schema.customerInvoices.status, "CANCELLED")
        )
      );

    const newReturn = await db.transaction(async (tx) => {
      const returnNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "SRET" });
      const [ret] = await tx
        .insert(schema.salesReturns)
        .values({
          tenantId,
          companyId,
          returnNumber,
          soId: so.id,
          customerId: so.customerId,
          warehouseId: so.warehouseId!,
          status: "COMPLETED",
          reason: params.reason,
          createdById: user.id,
        })
        .returning();

      const ctx: MovementContext = {
        tenantId,
        companyId,
        userId: user.id,
        refType: "SALES_RETURN",
        refId: ret.id,
        note: `Retur Penjualan ${returnNumber} untuk SO ${so.soNumber}: ${params.reason}`,
      };

      let returnedValue = 0;
      for (const item of params.items) {
        const soItem = soItemMap.get(item.productId)!;
        const unitPrice = num(soItem.unitPrice);
        returnedValue += unitPrice * item.qtyReturned;

        await tx.insert(schema.salesReturnItems).values({
          tenantId,
          companyId,
          returnId: ret.id,
          productId: item.productId,
          batchNo: item.batchNo || null,
          qtyReturned: String(item.qtyReturned),
          unitPrice: String(unitPrice),
        });

        await receiveStock(ctx, {
          productId: item.productId,
          warehouseId: so.warehouseId!,
          qty: item.qtyReturned,
          unitCost: unitPrice,
          batch: item.batchNo ? { batchNo: item.batchNo } : null,
        }, tx);

        await tx
          .update(schema.salesOrderItems)
          .set({
            qtyDelivered: sql`GREATEST(0, ${schema.salesOrderItems.qtyDelivered} - ${item.qtyReturned})`,
          })
          .where(
            and(
              eq(schema.salesOrderItems.soId, so.id),
              eq(schema.salesOrderItems.productId, item.productId)
            )
          );
      }

      const updatedSoItems = await tx
        .select()
        .from(schema.salesOrderItems)
        .where(eq(schema.salesOrderItems.soId, so.id));
      const anyDelivered = updatedSoItems.some((i) => num(i.qtyDelivered) > 0);
      const allDelivered = updatedSoItems.every((i) => num(i.qtyDelivered) >= num(i.qtyOrdered));
      await tx
        .update(schema.salesOrders)
        .set({
          status: allDelivered ? "DELIVERED" : anyDelivered ? "PARTIALLY_DELIVERED" : "CONFIRMED",
          updatedAt: new Date(),
        })
        .where(eq(schema.salesOrders.id, so.id));

      if (existingInv && returnedValue > 0) {
        await tx
          .update(schema.customers)
          .set({
            balanceOutstanding: sql`GREATEST(0, ${schema.customers.balanceOutstanding} - ${returnedValue})`,
          })
          .where(eq(schema.customers.id, so.customerId));
      }

      return ret;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "SalesReturn",
      entityId: newReturn.id,
    });

    revalidatePath("/sales/orders");
    revalidatePath("/sales/deliveries");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return { success: true, message: `Retur Penjualan ${newReturn.returnNumber} berhasil dicatat & stok dikembalikan.` };
  } catch (error) {
    console.error("createSalesReturnAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mencatat Retur Penjualan." };
  }
}
