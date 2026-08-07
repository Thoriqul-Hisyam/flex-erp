"use server";

import { db, schema } from "@/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { denyIfUnauthorized } from "@/lib/auth/server-permissions";
import { getScopeContext, withScope } from "@/lib/auth/scope";
import { logAuditEvent } from "@/lib/audit/logger";
import { revalidatePath } from "next/cache";
import { nextDocumentNumber } from "@/lib/documents/sequence";
import { getErrorMessage } from "@/lib/utils";
import {
  createRfqSchema,
  recordRfqQuoteSchema,
  awardRfqSchema,
  cancelRfqSchema,
} from "@/lib/validation/rfq";
import { createPurchaseOrderAction } from "./purchasing-actions";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

function num(val: unknown): number {
  return Number(val || 0);
}

// -----------------------------------------------------------------------------
// 1. FETCH
// -----------------------------------------------------------------------------

export async function fetchRfqsAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const rfqWhere = await withScope(schema.purchaseRfqs, scope);

    const rfqBaseQuery = db
      .select({
        id: schema.purchaseRfqs.id,
        rfqNumber: schema.purchaseRfqs.rfqNumber,
        prId: schema.purchaseRfqs.prId,
        prNumber: schema.purchaseRequests.prNumber,
        status: schema.purchaseRfqs.status,
        dueDate: schema.purchaseRfqs.dueDate,
        notes: schema.purchaseRfqs.notes,
        createdAt: schema.purchaseRfqs.createdAt,
      })
      .from(schema.purchaseRfqs)
      .leftJoin(schema.purchaseRequests, eq(schema.purchaseRfqs.prId, schema.purchaseRequests.id));
    const rfqs = await (rfqWhere ? rfqBaseQuery.where(rfqWhere) : rfqBaseQuery).orderBy(
      desc(schema.purchaseRfqs.createdAt),
    );

    const result = [];
    for (const rfq of rfqs) {
      const quotes = await db
        .select({
          id: schema.rfqQuotes.id,
          supplierId: schema.rfqQuotes.supplierId,
          supplierName: schema.suppliers.name,
          status: schema.rfqQuotes.status,
        })
        .from(schema.rfqQuotes)
        .leftJoin(schema.suppliers, eq(schema.rfqQuotes.supplierId, schema.suppliers.id))
        .where(eq(schema.rfqQuotes.rfqId, rfq.id));

      result.push({
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        prId: rfq.prId,
        prNumber: rfq.prNumber || "-",
        status: rfq.status,
        dueDate: rfq.dueDate ? new Date(rfq.dueDate).toISOString() : "",
        notes: rfq.notes,
        createdAt: rfq.createdAt ? new Date(rfq.createdAt).toISOString() : "",
        invitedCount: quotes.length,
        quotedCount: quotes.filter((q) => q.status === "SUBMITTED" || q.status === "AWARDED" || q.status === "REJECTED").length,
        suppliers: quotes.map((q) => ({
          supplierId: q.supplierId,
          supplierName: q.supplierName || "Unknown Supplier",
          status: q.status,
        })),
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("fetchRfqsAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil data RFQ." };
  }
}

export async function fetchRfqDetailAction(rfqId: string): Promise<ActionResult<any>> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const detailWhere = await withScope(schema.purchaseRfqs, scope, [
      eq(schema.purchaseRfqs.id, rfqId),
    ]);

    const [rfq] = await db
      .select({
        id: schema.purchaseRfqs.id,
        rfqNumber: schema.purchaseRfqs.rfqNumber,
        prId: schema.purchaseRfqs.prId,
        prNumber: schema.purchaseRequests.prNumber,
        branchId: schema.purchaseRequests.branchId,
        requestType: schema.purchaseRequests.requestType,
        status: schema.purchaseRfqs.status,
        dueDate: schema.purchaseRfqs.dueDate,
        notes: schema.purchaseRfqs.notes,
        createdAt: schema.purchaseRfqs.createdAt,
      })
      .from(schema.purchaseRfqs)
      .leftJoin(schema.purchaseRequests, eq(schema.purchaseRfqs.prId, schema.purchaseRequests.id))
      .where(detailWhere);

    if (!rfq) return { success: false, message: "RFQ tidak ditemukan." };

    const items = await db
      .select({
        id: schema.purchaseRfqItems.id,
        productId: schema.purchaseRfqItems.productId,
        productName: schema.products.name,
        productSku: schema.products.sku,
        productUnit: schema.products.unit,
        qtyRequested: schema.purchaseRfqItems.qtyRequested,
      })
      .from(schema.purchaseRfqItems)
      .leftJoin(schema.products, eq(schema.purchaseRfqItems.productId, schema.products.id))
      .where(eq(schema.purchaseRfqItems.rfqId, rfqId));

    const quotes = await db
      .select({
        id: schema.rfqQuotes.id,
        supplierId: schema.rfqQuotes.supplierId,
        supplierName: schema.suppliers.name,
        status: schema.rfqQuotes.status,
        submittedAt: schema.rfqQuotes.submittedAt,
        notes: schema.rfqQuotes.notes,
      })
      .from(schema.rfqQuotes)
      .leftJoin(schema.suppliers, eq(schema.rfqQuotes.supplierId, schema.suppliers.id))
      .where(eq(schema.rfqQuotes.rfqId, rfqId));

    const quoteDetails = [];
    for (const q of quotes) {
      const quoteItems = await db
        .select({
          productId: schema.rfqQuoteItems.productId,
          unitPrice: schema.rfqQuoteItems.unitPrice,
          qty: schema.rfqQuoteItems.qty,
        })
        .from(schema.rfqQuoteItems)
        .where(eq(schema.rfqQuoteItems.quoteId, q.id));

      quoteDetails.push({
        id: q.id,
        supplierId: q.supplierId,
        supplierName: q.supplierName || "Unknown Supplier",
        status: q.status,
        submittedAt: q.submittedAt ? new Date(q.submittedAt).toISOString() : "",
        notes: q.notes,
        totalAmount: quoteItems.reduce((sum, i) => sum + num(i.unitPrice) * num(i.qty), 0),
        items: quoteItems.map((i) => ({
          productId: i.productId,
          unitPrice: num(i.unitPrice),
          qty: num(i.qty),
        })),
      });
    }

    return {
      success: true,
      data: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        prId: rfq.prId,
        prNumber: rfq.prNumber || "-",
        branchId: rfq.branchId,
        requestType: rfq.requestType || "FOR_RESALE",
        status: rfq.status,
        dueDate: rfq.dueDate ? new Date(rfq.dueDate).toISOString() : "",
        notes: rfq.notes,
        createdAt: rfq.createdAt ? new Date(rfq.createdAt).toISOString() : "",
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || "Unknown",
          productSku: i.productSku || "-",
          unit: i.productUnit || "Pcs",
          qtyRequested: num(i.qtyRequested),
        })),
        quotes: quoteDetails,
      },
    };
  } catch (error) {
    console.error("fetchRfqDetailAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil detail RFQ." };
  }
}

