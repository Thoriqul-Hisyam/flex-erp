import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const positiveQty = z.number().positive("Qty harus > 0.");
const nonNegativeAmount = z.number().min(0, "Nilai tidak boleh negatif.");

export const createSalesQuotationSchema = z.object({
  customerId: uuid,
  branchId: uuid.optional(),
  validUntil: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyRequested: positiveQty,
        unitPrice: nonNegativeAmount,
        discount: nonNegativeAmount.optional(),
      }),
    )
    .min(1, "Minimal 1 item produk harus diisi."),
});

export const createSalesOrderSchema = z.object({
  customerId: uuid,
  warehouseId: uuid,
  branchId: uuid.optional(),
  sqId: uuid.optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyOrdered: positiveQty,
        unitPrice: nonNegativeAmount,
        discount: nonNegativeAmount.optional(),
      }),
    )
    .min(1, "Minimal 1 item produk pesanan harus diisi."),
});

export const createDeliveryOrderSchema = z.object({
  soId: uuid,
  driverName: z.string().optional(),
  vehicleNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyShipped: positiveQty,
        batchNo: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item pengiriman harus diisi."),
});

export const createSalesReturnSchema = z.object({
  soId: uuid,
  reason: z.string().trim().min(1, "Alasan retur wajib diisi."),
  items: z
    .array(
      z.object({
        productId: uuid,
        qtyReturned: positiveQty,
        batchNo: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item produk retur harus diisi."),
});

export const closeSalesOrderShortSchema = z.object({
  soId: uuid,
  reason: z.string().trim().min(1, "Alasan penutupan short wajib diisi."),
});

export const recordCustomerPaymentSchema = z.object({
  invoiceId: uuid,
  amount: z.number().positive("Jumlah pembayaran harus > 0."),
  paymentMethod: z.string().optional(),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});
