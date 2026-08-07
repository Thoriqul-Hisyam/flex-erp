import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const positiveQty = z.number().positive("Qty harus > 0.");
const nonNegativeAmount = z.number().min(0, "Nilai tidak boleh negatif.");

export const createPurchaseRequestSchema = z.object({
  requestType: z.enum(["FOR_RESALE", "INTERNAL_USE"]).optional(),
  branchId: uuid.optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyRequested: positiveQty,
        unitCost: nonNegativeAmount.optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item produk harus diisi."),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: uuid,
  poType: z.enum(["FOR_RESALE", "INTERNAL_USE"]).optional(),
  branchId: uuid.optional(),
  warehouseId: uuid.optional(),
  prId: uuid.optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyOrdered: positiveQty,
        unitPrice: nonNegativeAmount,
      }),
    )
    .min(1, "Minimal 1 item produk harus diisi."),
});

export const createGoodsReceiptSchema = z.object({
  poId: uuid,
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyReceived: positiveQty,
        unitCost: nonNegativeAmount,
        batchNo: z.string().optional(),
        expiryDate: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item penerimaan barang harus diisi."),
});

export const closePurchaseOrderShortSchema = z.object({
  poId: uuid,
  reason: z.string().trim().min(1, "Alasan penutupan short wajib diisi."),
});

export const recordSupplierPaymentSchema = z.object({
  invoiceId: uuid,
  amount: z.number().positive("Jumlah pembayaran harus > 0."),
  paymentMethod: z.string().optional(),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});
