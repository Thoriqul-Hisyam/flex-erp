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
import { receiveStock, issueStock, ensureStockRow, type MovementContext } from "@/lib/inventory/stock-engine";
import { revalidatePath } from "next/cache";
import { nextDocumentNumber } from "@/lib/documents/sequence";
import { getErrorMessage } from "@/lib/utils";
import {
  createPurchaseRequestSchema,
  createPurchaseOrderSchema,
  createGoodsReceiptSchema,
  closePurchaseOrderShortSchema,
  recordSupplierPaymentSchema,
} from "@/lib/validation/purchasing";

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
    const denied = await denyIfUnauthorized("pur_requests", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const prWhere = await withScope(schema.purchaseRequests, scope);

    const prBaseQuery = db
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
      .leftJoin(schema.branches, eq(schema.purchaseRequests.branchId, schema.branches.id));
    const prs = await (prWhere ? prBaseQuery.where(prWhere) : prBaseQuery).orderBy(
      desc(schema.purchaseRequests.createdAt),
    );

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
  } catch (error) {
    console.error("fetchPurchaseRequestsAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Purchase Requests." };
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
    const denied = await denyIfUnauthorized("pur_requests", "create");
    if (denied) return denied;

    const parsed = createPurchaseRequestSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk harus diisi." };
    }

    const resolvedBranchId = await assertCompanyScopedBranch(
      companyId,
      params.branchId,
      user.branchId,
    );

    const initialStatus = params.status || "DRAFT";

    const newPr = await db.transaction(async (tx) => {
      const prNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "PR" });
      const [pr] = await tx
        .insert(schema.purchaseRequests)
        .values({
          tenantId,
          companyId,
          prNumber,
          requestType: params.requestType || "FOR_RESALE",
          branchId: resolvedBranchId || null,
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
      message: `Purchase Request ${newPr.prNumber} berhasil dibuat dengan status ${initialStatus}.`,
    };
  } catch (error) {
    console.error("createPurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membuat Purchase Request." };
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
    const denied = await denyIfUnauthorized("pur_requests", "update");
    if (denied) return denied;

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
  } catch (error) {
    console.error("updatePurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal memperbarui Purchase Request." };
  }
}

export async function cancelPurchaseRequestAction(
  prId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_requests", "delete");
    if (denied) return denied;

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
    if (existingPr.status === "CANCELLED") {
      return { success: false, message: "Purchase Request sudah dibatalkan." };
    }

    const [linkedPo] = await db
      .select({ id: schema.purchaseOrders.id, poNumber: schema.purchaseOrders.poNumber })
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.prId, prId),
          ne(schema.purchaseOrders.status, "CANCELLED")
        )
      );
    if (linkedPo) {
      return {
        success: false,
        message: `Purchase Request tidak bisa dibatalkan karena sudah memiliki PO aktif (${linkedPo.poNumber}). Batalkan PO tersebut terlebih dahulu.`,
      };
    }

    await db
      .update(schema.purchaseRequests)
      .set({
        status: "CANCELLED",
        cancelReason: reason || null,
        cancelledById: user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseRequests.id, prId));

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: `Purchase Request ${existingPr.prNumber} berhasil dibatalkan.` };
  } catch (error) {
    console.error("cancelPurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Purchase Request." };
  }
}

export async function submitPurchaseRequestAction(prId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_requests", "update");
    if (denied) return denied;

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
  } catch (error) {
    console.error("submitPurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengajukan Purchase Request." };
  }
}

export async function approvePurchaseRequestAction(prId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_requests", "approve");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [pr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    if (!pr) return { success: false, message: "Purchase Request tidak ditemukan." };
    if (pr.status !== "SUBMITTED") {
      return { success: false, message: "Hanya Purchase Request berstatus SUBMITTED yang dapat disetujui." };
    }
    if (pr.requestedById && pr.requestedById === user.id) {
      return { success: false, message: "Pemohon tidak dapat menyetujui Purchase Request miliknya sendiri." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseRequests.id, prId));

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: "Purchase Request berhasil disetujui (Approved)." };
  } catch (error) {
    console.error("approvePurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menyetujui Purchase Request." };
  }
}

