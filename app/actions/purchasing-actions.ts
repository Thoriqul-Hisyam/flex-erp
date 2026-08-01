"use server";

import { db, schema } from "@/db";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { receiveStock, type MovementContext } from "@/lib/inventory/stock-engine";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

function num(val: unknown): number {
  return Number(val || 0);
}

// -----------------------------------------------------------------------------
// 1. PURCHASE REQUESTS (PR)
// -----------------------------------------------------------------------------

export async function fetchPurchaseRequestsAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const prs = await db
      .select({
        id: schema.purchaseRequests.id,
        prNumber: schema.purchaseRequests.prNumber,
        requestType: schema.purchaseRequests.requestType,
        branchId: schema.purchaseRequests.branchId,
        branchName: schema.branches.name,
        department: schema.purchaseRequests.department,
        status: schema.purchaseRequests.status,
        notes: schema.purchaseRequests.notes,
        requestedById: schema.purchaseRequests.requestedById,
        createdAt: schema.purchaseRequests.createdAt,
        updatedAt: schema.purchaseRequests.updatedAt,
      })
      .from(schema.purchaseRequests)
      .leftJoin(schema.branches, eq(schema.purchaseRequests.branchId, schema.branches.id))
      .where(eq(schema.purchaseRequests.companyId, user.companyId))
      .orderBy(desc(schema.purchaseRequests.createdAt));

    const result = [];
    for (const pr of prs) {
      const items = await db
        .select({
          id: schema.purchaseRequestItems.id,
          productId: schema.purchaseRequestItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          qtyRequested: schema.purchaseRequestItems.qtyRequested,
          unitCost: schema.purchaseRequestItems.unitCost,
          notes: schema.purchaseRequestItems.notes,
        })
        .from(schema.purchaseRequestItems)
        .leftJoin(schema.products, eq(schema.purchaseRequestItems.productId, schema.products.id))
        .where(eq(schema.purchaseRequestItems.prId, pr.id));

      let requestedByName = "System";
      if (pr.requestedById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, pr.requestedById));
        if (u) requestedByName = u.name;
      }

      const [po] = await db
        .select({ id: schema.purchaseOrders.id, poNumber: schema.purchaseOrders.poNumber })
        .from(schema.purchaseOrders)
        .where(
          sql`${schema.purchaseOrders.prId} = ${pr.id} AND ${schema.purchaseOrders.status} != 'CANCELLED'`
        );

      result.push({
        id: pr.id,
        prNumber: pr.prNumber,
        poId: po?.id || null,
        poNumber: po?.poNumber || null,
        requestType: pr.requestType || "FOR_RESALE",
        branchId: pr.branchId,
        branchName: pr.branchName || "-",
        department: pr.department || "-",
        status: pr.status,
        notes: pr.notes,
        totalItems: items.length,
        requestedByName,
        createdAt: pr.createdAt ? new Date(pr.createdAt).toISOString() : "",
        updatedAt: pr.updatedAt ? new Date(pr.updatedAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          qtyRequested: num(i.qtyRequested),
          unitCost: num(i.unitCost),
          notes: i.notes,
        })),
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("fetchPurchaseRequestsAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Purchase Requests." };
  }
}

export async function createPurchaseRequestAction(params: {
  requestType?: "FOR_RESALE" | "INTERNAL_USE";
  branchId?: string;
  department?: string;
  notes?: string;
  status?: "DRAFT" | "SUBMITTED";
  items: Array<{ productId: string; qtyRequested: number; unitCost?: number; notes?: string }>;
}): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk harus diisi." };
    }

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastPr] = await db
      .select({ prNumber: schema.purchaseRequests.prNumber })
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.companyId, companyId))
      .orderBy(desc(schema.purchaseRequests.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastPr?.prNumber) {
      const parts = lastPr.prNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const prNumber = `PR-${dateStr}-${String(nextSeq).padStart(4, "0")}`;
    const initialStatus = params.status || "DRAFT";

    const newPr = await db.transaction(async (tx) => {
      const [pr] = await tx
        .insert(schema.purchaseRequests)
        .values({
          tenantId,
          companyId,
          prNumber,
          requestType: params.requestType || "FOR_RESALE",
          branchId: params.branchId || null,
          requestedById: user.id,
          department: params.department || "General",
          status: initialStatus,
          notes: params.notes || null,
        })
        .returning();

      await tx.insert(schema.purchaseRequestItems).values(
        params.items.map((i) => ({
          tenantId,
          companyId,
          prId: pr.id,
          productId: i.productId,
          qtyRequested: String(i.qtyRequested),
          unitCost: String(i.unitCost || 0),
          notes: i.notes || null,
        }))
      );

      return pr;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "PurchaseRequest",
      entityId: newPr.id,
    });

    revalidatePath("/purchasing/requests");
    return {
      success: true,
      message: `Purchase Request ${prNumber} berhasil dibuat dengan status ${initialStatus}.`,
    };
  } catch (error: any) {
    console.error("createPurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal membuat Purchase Request." };
  }
}