// -----------------------------------------------------------------------------
// 2. CREATE / QUOTE / AWARD / CANCEL
// -----------------------------------------------------------------------------

export async function createRfqAction(params: {
  prId: string;
  supplierIds: string[];
  dueDate?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "create");
    if (denied) return denied;

    const parsed = createRfqSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [pr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(
        sql`${schema.purchaseRequests.id} = ${params.prId} AND ${schema.purchaseRequests.companyId} = ${companyId}`
      );

    if (!pr) return { success: false, message: "Purchase Request tidak ditemukan." };
    if (pr.status !== "APPROVED") {
      return { success: false, message: "Hanya Purchase Request berstatus APPROVED yang dapat dibuatkan RFQ." };
    }

    const prItems = await db
      .select()
      .from(schema.purchaseRequestItems)
      .where(eq(schema.purchaseRequestItems.prId, pr.id));

    if (prItems.length === 0) {
      return { success: false, message: "Purchase Request ini tidak memiliki item." };
    }

    const newRfq = await db.transaction(async (tx) => {
      const rfqNumber = await nextDocumentNumber(tx, { tenantId, companyId, prefix: "RFQ" });
      const [rfq] = await tx
        .insert(schema.purchaseRfqs)
        .values({
          tenantId,
          companyId,
          rfqNumber,
          prId: pr.id,
          status: "SENT",
          dueDate: params.dueDate ? new Date(params.dueDate) : null,
          notes: params.notes || null,
          createdById: user.id,
        })
        .returning();

      await tx.insert(schema.purchaseRfqItems).values(
        prItems.map((i) => ({
          tenantId,
          companyId,
          rfqId: rfq.id,
          productId: i.productId,
          qtyRequested: i.qtyRequested,
          notes: i.notes,
        }))
      );

      await tx.insert(schema.rfqQuotes).values(
        params.supplierIds.map((supplierId) => ({
          tenantId,
          companyId,
          rfqId: rfq.id,
          supplierId,
          status: "INVITED" as const,
          createdById: user.id,
        }))
      );

      return rfq;
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "PurchaseRfq",
      entityId: newRfq.id,
    });

    revalidatePath("/purchasing/rfq");
    return { success: true, message: `RFQ ${newRfq.rfqNumber} berhasil dikirim ke ${params.supplierIds.length} supplier.` };
  } catch (error) {
    console.error("createRfqAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membuat RFQ." };
  }
}