export async function rejectPurchaseRequestAction(
  prId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_requests", "approve");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan penolakan wajib diisi." };
    }

    const [pr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(
        sql`${schema.purchaseRequests.id} = ${prId} AND ${schema.purchaseRequests.companyId} = ${user.companyId}`
      );

    if (!pr) return { success: false, message: "Purchase Request tidak ditemukan." };
    if (pr.status !== "SUBMITTED") {
      return { success: false, message: "Hanya Purchase Request berstatus SUBMITTED yang dapat ditolak." };
    }
    if (pr.requestedById && pr.requestedById === user.id) {
      return { success: false, message: "Pemohon tidak dapat menolak Purchase Request miliknya sendiri." };
    }

    await db
      .update(schema.purchaseRequests)
      .set({
        status: "REJECTED",
        rejectedById: user.id,
        rejectedAt: new Date(),
        notes: sql`CONCAT(COALESCE(notes, ''), ' [Alasan Penolakan: ', ${reason}::text, ']')`,
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseRequests.id, prId));

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: prId,
    });

    revalidatePath("/purchasing/requests");
    return { success: true, message: "Purchase Request ditolak (Rejected)." };
  } catch (error) {
    console.error("rejectPurchaseRequestAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menolak Purchase Request." };
  }
}

// -----------------------------------------------------------------------------
// 2. PURCHASE ORDERS (PO)
// -----------------------------------------------------------------------------

export async function fetchPurchaseOrdersAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("pur_orders", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const poWhere = await withScope(schema.purchaseOrders, scope);

    const poBaseQuery = db
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
      .leftJoin(schema.purchaseRequests, eq(schema.purchaseOrders.prId, schema.purchaseRequests.id));
    const pos = await (poWhere ? poBaseQuery.where(poWhere) : poBaseQuery).orderBy(
      desc(schema.purchaseOrders.createdAt),
    );

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
  } catch (error) {
    console.error("fetchPurchaseOrdersAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Purchase Orders." };
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
    const denied = await denyIfUnauthorized("pur_orders", "create");
    if (denied) return denied;

    const parsed = createPurchaseOrderSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

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
    // Cabang Tujuan/Gudang Tujuan on a PO reflects the source PR's destination, not the
    // purchasing staff's own branch - a centralized purchasing team processes POs for any
    // branch, so this is only validated against the company (not against user.branchId).
    const resolvedBranchId = await assertCompanyScopedBranch(
      companyId,
      params.branchId,
      null,
    );
    const resolvedWarehouseId = await assertCompanyScopedWarehouse(
      companyId,
      params.warehouseId,
      null,
    );

    if (poType === "FOR_RESALE" && !resolvedWarehouseId) {
      return { success: false, message: "Gudang Tujuan wajib dipilih untuk pengadaan barang dagang (FOR_RESALE)." };
    }
    if (poType === "INTERNAL_USE" && !params.branchId) {
      return { success: false, message: "Cabang Tujuan wajib dipilih untuk penggunaan internal (INTERNAL_USE)." };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item produk harus diisi." };
    }

    const subtotal = params.items.reduce(
      (sum, i) => sum + i.qtyOrdered * i.unitPrice,
      0
    );
    const taxRate = params.taxRate ?? 11;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const newPo = await db.transaction(async (tx) => {
      const poNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "PO" });
      const [po] = await tx
        .insert(schema.purchaseOrders)
        .values({
          tenantId,
          companyId,
          poNumber,
          poType,
          supplierId: params.supplierId,
          branchId: resolvedBranchId || null,
          warehouseId: resolvedWarehouseId || null,
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
    return { success: true, message: `Purchase Order ${newPo.poNumber} berhasil dibuat.` };
  } catch (error) {
    console.error("createPurchaseOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membuat Purchase Order." };
  }
}

export async function issuePurchaseOrderAction(poId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_orders", "approve");
    if (denied) return denied;

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
    if (po.status !== "DRAFT") return { success: false, message: "Hanya Purchase Order berstatus DRAFT yang dapat diterbitkan." };

    const [company] = await db
      .select({ highValuePoThreshold: schema.companies.highValuePoThreshold })
      .from(schema.companies)
      .where(eq(schema.companies.id, user.companyId));

    const threshold = num(company?.highValuePoThreshold);
    if (threshold > 0 && num(po.totalAmount) > threshold && po.createdById === user.id) {
      return {
        success: false,
        message: `PO senilai Rp ${num(po.totalAmount).toLocaleString("id-ID")} melebihi threshold approval tinggi (Rp ${threshold.toLocaleString("id-ID")}) dan tidak bisa diterbitkan oleh pembuatnya sendiri. Minta user lain untuk menerbitkan PO ini.`,
      };
    }

    const items = await db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, poId));

    await db.transaction(async (tx) => {
      await tx
        .update(schema.purchaseOrders)
        .set({ status: "ISSUED", issuedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.purchaseOrders.id, poId));

      if (po.warehouseId) {
        for (const item of items) {
          await ensureStockRow(
            tx,
            { tenantId: user.tenantId!, companyId: user.companyId! },
            po.warehouseId,
            item.productId,
          );
          await tx
            .update(schema.warehouseStocks)
            .set({
              qtyIncoming: sql`${schema.warehouseStocks.qtyIncoming} + ${item.qtyOrdered}`,
            })
            .where(
              and(
                eq(schema.warehouseStocks.companyId, user.companyId!),
                eq(schema.warehouseStocks.warehouseId, po.warehouseId!),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );
        }
      }
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "POST",
      entity: "PurchaseOrder",
      entityId: poId,
    });

    revalidatePath("/purchasing/orders");
    return { success: true, message: `Purchase Order ${po.poNumber} diterbitkan (ISSUED).` };
  } catch (error) {
    console.error("issuePurchaseOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menerbitkan Purchase Order." };
  }
}