export async function updatePurchaseRequestAction(
  prId: string,
  params: {
    requestType?: "FOR_RESALE" | "INTERNAL_USE";
    branchId?: string;
    department?: string;
    notes?: string;
    items: Array<{ productId: string; qtyRequested: number; unitCost?: number; notes?: string }>;
  }
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [existingPr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    if (!existingPr) {
      return { success: false, message: "Purchase Request tidak ditemukan." };
    }
    if (existingPr.status !== "DRAFT") {
      return { success: false, message: "Hanya Purchase Request berstatus DRAFT yang dapat di-edit." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.purchaseRequests)
        .set({
          requestType: params.requestType || "FOR_RESALE",
          branchId: params.branchId || null,
          department: params.department || existingPr.department,
          notes: params.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseRequests.id, prId));

      await tx
        .delete(schema.purchaseRequestItems)
        .where(eq(schema.purchaseRequestItems.prId, prId));

      await tx.insert(schema.purchaseRequestItems).values(
        params.items.map((i) => ({
          tenantId: user.tenantId!,
          companyId: user.companyId!,
          prId: prId,
          productId: i.productId,
          qtyRequested: String(i.qtyRequested),
          unitCost: String(i.unitCost || 0),
          notes: i.notes || null,
        }))
      );
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: `Purchase Request ${existingPr.prNumber} berhasil diperbarui.` };
  } catch (error: any) {
    console.error("updatePurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal memperbarui Purchase Request." };
  }
}

export async function cancelPurchaseRequestAction(prId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [existingPr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    if (!existingPr) {
      return { success: false, message: "Purchase Request tidak ditemukan." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(schema.purchaseRequests.id, prId));

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: `Purchase Request ${existingPr.prNumber} berhasil dibatalkan.` };
  } catch (error: any) {
    console.error("cancelPurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal membatalkan Purchase Request." };
  }
}

export async function submitPurchaseRequestAction(prId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({ status: "SUBMITTED", updatedAt: new Date() })
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: "Purchase Request berhasil diajukan (Submitted)." };
  } catch (error: any) {
    console.error("submitPurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal mengajukan Purchase Request." };
  }
}

export async function approvePurchaseRequestAction(prId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({ status: "APPROVED", updatedAt: new Date() })
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: "Purchase Request berhasil disetujui (Approved)." };
  } catch (error: any) {
    console.error("approvePurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal menyetujui Purchase Request." };
  }
}

export async function rejectPurchaseRequestAction(
  prId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({
        status: "REJECTED",
        notes: reason ? sql`CONCAT(COALESCE(notes, ''), ' [Alasan Penolakan: ', ${reason}, ']')` : schema.purchaseRequests.notes,
        updatedAt: new Date(),
      })
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: "Purchase Request ditolak (Rejected)." };
  } catch (error: any) {
    console.error("rejectPurchaseRequestAction Error:", error);
    return { success: false, message: error.message || "Gagal menolak Purchase Request." };
  }
}

// -----------------------------------------------------------------------------
// 2. PURCHASE ORDERS (PO)
// -----------------------------------------------------------------------------