export async function recordRfqQuoteAction(params: {
  rfqId: string;
  supplierId: string;
  items: Array<{ productId: string; unitPrice: number }>;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "update");
    if (denied) return denied;

    const parsed = recordRfqQuoteSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const tenantId = user.tenantId;
    const companyId = user.companyId;

    const [rfq] = await db
      .select()
      .from(schema.purchaseRfqs)
      .where(
        sql`${schema.purchaseRfqs.id} = ${params.rfqId} AND ${schema.purchaseRfqs.companyId} = ${companyId}`
      );
    if (!rfq) return { success: false, message: "RFQ tidak ditemukan." };
    if (rfq.status === "CANCELLED" || rfq.status === "AWARDED") {
      return { success: false, message: `RFQ ini sudah berstatus ${rfq.status}, tidak dapat menerima penawaran baru.` };
    }

    const [quote] = await db
      .select()
      .from(schema.rfqQuotes)
      .where(
        and(eq(schema.rfqQuotes.rfqId, params.rfqId), eq(schema.rfqQuotes.supplierId, params.supplierId))
      );
    if (!quote) return { success: false, message: "Supplier ini tidak diundang pada RFQ ini." };

    const rfqItems = await db
      .select({ productId: schema.purchaseRfqItems.productId, qtyRequested: schema.purchaseRfqItems.qtyRequested })
      .from(schema.purchaseRfqItems)
      .where(eq(schema.purchaseRfqItems.rfqId, params.rfqId));
    const qtyByProduct = new Map(rfqItems.map((i) => [i.productId, i.qtyRequested]));

    await db.transaction(async (tx) => {
      await tx
        .update(schema.rfqQuotes)
        .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.rfqQuotes.id, quote.id));

      await tx.delete(schema.rfqQuoteItems).where(eq(schema.rfqQuoteItems.quoteId, quote.id));
      await tx.insert(schema.rfqQuoteItems).values(
        params.items.map((i) => ({
          tenantId,
          companyId,
          quoteId: quote.id,
          productId: i.productId,
          unitPrice: String(i.unitPrice),
          qty: qtyByProduct.get(i.productId) || "0",
        }))
      );

      if (rfq.status === "SENT") {
        await tx
          .update(schema.purchaseRfqs)
          .set({ status: "QUOTED", updatedAt: new Date() })
          .where(eq(schema.purchaseRfqs.id, rfq.id));
      }
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "RfqQuote",
      entityId: quote.id,
    });

    revalidatePath("/purchasing/rfq");
    revalidatePath(`/purchasing/rfq/${params.rfqId}`);
    return { success: true, message: "Penawaran supplier berhasil dicatat." };
  } catch (error) {
    console.error("recordRfqQuoteAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mencatat penawaran supplier." };
  }
}