/**
 * Cancels a Purchase Order in DRAFT or ISSUED state, releasing any qtyIncoming
 * it posted. Blocked once any goods have been received against it - those
 * must be reversed via cancelGoodsReceiptAction first.
 */
export async function cancelPurchaseOrderAction(
  poId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_orders", "delete");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan pembatalan wajib diisi." };
    }

    const [po] = await db
      .select()
      .from(schema.purchaseOrders)
      .where(
        sql`${schema.purchaseOrders.id} = ${poId} AND ${schema.purchaseOrders.companyId} = ${user.companyId}`
      );

    if (!po) return { success: false, message: "PO tidak ditemukan." };
    if (po.status === "CANCELLED") return { success: false, message: "PO sudah dibatalkan." };
    if (po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") {
      return {
        success: false,
        message: "PO yang sudah memiliki penerimaan barang tidak bisa dibatalkan langsung. Batalkan Goods Receipt terkait terlebih dahulu.",
      };
    }

    const items = await db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, poId));

    await db.transaction(async (tx) => {
      if (po.status === "ISSUED" && po.warehouseId) {
        for (const item of items) {
          await tx
            .update(schema.warehouseStocks)
            .set({
              qtyIncoming: sql`GREATEST(0, ${schema.warehouseStocks.qtyIncoming} - ${item.qtyOrdered})`,
            })
            .where(
              and(
                eq(schema.warehouseStocks.companyId, user.companyId!),
                eq(schema.warehouseStocks.warehouseId, po.warehouseId!),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );
        }
      }

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: "CANCELLED",
          cancelReason: reason,
          cancelledById: user.id,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, poId));
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "PurchaseOrder",
      entityId: poId,
    });

    revalidatePath("/purchasing/orders");
    revalidatePath("/inventory/stocks");
    return { success: true, message: `Purchase Order ${po.poNumber} berhasil dibatalkan.` };
  } catch (error) {
    console.error("cancelPurchaseOrderAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Purchase Order." };
  }
}

/**
 * Closes a PARTIALLY_RECEIVED PO when the remaining un-received qty will
 * never arrive (permanent short shipment): releases the outstanding
 * qtyIncoming for the shortfall, marks the PO RECEIVED (final), and rescales
 * the auto-generated Supplier Invoice down to what was actually received so
 * it doesn't keep billing the full original PO amount.
 */
