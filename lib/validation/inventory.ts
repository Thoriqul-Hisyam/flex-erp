import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const positiveQty = z.number().positive("Qty harus > 0.");
const nonNegativeAmount = z.number().min(0, "Nilai tidak boleh negatif.");

export const postAdjustmentSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  direction: z.enum(["add", "subtract"]),
  qty: positiveQty,
  unitCost: nonNegativeAmount.optional(),
  reason: z.string().optional(),
});

export const postStockInSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  qty: positiveQty,
  unitCost: nonNegativeAmount.optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  refType: z.string().optional(),
  refId: z.string().optional(),
  note: z.string().optional(),
});

export const postStockOutSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  qty: positiveQty,
  batchId: uuid.optional(),
  refType: z.string().optional(),
  refId: z.string().optional(),
  note: z.string().optional(),
});

export const postTransferSchema = z
  .object({
    productId: uuid,
    fromWarehouseId: uuid,
    toWarehouseId: uuid,
    qty: positiveQty,
    note: z.string().optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Gudang asal dan tujuan tidak boleh sama.",
    path: ["toWarehouseId"],
  });

export const createStockOpnameSchema = z.object({
  warehouseId: uuid,
  notes: z.string().optional(),
});

export const updatePhysicalCountSchema = z.object({
  opnameId: uuid,
  items: z
    .array(
      z.object({
        id: uuid,
        physicalQty: z.number().nullable(),
        notes: z.string().optional(),
      }),
    )
    .min(1, "Minimal 1 item hitungan fisik harus diisi."),
});
