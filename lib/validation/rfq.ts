import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const positiveQty = z.number().positive("Qty harus > 0.");
const nonNegativeAmount = z.number().min(0, "Nilai tidak boleh negatif.");

export const createRfqSchema = z.object({
  prId: uuid,
  supplierIds: z.array(uuid).min(2, "Pilih minimal 2 supplier untuk dibandingkan."),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const recordRfqQuoteSchema = z.object({
  rfqId: uuid,
  supplierId: uuid,
  items: z
    .array(
      z.object({
        productId: uuid,
        unitPrice: nonNegativeAmount,
      }),
    )
    .min(1, "Minimal 1 item harga penawaran harus diisi."),
});

export const awardRfqSchema = z.object({
  rfqId: uuid,
  supplierId: uuid,
  warehouseId: uuid.optional(),
  branchId: uuid.optional(),
});

export const cancelRfqSchema = z.object({
  rfqId: uuid,
  reason: z.string().trim().min(1, "Alasan pembatalan wajib diisi."),
});

export const rfqItemQtySchema = z.object({
  productId: uuid,
  qtyRequested: positiveQty,
});