export async function closePurchaseOrderShortAction(
  poId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_orders", "approve");
    if (denied) return denied;

    const parsed = closePurchaseOrderShortSchema.safeParse({ poId, reason });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

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
        sql`${schema.purchaseOrders.id} = ${poId} AND ${schema.purchaseOrders.companyId} = ${companyId}`
      );

    if (!po) return { success: false, message: "PO tidak ditemukan." };
    if (po.status !== "PARTIALLY_RECEIVED") {
      return {
        success: false,
        message: "Hanya PO berstatus Partially Received yang dapat ditutup sebagai short.",
      };
    }

    const items = await db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, poId));

    const shortItems = items.filter((i) => num(i.qtyOrdered) > num(i.qtyReceived));
    if (shortItems.length === 0) {
      return { success: false, message: "Tidak ada sisa qty yang kurang pada PO ini." };
    }

    const [invoice] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.poId, poId));

    let newInvoiceTotal = 0;
    if (invoice) {
      const receivedValue = items.reduce((sum, i) => sum + num(i.qtyReceived) * num(i.unitPrice), 0);
      const taxRate = num(po.subtotal) > 0 ? num(po.taxAmount) / num(po.subtotal) : 0;
      const newSubtotal = receivedValue;
      const newTaxAmount = newSubtotal * taxRate;
      newInvoiceTotal = newSubtotal + newTaxAmount;

      if (invoice.status !== "CANCELLED" && num(invoice.amountPaid) > newInvoiceTotal) {
        return {
          success: false,
          message: `Faktur Pembelian ${invoice.invoiceNumber} sudah dibayar Rp ${num(invoice.amountPaid).toLocaleString("id-ID")}, lebih besar dari nilai barang yang benar-benar diterima (Rp ${newInvoiceTotal.toLocaleString("id-ID")}). Selesaikan kelebihan bayar dengan supplier sebelum menutup PO ini.`,
        };
      }
    }

    await db.transaction(async (tx) => {
      if (po.warehouseId) {
        for (const item of shortItems) {
          const shortQty = num(item.qtyOrdered) - num(item.qtyReceived);
          await tx
            .update(schema.warehouseStocks)
            .set({
              qtyIncoming: sql`GREATEST(0, ${schema.warehouseStocks.qtyIncoming} - ${shortQty})`,
            })
            .where(
              and(
                eq(schema.warehouseStocks.companyId, companyId),
                eq(schema.warehouseStocks.warehouseId, po.warehouseId!),
                eq(schema.warehouseStocks.productId, item.productId)
              )
            );
        }
      }

      await tx
        .update(schema.purchaseOrders)
        .set({
          status: "RECEIVED",
          notes: sql`CONCAT(COALESCE(notes, ''), ' [PO ditutup short: ', ${reason}::text, ']')`,
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, poId));

      if (invoice && invoice.status !== "CANCELLED") {
        const taxRate = num(po.subtotal) > 0 ? num(po.taxAmount) / num(po.subtotal) : 0;
        const receivedValue = items.reduce((sum, i) => sum + num(i.qtyReceived) * num(i.unitPrice), 0);
        const newTaxAmount = receivedValue * taxRate;
        let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
        if (num(invoice.amountPaid) >= newInvoiceTotal && newInvoiceTotal > 0) newStatus = "PAID";
        else if (num(invoice.amountPaid) > 0) newStatus = "PARTIALLY_PAID";

        await tx
          .update(schema.supplierInvoices)
          .set({
            subtotal: String(receivedValue),
            taxAmount: String(newTaxAmount),
            totalAmount: String(newInvoiceTotal),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(schema.supplierInvoices.id, invoice.id));
      }
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "PurchaseOrder",
      entityId: poId,
      newPayload: { shortClosed: true, reason, shortItems: shortItems.map((i) => i.productId) },
    });

    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing/invoices");
    revalidatePath("/inventory/stocks");

    return {
      success: true,
      message: `PO ${po.poNumber} ditutup sebagai short (sisa qty tidak akan diterima).${invoice ? " Faktur pembelian disesuaikan ke nilai yang diterima." : ""}`,
    };
  } catch (error) {
    console.error("closePurchaseOrderShortAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menutup PO short." };
  }
}

// -----------------------------------------------------------------------------
// 3. GOODS RECEIPTS (GR / Stock IN)
// -----------------------------------------------------------------------------

export async function fetchGoodsReceiptsAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("pur_receipts", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const grWhere = await withScope(schema.goodsReceipts, scope);

    const grBaseQuery = db
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
      .leftJoin(schema.suppliers, eq(schema.goodsReceipts.supplierId, schema.suppliers.id));
    const grs = await (grWhere ? grBaseQuery.where(grWhere) : grBaseQuery).orderBy(
      desc(schema.goodsReceipts.createdAt),
    );

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
  } catch (error) {
    console.error("fetchGoodsReceiptsAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Goods Receipts." };
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
    const denied = await denyIfUnauthorized("pur_receipts", "create");
    if (denied) return denied;

    const parsedGr = createGoodsReceiptSchema.safeParse(params);
    if (!parsedGr.success) {
      return { success: false, message: parsedGr.error.issues[0]?.message || "Data tidak valid." };
    }

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
    if (po.status === "DRAFT") return { success: false, message: "PO belum diterbitkan sehingga penerimaan barang belum bisa dicatat." };
    if (po.status === "CANCELLED" || po.status === "RECEIVED") {
      return { success: false, message: `PO ini sudah berstatus ${po.status}, tidak dapat menerima Goods Receipt baru.` };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, message: "Minimal 1 item penerimaan barang harus diisi." };
    }

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
      const grNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "GR" });
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

      const ctx: MovementContext = {
        tenantId,
        companyId,
        userId: user.id,
        refType: "GOODS_RECEIPT",
        refId: gr.id,
        note: `Penerimaan Barang ${grNumber} dari PO ${po.poNumber}`,
      };

      for (const item of params.items) {
        if (item.qtyReceived <= 0) continue;

        const [poItem] = await tx
          .select()
          .from(schema.purchaseOrderItems)
          .where(
            and(
              eq(schema.purchaseOrderItems.poId, po.id),
              eq(schema.purchaseOrderItems.productId, item.productId)
            )
          );

        const currentReceived = num(poItem?.qtyReceived);
        const ordered = num(poItem?.qtyOrdered);
        const remaining = Math.max(ordered - currentReceived, 0);
        if (item.qtyReceived > remaining) {
          throw new Error(`Qty penerimaan untuk produk ${item.productId} melebihi sisa qty PO.`);
        }

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
          }, tx);
        }

        await tx
          .update(schema.purchaseOrderItems)
          .set({
            qtyReceived: sql`${schema.purchaseOrderItems.qtyReceived} + ${item.qtyReceived}`,
          })
          .where(
            and(
              eq(schema.purchaseOrderItems.poId, po.id),
              eq(schema.purchaseOrderItems.productId, item.productId)
            )
          );

        await tx
          .update(schema.warehouseStocks)
          .set({
            qtyIncoming: sql`GREATEST(${schema.warehouseStocks.qtyIncoming} - ${item.qtyReceived}, 0)`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.warehouseStocks.companyId, companyId),
              eq(schema.warehouseStocks.warehouseId, targetWarehouseId || po.warehouseId || ""),
              eq(schema.warehouseStocks.productId, item.productId)
            )
          );
      }

      const poItems = await tx
        .select()
        .from(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.poId, po.id));

      const isFullyReceived = poItems.every((i) => num(i.qtyReceived) >= num(i.qtyOrdered));
      await tx
        .update(schema.purchaseOrders)
        .set({
          status: isFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, po.id));

      const [existingInv] = await tx
        .select()
        .from(schema.supplierInvoices)
        .where(
          and(
            eq(schema.supplierInvoices.poId, po.id),
            ne(schema.supplierInvoices.status, "CANCELLED")
          )
        );

      if (!existingInv) {
        const invNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "INV-SUP" });
        await tx.insert(schema.supplierInvoices).values({
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
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      return gr;
    });

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
      message: `Penerimaan barang ${newGr.grNumber} berhasil dicatat & stok ter-update di gudang.`,
    };
  } catch (error) {
    console.error("createGoodsReceiptAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mencatat Penerimaan Barang." };
  }
}

/**
 * Cancels a Goods Receipt, reversing the STOCK_IN it posted and rolling back
 * qtyReceived on the PO. Blocked once the supplier invoice tied to the PO has
 * a payment recorded - that must be resolved first.
 */