export async function fetchPurchaseOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const pos = await db
      .select({
        id: schema.purchaseOrders.id,
        poNumber: schema.purchaseOrders.poNumber,
        poType: schema.purchaseOrders.poType,
        supplierId: schema.purchaseOrders.supplierId,
        supplierName: schema.suppliers.name,
        branchId: schema.purchaseOrders.branchId,
        branchName: schema.branches.name,
        warehouseId: schema.purchaseOrders.warehouseId,
        warehouseName: schema.warehouses.name,
        prId: schema.purchaseOrders.prId,
        prNumber: schema.purchaseRequests.prNumber,
        status: schema.purchaseOrders.status,
        subtotal: schema.purchaseOrders.subtotal,
        taxAmount: schema.purchaseOrders.taxAmount,
        totalAmount: schema.purchaseOrders.totalAmount,
        notes: schema.purchaseOrders.notes,
        createdById: schema.purchaseOrders.createdById,
        issuedAt: schema.purchaseOrders.issuedAt,
        createdAt: schema.purchaseOrders.createdAt,
        updatedAt: schema.purchaseOrders.updatedAt,
      })
      .from(schema.purchaseOrders)
      .leftJoin(schema.suppliers, eq(schema.purchaseOrders.supplierId, schema.suppliers.id))
      .leftJoin(schema.branches, eq(schema.purchaseOrders.branchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.purchaseOrders.warehouseId, schema.warehouses.id))
      .leftJoin(schema.purchaseRequests, eq(schema.purchaseOrders.prId, schema.purchaseRequests.id))
      .where(eq(schema.purchaseOrders.companyId, user.companyId))
      .orderBy(desc(schema.purchaseOrders.createdAt));

    const result = [];
    for (const po of pos) {
      const items = await db
        .select({
          id: schema.purchaseOrderItems.id,
          productId: schema.purchaseOrderItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          qtyOrdered: schema.purchaseOrderItems.qtyOrdered,
          qtyReceived: schema.purchaseOrderItems.qtyReceived,
          unitPrice: schema.purchaseOrderItems.unitPrice,
          totalPrice: schema.purchaseOrderItems.totalPrice,
        })
        .from(schema.purchaseOrderItems)
        .leftJoin(schema.products, eq(schema.purchaseOrderItems.productId, schema.products.id))
        .where(eq(schema.purchaseOrderItems.poId, po.id));

      let createdByName = "System";
      if (po.createdById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, po.createdById));
        if (u) createdByName = u.name;
      }

      result.push({
        id: po.id,
        poNumber: po.poNumber,
        poType: po.poType || "FOR_RESALE",
        supplierId: po.supplierId,
        supplierName: po.supplierName || "Unknown Supplier",
        branchId: po.branchId,
        branchName: po.branchName || "-",
        warehouseId: po.warehouseId,
        warehouseName: po.warehouseName || "-",
        prId: po.prId,
        prNumber: po.prNumber || null,
        status: po.status,
        subtotal: num(po.subtotal),
        taxAmount: num(po.taxAmount),
        totalAmount: num(po.totalAmount),
        notes: po.notes,
        createdByName,
        issuedAt: po.issuedAt ? new Date(po.issuedAt).toISOString() : "",
        createdAt: po.createdAt ? new Date(po.createdAt).toISOString() : "",
        updatedAt: po.updatedAt ? new Date(po.updatedAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          qtyOrdered: num(i.qtyOrdered),
          qtyReceived: num(i.qtyReceived),
          unitPrice: num(i.unitPrice),
          totalPrice: num(i.totalPrice),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("fetchPurchaseOrdersAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Purchase Orders." };
  }
}

export async function createPurchaseOrderAction(params: {
  supplierId: string;
  poType?: "FOR_RESALE" | "INTERNAL_USE";
  branchId?: string;
  warehouseId?: string;
  prId?: string;
  taxRate?: number;
  notes?: string;
  items: Array<{ productId: string; qtyOrdered: number; unitPrice: number }>;
}): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.supplierId) {
      return { success: false, message: "Supplier wajib dipilih." };
    }
    const poType = params.poType || "FOR_RESALE";
    if (poType === "FOR_RESALE" && !params.warehouseId) {
      return { success: false, message: "Gudang Tujuan wajib dipilih untuk pengadaan barang dagang (FOR_RESALE)." };
    }
    if (poType === "INTERNAL_USE" && !params.branchId) {
      return { success: false, message: "Cabang Tujuan wajib dipilih untuk penggunaan internal (INTERNAL_USE)." };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk harus diisi." };
    }

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastPo] = await db
      .select({ poNumber: schema.purchaseOrders.poNumber })
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.companyId, companyId))
      .orderBy(desc(schema.purchaseOrders.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastPo?.poNumber) {
      const parts = lastPo.poNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const poNumber = `PO-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    const subtotal = params.items.reduce(
      (sum, i) => sum + i.qtyOrdered * i.unitPrice,
      0
    );
    const taxRate = params.taxRate ?? 11;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const newPo = await db.transaction(async (tx) => {
      const [po] = await tx
        .insert(schema.purchaseOrders)
        .values({
          tenantId,
          companyId,
          poNumber,
          poType,
          supplierId: params.supplierId,
          branchId: params.branchId || null,
          warehouseId: params.warehouseId || null,
          prId: params.prId || null,
          status: "DRAFT",
          subtotal: String(subtotal),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(schema.purchaseOrderItems).values(
        params.items.map((i) => ({
          tenantId,
          companyId,
          poId: po.id,
          productId: i.productId,
          qtyOrdered: String(i.qtyOrdered),
          qtyReceived: "0",
          unitPrice: String(i.unitPrice),
          totalPrice: String(i.qtyOrdered * i.unitPrice),
        }))
      );

      return po;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "PurchaseOrder",
      entityId: newPo.id,
    });

    revalidatePath("/purchasing/orders");
    return { success: true, message: `Purchase Order ${poNumber} berhasil dibuat.` };
  } catch (error: any) {
    console.error("createPurchaseOrderAction Error:", error);
    return { success: false, message: error.message || "Gagal membuat Purchase Order." };
  }
}

export async function issuePurchaseOrderAction(poId: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [po] = await db
      .select()
      .from(schema.purchaseOrders)
      .where(
        sql`${schema.purchaseOrders.id} = ${poId} AND ${schema.purchaseOrders.companyId} = ${user.companyId}`
      );

    if (!po) return { success: false, message: "PO tidak ditemukan." };

    await db
      .update(schema.purchaseOrders)
      .set({ status: "ISSUED", issuedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.purchaseOrders.id, poId));

    // Update qtyIncoming in warehouse_stocks
    const items = await db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, poId));

    for (const item of items) {
      await db
        .update(schema.warehouseStocks)
        .set({
          qtyIncoming: sql`${schema.warehouseStocks.qtyIncoming} + ${item.qtyOrdered}`,
        })
        .where(
          sql`${schema.warehouseStocks.companyId} = ${user.companyId} AND ${schema.warehouseStocks.warehouseId} = ${po.warehouseId} AND ${schema.warehouseStocks.productId} = ${item.productId}`
        );
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "POST",
      entity: "PurchaseOrder",
      entityId: poId,
    });

    revalidatePath("/purchasing/orders");
    return { success: true, message: `Purchase Order ${po.poNumber} diterbitkan (ISSUED).` };
  } catch (error: any) {
    console.error("issuePurchaseOrderAction Error:", error);
    return { success: false, message: error.message || "Gagal menerbitkan Purchase Order." };
  }
}

// -----------------------------------------------------------------------------
// 3. GOODS RECEIPTS (GR / Stock IN)
// -----------------------------------------------------------------------------

export async function fetchGoodsReceiptsAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const grs = await db
      .select({
        id: schema.goodsReceipts.id,
        grNumber: schema.goodsReceipts.grNumber,
        poId: schema.goodsReceipts.poId,
        poNumber: schema.purchaseOrders.poNumber,
        poType: schema.purchaseOrders.poType,
        branchName: schema.branches.name,
        warehouseId: schema.goodsReceipts.warehouseId,
        warehouseName: schema.warehouses.name,
        supplierId: schema.goodsReceipts.supplierId,
        supplierName: schema.suppliers.name,
        status: schema.goodsReceipts.status,
        receivedById: schema.goodsReceipts.receivedById,
        receivedAt: schema.goodsReceipts.receivedAt,
        notes: schema.goodsReceipts.notes,
        createdAt: schema.goodsReceipts.createdAt,
      })
      .from(schema.goodsReceipts)
      .leftJoin(schema.purchaseOrders, eq(schema.goodsReceipts.poId, schema.purchaseOrders.id))
      .leftJoin(schema.branches, eq(schema.purchaseOrders.branchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.goodsReceipts.warehouseId, schema.warehouses.id))
      .leftJoin(schema.suppliers, eq(schema.goodsReceipts.supplierId, schema.suppliers.id))
      .where(eq(schema.goodsReceipts.companyId, user.companyId))
      .orderBy(desc(schema.goodsReceipts.createdAt));

    const result = [];
    for (const gr of grs) {
      const items = await db
        .select({
          id: schema.goodsReceiptItems.id,
          productId: schema.goodsReceiptItems.productId,
          productName: schema.products.name,
          productSku: schema.products.sku,
          productUnit: schema.products.unit,
          batchNo: schema.goodsReceiptItems.batchNo,
          expiryDate: schema.goodsReceiptItems.expiryDate,
          qtyReceived: schema.goodsReceiptItems.qtyReceived,
          unitCost: schema.goodsReceiptItems.unitCost,
        })
        .from(schema.goodsReceiptItems)
        .leftJoin(schema.products, eq(schema.goodsReceiptItems.productId, schema.products.id))
        .where(eq(schema.goodsReceiptItems.grId, gr.id));

      let receivedByName = "System";
      if (gr.receivedById) {
        const [u] = await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, gr.receivedById));
        if (u) receivedByName = u.name;
      }

      result.push({
        id: gr.id,
        grNumber: gr.grNumber,
        poId: gr.poId,
        poNumber: gr.poNumber || "-",
        warehouseId: gr.warehouseId,
        warehouseName:
          gr.warehouseName ||
          (gr.branchName ? `${gr.branchName} (Kantor)` : "Kantor Pusat (Internal)"),
        supplierId: gr.supplierId,
        supplierName: gr.supplierName || "Unknown Supplier",
        status: gr.status,
        receivedByName,
        receivedAt: gr.receivedAt ? new Date(gr.receivedAt).toISOString() : "",
        notes: gr.notes,
        createdAt: gr.createdAt ? new Date(gr.createdAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          batchNo: i.batchNo,
          expiryDate: i.expiryDate ? new Date(i.expiryDate).toISOString() : null,
          qtyReceived: num(i.qtyReceived),
          unitCost: num(i.unitCost),
        })),
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("fetchGoodsReceiptsAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Goods Receipts." };
  }
}

export async function createGoodsReceiptAction(params: {
  poId: string;
  notes?: string;
  items: Array<{
    productId: string;
    qtyReceived: number;
    unitCost: number;
    batchNo?: string;
    expiryDate?: string;
  }>;
}): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [po] = await db
      .select()
      .from(schema.purchaseOrders)
      .where(
        sql`${schema.purchaseOrders.id} = ${params.poId} AND ${schema.purchaseOrders.companyId} = ${companyId}`
      );

    if (!po) return { success: false, message: "PO tidak ditemukan." };
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item penerimaan barang harus diisi." };
    }

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastGr] = await db
      .select({ grNumber: schema.goodsReceipts.grNumber })
      .from(schema.goodsReceipts)
      .where(eq(schema.goodsReceipts.companyId, companyId))
      .orderBy(desc(schema.goodsReceipts.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastGr?.grNumber) {
      const parts = lastGr.grNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const grNumber = `GR-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    // Resolve target warehouse (commercial or internal office)
    let targetWarehouseId = po.warehouseId;
    if (!targetWarehouseId) {
      const [officeWh] = await db
        .select({ id: schema.warehouses.id })
        .from(schema.warehouses)
        .where(
          and(
            eq(schema.warehouses.companyId, companyId),
            po.branchId ? eq(schema.warehouses.branchId, po.branchId) : sql`1=1`,
            eq(schema.warehouses.type, "INTERNAL_OFFICE")
          )
        )
        .limit(1);

      if (officeWh) {
        targetWarehouseId = officeWh.id;
      } else {
        const [anyWh] = await db
          .select({ id: schema.warehouses.id })
          .from(schema.warehouses)
          .where(eq(schema.warehouses.companyId, companyId))
          .limit(1);
        if (anyWh) targetWarehouseId = anyWh.id;
      }
    }

    const newGr = await db.transaction(async (tx) => {
      const [gr] = await tx
        .insert(schema.goodsReceipts)
        .values({
          tenantId,
          companyId,
          grNumber,
          poId: po.id,
          warehouseId: targetWarehouseId || null,
          supplierId: po.supplierId,
          status: "RECEIVED",
          receivedById: user.id,
          notes: params.notes || null,
        })
        .returning();

      await tx.insert(schema.goodsReceiptItems).values(
        params.items.map((i) => ({
          tenantId,
          companyId,
          grId: gr.id,
          productId: i.productId,
          batchNo: i.batchNo || null,
          expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
          qtyReceived: String(i.qtyReceived),
          unitCost: String(i.unitCost),
        }))
      );

      return gr;
    });

    // Apply Stock IN via Stock Engine for each item
    const ctx: MovementContext = {
      tenantId,
      companyId,
      userId: user.id,
      refType: "GOODS_RECEIPT",
      refId: newGr.id,
      note: `Penerimaan Barang ${grNumber} dari PO ${po.poNumber}`,
    };

    for (const item of params.items) {
      if (item.qtyReceived <= 0) continue;

      if (targetWarehouseId) {
        await receiveStock(ctx, {
          productId: item.productId,
          warehouseId: targetWarehouseId,
          qty: item.qtyReceived,
          unitCost: item.unitCost,
          batch: item.batchNo
            ? {
                batchNo: item.batchNo,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
              }
            : null,
        });
      }

      // Update PO item received qty
      await db
        .update(schema.purchaseOrderItems)
        .set({
          qtyReceived: sql`${schema.purchaseOrderItems.qtyReceived} + ${item.qtyReceived}`,
        })
        .where(
          sql`${schema.purchaseOrderItems.poId} = ${po.id} AND ${schema.purchaseOrderItems.productId} = ${item.productId}`
        );

      // Decrease qtyIncoming in warehouseStocks
      await db
        .update(schema.warehouseStocks)
        .set({
          qtyIncoming: sql`GREATEST(${schema.warehouseStocks.qtyIncoming} - ${item.qtyReceived}, 0)`,
        })
        .where(
          sql`${schema.warehouseStocks.companyId} = ${companyId} AND ${schema.warehouseStocks.warehouseId} = ${po.warehouseId} AND ${schema.warehouseStocks.productId} = ${item.productId}`
        );
    }

    // Check if PO is fully received
    const poItems = await db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, po.id));

    const isFullyReceived = poItems.every(
      (i) => num(i.qtyReceived) >= num(i.qtyOrdered)
    );
    await db
      .update(schema.purchaseOrders)
      .set({
        status: isFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseOrders.id, po.id));

    // Automatically create draft Supplier Invoice if none exists
    const [existingInv] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.poId, po.id));

    if (!existingInv) {
      const invNumber = `INV-SUP-${dateStr}-${String(nextSeq).padStart(4, "0")}`;
      await db.insert(schema.supplierInvoices).values({
        tenantId,
        companyId,
        invoiceNumber: invNumber,
        poId: po.id,
        supplierId: po.supplierId,
        status: "UNPAID",
        subtotal: po.subtotal,
        taxAmount: po.taxAmount,
        totalAmount: po.totalAmount,
        amountPaid: "0",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    }

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "POST",
      entity: "GoodsReceipt",
      entityId: newGr.id,
    });

    revalidatePath("/purchasing/receipts");
    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing/invoices");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return {
      success: true,
      message: `Penerimaan barang ${grNumber} berhasil dicatat & stok ter-update di gudang.`,
    };
  } catch (error: any) {
    console.error("createGoodsReceiptAction Error:", error);
    return { success: false, message: error.message || "Gagal mencatat Penerimaan Barang." };
  }
}

