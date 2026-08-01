export interface CompanyData {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  currency?: string;
  branchesCount?: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface BranchData {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  city?: string;
  phone?: string;
  isHeadquarters?: boolean;
  warehousesCount?: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface DepartmentData {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface WarehouseData {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  branchName?: string;
  location?: string;
  capacityUtilization: number;
  isDefault?: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface CustomerData {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  balanceOutstanding: number;
  paymentTerms?: number;
  taxId?: string;
  city?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface SupplierData {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  paymentTerms?: number;
  rating?: number | string;
  city?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface ProductData {
  id: string;
  code: string;
  sku: string;
  name: string;
  category?: string;
  categoryId?: string;
  defaultWarehouse?: string;
  warehouseId?: string;
  type: "GOODS" | "SERVICE" | "RAW_MATERIAL";
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stockOnHand: number;
  reorderLevel: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface AuditLogData {
  id: string;
  timestamp: string;
  user: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "POST";
  entity: string;
  entityId: string;
  details: string;
  ipAddress?: string;
}

export interface UserAccountData {
  id: string;
  code: string;
  name: string;
  email: string;
  role: string;
  roleId?: string;
  companyName?: string;
  branchName?: string;
  lastLogin?: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
}

export interface RoleData {
  id: string;
  code: string;
  name: string;
  description?: string;
  usersCount?: number;
  permissionsCount?: number;
  permissions?: Record<string, string[]>;
  isSystem?: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface TaxData {
  id: string;
  code: string;
  name: string;
  rate: number;
  type: "EXCLUSIVE" | "INCLUSIVE";
  status: "ACTIVE" | "INACTIVE";
}

export interface ProductCategoryData {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface RoleData {
  id: string;
  code: string;
  name: string;
  description?: string;
  usersCount?: number;
  isSystem?: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface UnitData {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  status: "ACTIVE" | "INACTIVE";
}

export type StockMovementType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_SUBTRACT";

export interface WarehouseStockData {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyIncoming: number;
  qtyAvailable: number;
  avgCost: number;
  stockValue: number;
  reorderLevel?: number;
  status?: string;
  lastMovementAt?: string;
}

export interface StockMovementData {
  id: string;
  type: StockMovementType;
  productId: string;
  productName?: string;
  productSku?: string;
  warehouseId?: string;
  warehouseName?: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  qty: number;
  unitCost: number;
  beforeQty: number;
  afterQty: number;
  batchNo?: string;
  refType?: string;
  refId?: string;
  note?: string;
  userName?: string;
  createdAt?: string;
}

export interface BatchData {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productName?: string;
  productSku?: string;
  batchNo: string;
  expiryDate?: string;
  qtyIn: number;
  qtyOut: number;
  qtyRemaining: number;
  costPrice: number;
  status: "OPEN" | "CONSUMED" | "EXPIRED";
  isExpiringSoon?: boolean;
  isExpired?: boolean;
  createdAt?: string;
}

export interface InventoryOverviewData {
  totalSku: number;
  totalWarehouses: number;
  stockValue: number;
  lowStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  byWarehouse: {
    warehouseId: string;
    warehouseName: string;
    qtyOnHand: number;
    stockValue: number;
  }[];
  lowStockItems: {
    productId: string;
    productName: string;
    sku: string;
    warehouseName: string;
    qtyOnHand: number;
    reorderLevel: number;
  }[];
}

export type StockOpnameStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ADJUSTED"
  | "CANCELLED";

export interface StockOpnameItemData {
  id: string;
  opnameId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  batchNo?: string;
  systemQty: number;
  physicalQty: number | null;
  varianceQty: number;
  unitCost: number;
  varianceCost: number;
  notes?: string;
}

export interface StockOpnameData {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  warehouseName?: string;
  status: StockOpnameStatus;
  notes?: string;
  totalItems: number;
  totalDiscrepancies: number;
  totalVarianceCost: number;
  createdByName?: string;
  adjustedByName?: string;
  createdAt: string;
  updatedAt: string;
  items?: StockOpnameItemData[];
}

export type PurchaseRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type GoodsReceiptStatus = "DRAFT" | "RECEIVED" | "CANCELLED";

export type PurchasingInvoiceStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

export interface PurchaseRequestItemData {
  id: string;
  prId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  qtyRequested: number;
  unitCost: number;
  notes?: string;
}

export interface PurchaseRequestData {
  id: string;
  prNumber: string;
  department?: string;
  status: PurchaseRequestStatus;
  notes?: string;
  totalItems: number;
  requestedByName?: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseRequestItemData[];
}

export interface PurchaseOrderItemData {
  id: string;
  poId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrderData {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  warehouseId: string;
  warehouseName?: string;
  prId?: string;
  status: PurchaseOrderStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  createdByName?: string;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItemData[];
}

export interface GoodsReceiptItemData {
  id: string;
  grId: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  batchNo?: string;
  expiryDate?: string;
  qtyReceived: number;
  unitCost: number;
}

export interface GoodsReceiptData {
  id: string;
  grNumber: string;
  poId: string;
  poNumber?: string;
  warehouseId: string;
  warehouseName?: string;
  supplierId: string;
  supplierName?: string;
  status: GoodsReceiptStatus;
  receivedByName?: string;
  receivedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: GoodsReceiptItemData[];
}

export interface SupplierInvoiceData {
  id: string;
  invoiceNumber: string;
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName?: string;
  status: PurchasingInvoiceStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPaymentData {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber?: string;
  supplierId: string;
  supplierName?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNo?: string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
}


