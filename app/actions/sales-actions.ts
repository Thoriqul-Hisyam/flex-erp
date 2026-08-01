"use server";

import { db, schema } from "@/db";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { issueStock, type MovementContext } from "@/lib/inventory/stock-engine";
import { revalidatePath } from "next/cache";

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
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const sqs = await db
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
      .leftJoin(schema.branches, eq(schema.salesQuotations.branchId, schema.branches.id))
      .where(eq(schema.salesQuotations.companyId, user.companyId))
      .orderBy(desc(schema.salesQuotations.createdAt));

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
  } catch (error: any) {
    console.error("fetchSalesQuotationsAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Penawaran Harga (Sales Quotation)." };
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

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastSq] = await db
      .select({ sqNumber: schema.salesQuotations.sqNumber })
      .from(schema.salesQuotations)
      .where(eq(schema.salesQuotations.companyId, companyId))
      .orderBy(desc(schema.salesQuotations.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastSq?.sqNumber) {
      const parts = lastSq.sqNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const sqNumber = `SQ-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

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
      const [sq] = await tx
        .insert(schema.salesQuotations)
        .values({
          tenantId,
          companyId,
          sqNumber,
          customerId: params.customerId,
          branchId: params.branchId || null,
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
    return { success: true, message: `Sales Quotation ${sqNumber} berhasil dibuat.` };
  } catch (error: any) {
    console.error("createSalesQuotationAction Error:", error);
    return { success: false, message: error.message || "Gagal membuat Sales Quotation." };
  }
}

export async function acceptSalesQuotationAction(sqId: string): Promise<ActionResult> {
  try {
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
  } catch (error: any) {
    console.error("acceptSalesQuotationAction Error:", error);
    return { success: false, message: error.message || "Gagal menyetujui Penawaran." };
  }
}

// -----------------------------------------------------------------------------
// 2. SALES ORDERS (SO / Pesanan Penjualan & Stock Reservation)
// -----------------------------------------------------------------------------

export async function fetchSalesOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const sos = await db
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
      .leftJoin(schema.warehouses, eq(schema.salesOrders.warehouseId, schema.warehouses.id))
      .where(eq(schema.salesOrders.companyId, user.companyId))
      .orderBy(desc(schema.salesOrders.createdAt));

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
  } catch (error: any) {
    console.error("fetchSalesOrdersAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Sales Orders." };
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
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.customerId || !params.warehouseId) {
      return { success: false, message: "Customer dan Gudang pengiriman wajib dipilih." };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk pesanan harus diisi." };
    }

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastSo] = await db
      .select({ soNumber: schema.salesOrders.soNumber })
      .from(schema.salesOrders)
      .where(eq(schema.salesOrders.companyId, companyId))
      .orderBy(desc(schema.salesOrders.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastSo?.soNumber) {
      const parts = lastSo.soNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const soNumber = `SO-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

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
      const [so] = await tx
        .insert(schema.salesOrders)
        .values({
          tenantId,
          companyId,
          soNumber,
          sqId: params.sqId || null,
          customerId: params.customerId,
          branchId: params.branchId || null,
          warehouseId: params.warehouseId,
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
    return { success: true, message: `Sales Order ${soNumber} berhasil dibuat.` };
  } catch (error: any) {
    console.error("createSalesOrderAction Error:", error);
    return { success: false, message: error.message || "Gagal membuat Sales Order." };
  }
}

export async function confirmSalesOrderAction(soId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [so] = await db
      .select()
      .from(schema.salesOrders)
      .where(
        sql`${schema.salesOrders.id} = ${soId} AND ${schema.salesOrders.companyId} = ${user.companyId}`
      );

    if (!so) return { success: false, message: "Sales Order tidak ditemukan." };
    if (so.status !== "DRAFT") return { success: false, message: "SO telah dikonfirmasi sebelumnya." };

    const items = await db
      .select()
      .from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.soId, so.id));

    await db.transaction(async (tx) => {
      await tx
        .update(schema.salesOrders)
        .set({ status: "CONFIRMED", updatedAt: new Date() })
        .where(eq(schema.salesOrders.id, so.id));

      // Reserve stock in warehouse
      if (so.warehouseId) {
        for (const item of items) {
          const qty = num(item.qtyOrdered);
          if (qty <= 0) continue;

          const [existingStock] = await tx
            .select()
            .from(schema.warehouseStocks)
            .where(
              and(
                eq(schema.warehouseStocks.warehouseId, so.warehouseId),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );

          if (existingStock) {
            await tx
              .update(schema.warehouseStocks)
              .set({
                qtyReserved: sql`${schema.warehouseStocks.qtyReserved} + ${qty}`,
              })
              .where(eq(schema.warehouseStocks.id, existingStock.id));
          } else {
            await tx.insert(schema.warehouseStocks).values({
              tenantId: user.tenantId!,
              companyId: user.companyId!,
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

    revalidatePath("/sales/orders");
    return { success: true, message: `Sales Order ${so.soNumber} berhasil dikonfirmasi (Stok Dialokasikan).` };
  } catch (error: any) {
    console.error("confirmSalesOrderAction Error:", error);
    return { success: false, message: error.message || "Gagal mengonfirmasi Sales Order." };
  }
}

// -----------------------------------------------------------------------------
// 3. DELIVERY ORDERS (DO / Surat Jalan & Stock OUT Execution)
// -----------------------------------------------------------------------------

export async function fetchDeliveryOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const dos = await db
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
      .leftJoin(schema.warehouses, eq(schema.deliveryOrders.warehouseId, schema.warehouses.id))
      .where(eq(schema.deliveryOrders.companyId, user.companyId))
      .orderBy(desc(schema.deliveryOrders.createdAt));

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
  } catch (error: any) {
    console.error("fetchDeliveryOrdersAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Surat Jalan (Delivery Orders)." };
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
    if (!so.warehouseId) return { success: false, message: "Gudang pengiriman SO tidak valid." };

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastDo] = await db
      .select({ doNumber: schema.deliveryOrders.doNumber })
      .from(schema.deliveryOrders)
      .where(eq(schema.deliveryOrders.companyId, companyId))
      .orderBy(desc(schema.deliveryOrders.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastDo?.doNumber) {
      const parts = lastDo.doNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const doNumber = `DO-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    const newDo = await db.transaction(async (tx) => {
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

      return doRecord;
    });

    // Execute Stock OUT via Stock Engine for each item
    const ctx: MovementContext = {
      tenantId,
      companyId,
      userId: user.id,
      refType: "DELIVERY_ORDER",
      refId: newDo.id,
      note: `Pengiriman Barang ${doNumber} untuk SO ${so.soNumber}`,
    };

    for (const item of params.items) {
      if (item.qtyShipped <= 0) continue;

      await issueStock(ctx, {
        productId: item.productId,
        warehouseId: so.warehouseId,
        qty: item.qtyShipped,
        batchNo: item.batchNo || undefined,
      });

      // Reduce qtyReserved in warehouseStocks
      await db
        .update(schema.warehouseStocks)
        .set({
          qtyReserved: sql`GREATEST(0, ${schema.warehouseStocks.qtyReserved} - ${item.qtyShipped})`,
        })
        .where(
          and(
            eq(schema.warehouseStocks.warehouseId, so.warehouseId),
            eq(schema.warehouseStocks.productId, item.productId)
          )
        );

      // Update SO item qtyDelivered
      await db
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

    // Update SO status
    const soItems = await db
      .select()
      .from(schema.salesOrderItems)
      .where(eq(schema.salesOrderItems.soId, so.id));

    const allDelivered = soItems.every((i) => num(i.qtyDelivered) >= num(i.qtyOrdered));
    await db
      .update(schema.salesOrders)
      .set({
        status: allDelivered ? "DELIVERED" : "PARTIALLY_DELIVERED",
        updatedAt: new Date(),
      })
      .where(eq(schema.salesOrders.id, so.id));

    revalidatePath("/sales/deliveries");
    revalidatePath("/sales/orders");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return { success: true, message: `Surat Jalan ${doNumber} berhasil terbit & Stok Berhasil Keluar (Stock OUT).` };
  } catch (error: any) {
    console.error("createDeliveryOrderAction Error:", error);
    return { success: false, message: error.message || "Gagal menerbitkan Surat Jalan." };
  }
}

// -----------------------------------------------------------------------------
// 4. CUSTOMER INVOICES & PAYMENTS (Faktur Penjualan & Pelunasan)
// -----------------------------------------------------------------------------

export async function fetchCustomerInvoicesAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const invs = await db
      .select({
        id: schema.customerInvoices.id,
        invoiceNumber: schema.customerInvoices.invoiceNumber,
        soId: schema.customerInvoices.soId,
        soNumber: schema.salesOrders.soNumber,
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
      .leftJoin(schema.customers, eq(schema.customerInvoices.customerId, schema.customers.id))
      .where(eq(schema.customerInvoices.companyId, user.companyId))
      .orderBy(desc(schema.customerInvoices.createdAt));

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
  } catch (error: any) {
    console.error("fetchCustomerInvoicesAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Faktur Penjualan." };
  }
}

export async function createCustomerInvoiceAction(params: {
  soId: string;
  dueDate?: string;
}): Promise<ActionResult> {
  try {
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

    // Check if invoice already exists
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

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastInv] = await db
      .select({ invoiceNumber: schema.customerInvoices.invoiceNumber })
      .from(schema.customerInvoices)
      .where(eq(schema.customerInvoices.companyId, companyId))
      .orderBy(desc(schema.customerInvoices.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastInv?.invoiceNumber) {
      const parts = lastInv.invoiceNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const invoiceNumber = `INV-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    const [inv] = await db
      .insert(schema.customerInvoices)
      .values({
        tenantId,
        companyId,
        invoiceNumber,
        soId: so.id,
        customerId: so.customerId,
        status: "UNPAID",
        subtotal: String(so.subtotal),
        taxAmount: String(so.taxAmount),
        totalAmount: String(so.totalAmount),
        amountPaid: "0",
        dueDate: params.dueDate ? new Date(params.dueDate) : defaultDueDate,
      })
      .returning();

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "CustomerInvoice",
      entityId: inv.id,
    });

    revalidatePath("/sales/invoices");
    return { success: true, message: `Faktur Penjualan ${invoiceNumber} berhasil diterbitkan.` };
  } catch (error: any) {
    console.error("createCustomerInvoiceAction Error:", error);
    return { success: false, message: error.message || "Gagal menerbitkan Faktur Penjualan." };
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
    if (params.amount <= 0) return { success: false, message: "Jumlah pembayaran harus > 0." };

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastPay] = await db
      .select({ paymentNumber: schema.customerPayments.paymentNumber })
      .from(schema.customerPayments)
      .where(eq(schema.customerPayments.companyId, companyId))
      .orderBy(desc(schema.customerPayments.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastPay?.paymentNumber) {
      const parts = lastPay.paymentNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const paymentNumber = `PAY-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    await db.transaction(async (tx) => {
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
    });

    revalidatePath("/sales/invoices");
    return { success: true, message: `Pembayaran ${paymentNumber} sejumlah Rp ${params.amount.toLocaleString("id-ID")} berhasil dicatat.` };
  } catch (error: any) {
    console.error("recordCustomerPaymentAction Error:", error);
    return { success: false, message: error.message || "Gagal mencatat pembayaran." };
  }
}
