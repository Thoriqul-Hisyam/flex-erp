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