// -----------------------------------------------------------------------------
// 4. SUPPLIER INVOICES & PAYMENTS
// -----------------------------------------------------------------------------

export async function fetchSupplierInvoicesAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const invs = await db
      .select({
        id: schema.supplierInvoices.id,
        invoiceNumber: schema.supplierInvoices.invoiceNumber,
        poId: schema.supplierInvoices.poId,
        poNumber: schema.purchaseOrders.poNumber,
        supplierId: schema.supplierInvoices.supplierId,
        supplierName: schema.suppliers.name,
        status: schema.supplierInvoices.status,
        subtotal: schema.supplierInvoices.subtotal,
        taxAmount: schema.supplierInvoices.taxAmount,
        totalAmount: schema.supplierInvoices.totalAmount,
        amountPaid: schema.supplierInvoices.amountPaid,
        dueDate: schema.supplierInvoices.dueDate,
        createdAt: schema.supplierInvoices.createdAt,
      })
      .from(schema.supplierInvoices)
      .leftJoin(schema.purchaseOrders, eq(schema.supplierInvoices.poId, schema.purchaseOrders.id))
      .leftJoin(schema.suppliers, eq(schema.supplierInvoices.supplierId, schema.suppliers.id))
      .where(eq(schema.supplierInvoices.companyId, user.companyId))
      .orderBy(desc(schema.supplierInvoices.createdAt));

    const result = [];
    for (const inv of invs) {
      const payments = await db
        .select()
        .from(schema.supplierPayments)
        .where(eq(schema.supplierPayments.invoiceId, inv.id));

      const subtotal = num(inv.subtotal);
      const taxAmount = num(inv.taxAmount);
      const totalAmount = num(inv.totalAmount);
      const amountPaid = num(inv.amountPaid);
      const remainingAmount = Math.max(totalAmount - amountPaid, 0);

      result.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        poId: inv.poId,
        poNumber: inv.poNumber || "-",
        supplierId: inv.supplierId,
        supplierName: inv.supplierName || "Unknown Supplier",
        status: inv.status,
        subtotal,
        taxAmount,
        totalAmount,
        amountPaid,
        remainingAmount,
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : "",
        createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : "",
        paymentCount: payments.length,
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("fetchSupplierInvoicesAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil Supplier Invoices." };
  }
}