export async function cancelGoodsReceiptAction(
  grId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_receipts", "delete");
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

    const [gr] = await db
      .select()
      .from(schema.goodsReceipts)
      .where(
        sql`${schema.goodsReceipts.id} = ${grId} AND ${schema.goodsReceipts.companyId} = ${companyId}`
      );

    if (!gr) return { success: false, message: "Goods Receipt tidak ditemukan." };
    if (gr.status === "CANCELLED") return { success: false, message: "Goods Receipt sudah dibatalkan." };
    if (!gr.warehouseId) return { success: false, message: "Gudang Goods Receipt tidak valid." };

    const [invoice] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.poId, gr.poId));

    if (invoice && num(invoice.amountPaid) > 0) {
      return {
        success: false,
        message: `Goods Receipt tidak bisa dibatalkan karena Faktur Pembelian ${invoice.invoiceNumber} sudah memiliki pembayaran.`,
      };
    }

    const items = await db
      .select()
      .from(schema.goodsReceiptItems)
      .where(eq(schema.goodsReceiptItems.grId, grId));

    await db.transaction(async (tx) => {
      const ctx: MovementContext = {
        tenantId,
        companyId,
        userId: user.id,
        refType: "GOODS_RECEIPT_CANCEL",
        refId: grId,
        note: `Pembatalan Goods Receipt ${gr.grNumber}: ${reason}`,
      };

      for (const item of items) {
        const qty = num(item.qtyReceived);
        if (qty <= 0) continue;

        await issueStock(ctx, {
          productId: item.productId,
          warehouseId: gr.warehouseId!,
          qty,
          batchNo: item.batchNo || undefined,
        }, tx);

        await tx
          .update(schema.purchaseOrderItems)
          .set({
            qtyReceived: sql`GREATEST(0, ${schema.purchaseOrderItems.qtyReceived} - ${qty})`,
          })
          .where(
            and(
              eq(schema.purchaseOrderItems.poId, gr.poId),
              eq(schema.purchaseOrderItems.productId, item.productId)
            )
          );

        await ensureStockRow(tx, { tenantId, companyId }, gr.warehouseId!, item.productId);
        await tx
          .update(schema.warehouseStocks)
          .set({
            qtyIncoming: sql`${schema.warehouseStocks.qtyIncoming} + ${qty}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.warehouseStocks.companyId, companyId),
              eq(schema.warehouseStocks.warehouseId, gr.warehouseId!),
              eq(schema.warehouseStocks.productId, item.productId)
            )
          );
      }

      await tx
        .update(schema.goodsReceipts)
        .set({
          status: "CANCELLED",
          cancelReason: reason,
          cancelledById: user.id,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.goodsReceipts.id, grId));

      const poItems = await tx
        .select()
        .from(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.poId, gr.poId));
      const anyReceived = poItems.some((i) => num(i.qtyReceived) > 0);
      const isFullyReceived = poItems.every((i) => num(i.qtyReceived) >= num(i.qtyOrdered));
      await tx
        .update(schema.purchaseOrders)
        .set({
          status: isFullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "ISSUED",
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, gr.poId));

      if (invoice) {
        await tx
          .update(schema.supplierInvoices)
          .set({ status: "CANCELLED", updatedAt: new Date() })
          .where(eq(schema.supplierInvoices.id, invoice.id));
      }
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "GoodsReceipt",
      entityId: grId,
    });

    revalidatePath("/purchasing/receipts");
    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing/invoices");
    revalidatePath("/inventory/stocks");
    revalidatePath("/inventory/movements");

    return { success: true, message: `Goods Receipt ${gr.grNumber} berhasil dibatalkan & stok dikoreksi.` };
  } catch (error) {
    console.error("cancelGoodsReceiptAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Goods Receipt." };
  }
}

// -----------------------------------------------------------------------------
// 4. SUPPLIER INVOICES & PAYMENTS
// -----------------------------------------------------------------------------

export async function fetchSupplierInvoicesAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("pur_invoices", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const invWhere = await withScope(schema.supplierInvoices, scope);

    const invBaseQuery = db
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
        isFinalized: schema.supplierInvoices.isFinalized,
        cancelReason: schema.supplierInvoices.cancelReason,
        cancelledAt: schema.supplierInvoices.cancelledAt,
      })
      .from(schema.supplierInvoices)
      .leftJoin(schema.purchaseOrders, eq(schema.supplierInvoices.poId, schema.purchaseOrders.id))
      .leftJoin(schema.suppliers, eq(schema.supplierInvoices.supplierId, schema.suppliers.id));
    const invs = await (invWhere ? invBaseQuery.where(invWhere) : invBaseQuery).orderBy(
      desc(schema.supplierInvoices.createdAt),
    );

    const result = [];
    for (const inv of invs) {
      const payments = await db
        .select()
        .from(schema.supplierPayments)
        .where(eq(schema.supplierPayments.invoiceId, inv.id))
        .orderBy(desc(schema.supplierPayments.paymentDate));

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
        isFinalized: inv.isFinalized,
        cancelReason: inv.cancelReason || null,
        cancelledAt: inv.cancelledAt ? new Date(inv.cancelledAt).toISOString() : null,
        payments: payments.map((p) => ({
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: num(p.amount),
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : null,
          referenceNo: p.referenceNo,
          notes: p.notes,
          status: p.status,
          cancelReason: p.cancelReason || null,
          cancelledAt: p.cancelledAt ? new Date(p.cancelledAt).toISOString() : null,
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchSupplierInvoicesAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil Supplier Invoices." };
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
    const denied = await denyIfUnauthorized("pur_invoices", "update");
    if (denied) return denied;

    const parsed = recordSupplierPaymentSchema.safeParse(params);
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
      .from(schema.supplierInvoices)
      .where(
        sql`${schema.supplierInvoices.id} = ${params.invoiceId} AND ${schema.supplierInvoices.companyId} = ${companyId}`
      );

    if (!inv) return { success: false, message: "Faktur Pembelian tidak ditemukan." };
    if (inv.status === "CANCELLED") return { success: false, message: "Faktur ini sudah dibatalkan." };

    const remainingAmount = num(inv.totalAmount) - num(inv.amountPaid);
    if (params.amount > remainingAmount) {
      return {
        success: false,
        message: `Jumlah pembayaran (Rp ${params.amount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${remainingAmount.toLocaleString("id-ID")}).`,
      };
    }

    const newAmountPaid = num(inv.amountPaid) + params.amount;
    const totalAmount = num(inv.totalAmount);
    let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
    if (newAmountPaid >= totalAmount) newStatus = "PAID";

    const paymentNumber = await db.transaction(async (tx) => {
      const paymentNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "PAY-SUP" });
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

      return paymentNumber;
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
  } catch (error) {
    console.error("recordSupplierPaymentAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mencatat Pembayaran." };
  }
}

/**
 * Cancels an ACTIVE Supplier Payment, recomputing the parent invoice's
 * amountPaid/status to exclude it. Blocked once the invoice has been
 * finalized or is itself cancelled.
 */
export async function cancelSupplierPaymentAction(
  paymentId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_invoices", "delete");
    if (denied) return denied;

    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan pembatalan wajib diisi." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [payment] = await db
      .select()
      .from(schema.supplierPayments)
      .where(
        sql`${schema.supplierPayments.id} = ${paymentId} AND ${schema.supplierPayments.companyId} = ${companyId}`
      );

    if (!payment) return { success: false, message: "Pembayaran tidak ditemukan." };
    if (payment.status === "CANCELLED") {
      return { success: false, message: "Pembayaran ini sudah dibatalkan." };
    }

    const [invoice] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.id, payment.invoiceId));

    if (invoice?.isFinalized) {
      return {
        success: false,
        message: "Faktur ini sudah difinalisasi. Transaksi pembayaran tidak bisa lagi diubah atau dibatalkan.",
      };
    }
    if (invoice?.status === "CANCELLED") {
      return { success: false, message: "Faktur ini sudah dibatalkan." };
    }

    const newStatus = await db.transaction(async (tx) => {
      await tx
        .update(schema.supplierPayments)
        .set({
          status: "CANCELLED",
          cancelReason: reason,
          cancelledById: user.id,
          cancelledAt: new Date(),
        })
        .where(eq(schema.supplierPayments.id, payment.id));

      const activePayments = await tx
        .select()
        .from(schema.supplierPayments)
        .where(
          and(
            eq(schema.supplierPayments.invoiceId, payment.invoiceId),
            eq(schema.supplierPayments.status, "ACTIVE")
          )
        );

      const newAmountPaid = activePayments.reduce((sum, p) => sum + num(p.amount), 0);
      const totalAmount = num(invoice?.totalAmount);
      let newStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
      if (newAmountPaid <= 0) newStatus = "UNPAID";
      else if (newAmountPaid < totalAmount) newStatus = "PARTIALLY_PAID";
      else newStatus = "PAID";

      await tx
        .update(schema.supplierInvoices)
        .set({
          amountPaid: String(newAmountPaid),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.supplierInvoices.id, payment.invoiceId));

      return newStatus;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "SupplierPayment",
      entityId: payment.id,
    });

    revalidatePath("/purchasing/invoices");
    return {
      success: true,
      message: `Pembayaran ${payment.paymentNumber} dibatalkan. Status faktur: ${newStatus}`,
    };
  } catch (error) {
    console.error("cancelSupplierPaymentAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Pembayaran." };
  }
}

/**
 * Cancels a Supplier Invoice that has no active payments and has not been
 * finalized. Purely a status update - the underlying PO/GR linkage is
 * historical only and is not touched here.
 */
export async function cancelSupplierInvoiceAction(
  invoiceId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_invoices", "delete");
    if (denied) return denied;

    if (!reason || !reason.trim()) {
      return { success: false, message: "Alasan pembatalan wajib diisi." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [invoice] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(
        sql`${schema.supplierInvoices.id} = ${invoiceId} AND ${schema.supplierInvoices.companyId} = ${companyId}`
      );

    if (!invoice) return { success: false, message: "Faktur Pembelian tidak ditemukan." };
    if (invoice.status === "CANCELLED") {
      return { success: false, message: "Faktur ini sudah dibatalkan." };
    }
    if (invoice.isFinalized) {
      return { success: false, message: "Faktur ini sudah difinalisasi dan tidak bisa dibatalkan." };
    }
    if (num(invoice.amountPaid) > 0) {
      return {
        success: false,
        message: `Faktur ini masih memiliki pembayaran aktif sebesar Rp ${num(invoice.amountPaid).toLocaleString("id-ID")}. Batalkan transaksi pembayarannya terlebih dahulu (lihat Riwayat Pembayaran) sebelum membatalkan faktur ini.`,
      };
    }

    await db
      .update(schema.supplierInvoices)
      .set({
        status: "CANCELLED",
        cancelReason: reason,
        cancelledById: user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierInvoices.id, invoiceId));

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "SupplierInvoice",
      entityId: invoice.id,
    });

    revalidatePath("/purchasing/invoices");
    return { success: true, message: `Faktur ${invoice.invoiceNumber} berhasil dibatalkan.` };
  } catch (error) {
    console.error("cancelSupplierInvoiceAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan Faktur Pembelian." };
  }
}

/**
 * Locks a fully-paid Supplier Invoice from further changes (payments,
 * cancellation). Only invoices with status PAID may be finalized.
 */
export async function finalizeSupplierInvoiceAction(invoiceId: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_invoices", "update");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [invoice] = await db
      .select()
      .from(schema.supplierInvoices)
      .where(
        sql`${schema.supplierInvoices.id} = ${invoiceId} AND ${schema.supplierInvoices.companyId} = ${companyId}`
      );

    if (!invoice) return { success: false, message: "Faktur Pembelian tidak ditemukan." };
    if (invoice.isFinalized) {
      return { success: false, message: "Faktur ini sudah difinalisasi sebelumnya." };
    }
    if (invoice.status !== "PAID") {
      return { success: false, message: "Hanya faktur dengan status Lunas (Paid) yang bisa difinalisasi." };
    }

    await db
      .update(schema.supplierInvoices)
      .set({
        isFinalized: true,
        finalizedById: user.id,
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierInvoices.id, invoiceId));

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: invoice.id,
    });

    revalidatePath("/purchasing/invoices");
    return {
      success: true,
      message: `Faktur ${invoice.invoiceNumber} berhasil difinalisasi dan terkunci dari perubahan lebih lanjut.`,
    };
  } catch (error) {
    console.error("finalizeSupplierInvoiceAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal memfinalisasi Faktur Pembelian." };
  }
}