export async function awardRfqAction(params: {
  rfqId: string;
  supplierId: string;
  warehouseId?: string;
  branchId?: string;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "approve");
    if (denied) return denied;

    const parsed = awardRfqSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }
    const companyId = user.companyId;

    const [rfq] = await db
      .select()
      .from(schema.purchaseRfqs)
      .where(
        sql`${schema.purchaseRfqs.id} = ${params.rfqId} AND ${schema.purchaseRfqs.companyId} = ${companyId}`
      );
    if (!rfq) return { success: false, message: "RFQ tidak ditemukan." };
    if (rfq.status === "CANCELLED") return { success: false, message: "RFQ ini sudah dibatalkan." };
    if (rfq.status === "AWARDED") return { success: false, message: "RFQ ini sudah memiliki pemenang." };

    const [pr] = await db
      .select()
      .from(schema.purchaseRequests)
      .where(eq(schema.purchaseRequests.id, rfq.prId!));
    if (!pr) return { success: false, message: "Purchase Request terkait tidak ditemukan." };

    const [winningQuote] = await db
      .select()
      .from(schema.rfqQuotes)
      .where(
        and(eq(schema.rfqQuotes.rfqId, params.rfqId), eq(schema.rfqQuotes.supplierId, params.supplierId))
      );
    if (!winningQuote || winningQuote.status !== "SUBMITTED") {
      return { success: false, message: "Supplier ini belum memberikan penawaran yang valid." };
    }

    const winningItems = await db
      .select()
      .from(schema.rfqQuoteItems)
      .where(eq(schema.rfqQuoteItems.quoteId, winningQuote.id));

    if (winningItems.length === 0) {
      return { success: false, message: "Penawaran supplier ini tidak memiliki rincian item." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.rfqQuotes)
        .set({ status: "AWARDED", updatedAt: new Date() })
        .where(eq(schema.rfqQuotes.id, winningQuote.id));

      await tx
        .update(schema.rfqQuotes)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(
          and(
            eq(schema.rfqQuotes.rfqId, params.rfqId),
            sql`${schema.rfqQuotes.id} != ${winningQuote.id}`
          )
        );

      await tx
        .update(schema.purchaseRfqs)
        .set({ status: "AWARDED", updatedAt: new Date() })
        .where(eq(schema.purchaseRfqs.id, rfq.id));
    });

    const poResult = await createPurchaseOrderAction({
      supplierId: params.supplierId,
      poType: pr.requestType,
      branchId: params.branchId || pr.branchId || undefined,
      warehouseId: params.warehouseId,
      prId: pr.id,
      items: winningItems.map((i) => ({
        productId: i.productId,
        qtyOrdered: num(i.qty),
        unitPrice: num(i.unitPrice),
      })),
      notes: `Dibuat otomatis dari RFQ ${rfq.rfqNumber} (pemenang RFQ).`,
    });

    if (!poResult.success) {
      return {
        success: false,
        message: `RFQ berhasil di-award tetapi gagal membuat PO otomatis: ${poResult.message}. Buat PO secara manual untuk supplier pemenang.`,
      };
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "APPROVE",
      entity: "PurchaseRfq",
      entityId: rfq.id,
    });

    revalidatePath("/purchasing/rfq");
    revalidatePath(`/purchasing/rfq/${params.rfqId}`);
    revalidatePath("/purchasing/orders");

    return { success: true, message: `RFQ ${rfq.rfqNumber} di-award ke supplier terpilih. ${poResult.message}` };
  } catch (error) {
    console.error("awardRfqAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal melakukan award RFQ." };
  }
}

export async function cancelRfqAction(rfqId: string, reason: string): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("pur_rfq", "delete");
    if (denied) return denied;

    const parsed = cancelRfqSchema.safeParse({ rfqId, reason });
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message || "Data tidak valid." };
    }

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const [rfq] = await db
      .select()
      .from(schema.purchaseRfqs)
      .where(
        sql`${schema.purchaseRfqs.id} = ${rfqId} AND ${schema.purchaseRfqs.companyId} = ${user.companyId}`
      );
    if (!rfq) return { success: false, message: "RFQ tidak ditemukan." };
    if (rfq.status === "AWARDED") return { success: false, message: "RFQ yang sudah di-award tidak dapat dibatalkan." };
    if (rfq.status === "CANCELLED") return { success: false, message: "RFQ ini sudah dibatalkan." };

    await db
      .update(schema.purchaseRfqs)
      .set({
        status: "CANCELLED",
        cancelReason: reason,
        cancelledById: user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseRfqs.id, rfqId));

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CANCEL",
      entity: "PurchaseRfq",
      entityId: rfqId,
    });

    revalidatePath("/purchasing/rfq");
    return { success: true, message: `RFQ ${rfq.rfqNumber} berhasil dibatalkan.` };
  } catch (error) {
    console.error("cancelRfqAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal membatalkan RFQ." };
  }
}