export async function recordSupplierPaymentAction(params: {
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

    if (params.amount <= 0) {
      return { success: false, message: "Jumlah pembayaran harus > 0." };
    }

    const [inv] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(
        sql`${schema.supplierInvoices.id} = ${params.invoiceId} AND ${schema.supplierInvoices.companyId} = ${companyId}`
      );

    if (!inv) return { success: false, message: "Faktur Pembelian tidak ditemukan." };

    const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
    const [lastPay] = await db
      .select({ paymentNumber: schema.supplierPayments.paymentNumber })
      .from(schema.supplierPayments)
      .where(eq(schema.supplierPayments.companyId, companyId))
      .orderBy(desc(schema.supplierPayments.createdAt))
      .limit(1);

    let nextSeq = 1;
    if (lastPay?.paymentNumber) {
      const parts = lastPay.paymentNumber.split("-");
      if (parts.length === 3 && !isNaN(Number(parts[2]))) {
        nextSeq = Number(parts[2]) + 1;
      }
    }
    const paymentNumber = `PAY-SUP-${dateStr}-${String(nextSeq).padStart(4, "0")}`;

    const newAmountPaid = num(inv.amountPaid) + params.amount;
    const totalAmount = num(inv.totalAmount);
    let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
    if (newAmountPaid >= totalAmount) newStatus = "PAID";

    await db.transaction(async (tx) => {
      await tx.insert(schema.supplierPayments).values({
        tenantId,
        companyId,
        paymentNumber,
        invoiceId: inv.id,
        supplierId: inv.supplierId,
        amount: String(params.amount),
        paymentMethod: params.paymentMethod || "TRANSFER",
        referenceNo: params.referenceNo || null,
        notes: params.notes || null,
        createdById: user.id,
      });

      await tx
        .update(schema.supplierInvoices)
        .set({
          amountPaid: String(newAmountPaid),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.supplierInvoices.id, inv.id));
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "POST",
      entity: "SupplierPayment",
      entityId: inv.id,
    });

    revalidatePath("/purchasing/invoices");
    return {
      success: true,
      message: `Pembayaran ${paymentNumber} sebesar Rp ${params.amount.toLocaleString("id-ID")} berhasil dicatat. Status: ${newStatus}`,
    };
  } catch (error: any) {
    console.error("recordSupplierPaymentAction Error:", error);
    return { success: false, message: error.message || "Gagal mencatat Pembayaran." };
  }
}
