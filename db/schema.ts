import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  pgEnum,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const tenantPlanEnum = pgEnum("TenantPlan", [
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
]);
export const tenantStatusEnum = pgEnum("TenantStatus", [
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
]);
export const userStatusEnum = pgEnum("UserStatus", [
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
]);
export const productTypeEnum = pgEnum("ProductType", [
  "GOODS",
  "SERVICE",
  "RAW_MATERIAL",
]);
export const auditActionEnum = pgEnum("AuditAction", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "POST",
  "CANCEL",
]);
export const stockMovementTypeEnum = pgEnum("StockMovementType", [
  "STOCK_IN",
  "STOCK_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_SUBTRACT",
]);
export const batchStatusEnum = pgEnum("BatchStatus", [
  "OPEN",
  "CONSUMED",
  "EXPIRED",
]);
export const warehouseTypeEnum = pgEnum("WarehouseType", ["COMMERCIAL", "INTERNAL_OFFICE"]);
export const opnameStatusEnum = pgEnum("OpnameStatus", [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "ADJUSTED",
  "CANCELLED",
]);
export const prTypeEnum = pgEnum("PrType", ["FOR_RESALE", "INTERNAL_USE"]);
export const prStatusEnum = pgEnum("PrStatus", [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export const poStatusEnum = pgEnum("PoStatus", [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);
export const grStatusEnum = pgEnum("GrStatus", [
  "DRAFT",
  "RECEIVED",
  "CANCELLED",
]);
export const purchasingInvoiceStatusEnum = pgEnum("PurchasingInvoiceStatus", [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);
export const sqStatusEnum = pgEnum("SqStatus", [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
]);
export const soStatusEnum = pgEnum("SoStatus", [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED",
]);
export const doStatusEnum = pgEnum("DoStatus", [
  "DRAFT",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
export const salesInvoiceStatusEnum = pgEnum("SalesInvoiceStatus", [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);
export const employeeStatusEnum = pgEnum("EmployeeStatus", [
  "ACTIVE",
  "INACTIVE",
]);
export const vehicleStatusEnum = pgEnum("VehicleStatus", [
  "ACTIVE",
  "MAINTENANCE",
  "INACTIVE",
]);

// 1. Tenants Table
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }).unique(),
  plan: tenantPlanEnum("plan").default("ENTERPRISE"),
  status: tenantStatusEnum("status").default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 2. Site Settings Table (Multi-Tenant Scoped)
export const siteSettings = pgTable("site_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  siteName: varchar("site_name", { length: 255 }).default("Flex ERP").notNull(),
  siteTitle: varchar("site_title", { length: 255 }).default(
    "Flex ERP Enterprise Platform",
  ),
  logoUrl: varchar("logo_url", { length: 255 }),
  faviconUrl: varchar("favicon_url", { length: 255 }),
  primaryColor: varchar("primary_color", { length: 50 }).default("#3b82f6"),
  accentColor: varchar("accent_color", { length: 50 }).default("#1d4ed8"),
  themeMode: varchar("theme_mode", { length: 20 }).default("dark"),
  timezone: varchar("timezone", { length: 100 }).default("Asia/Jakarta"),
  dateFormat: varchar("date_format", { length: 50 }).default("DD/MM/YYYY"),
  currency: varchar("currency", { length: 10 }).default("IDR"),
  currencySymbol: varchar("currency_symbol", { length: 10 }).default("Rp"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 3. Companies Table
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  taxId: varchar("tax_id", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 255 }),
  currency: varchar("currency", { length: 50 }).default("IDR"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").default(1),
  address: varchar("address", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 255 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 4. Branches Table
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 255 }),
  address: varchar("address", { length: 255 }),
  isHeadquarters: boolean("is_headquarters").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 5. Warehouses Table
export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  type: warehouseTypeEnum("type").default("COMMERCIAL").notNull(),
  location: varchar("location", { length: 255 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 6. Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "set null",
  }),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
  role: varchar("role", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password", { length: 255 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 255 }),
  themePreference: varchar("theme_preference", { length: 50 }).default("light"),
  status: userStatusEnum("status").default("ACTIVE"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 7. Sessions Table (Auth: random token -> user, with expiry & revoke support)
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 8. Customers Table
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 255 }),
  taxId: varchar("tax_id", { length: 255 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 50 }).default("ID"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).default(
    "0",
  ),
  balanceOutstanding: numeric("balance_outstanding", {
    precision: 15,
    scale: 2,
  }).default("0"),
  paymentTerms: integer("payment_terms").default(30),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 8. Suppliers Table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 255 }),
  taxId: varchar("tax_id", { length: 255 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 255 }),
  paymentTerms: integer("payment_terms").default(30),
  rating: numeric("rating", { precision: 3, scale: 1 }).default("5.0"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 9. Products Table
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }),
  type: productTypeEnum("type").default("GOODS"),
  unit: varchar("unit", { length: 50 }).default("PCS"),
  costPrice: numeric("cost_price", { precision: 15, scale: 2 }).default("0"),
  sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }).default(
    "0",
  ),
  stockOnHand: numeric("stock_on_hand", { precision: 15, scale: 2 }).default(
    "0",
  ),
  reorderLevel: numeric("reorder_level", { precision: 15, scale: 2 }).default(
    "0",
  ),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 10. Audit Logs Table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  entity: varchar("entity", { length: 255 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  oldPayload: json("old_payload"),
  newPayload: json("new_payload"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 11. Product Categories Table
export const productCategories = pgTable("product_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 12. Roles Table
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 13. Role Permissions Matrix Table
export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id")
    .references(() => roles.id, { onDelete: "cascade" })
    .notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  actions: json("actions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 14. Units Table (Master Satuan Barang)
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 20 }),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 15. Taxes Table (Master Pajak)
export const taxes = pgTable("taxes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull().default("11.00"),
  type: varchar("type", { length: 50 }).default("EXCLUSIVE"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 16. Warehouse Stocks Table (per-product, per-warehouse stock balances)
export const warehouseStocks = pgTable(
  "warehouse_stocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    warehouseId: uuid("warehouse_id")
      .references(() => warehouses.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    qtyOnHand: numeric("qty_on_hand", { precision: 15, scale: 2 }).default("0"),
    qtyReserved: numeric("qty_reserved", { precision: 15, scale: 2 }).default(
      "0",
    ),
    qtyIncoming: numeric("qty_incoming", { precision: 15, scale: 2 }).default(
      "0",
    ),
    avgCost: numeric("avg_cost", { precision: 15, scale: 2 }).default("0"),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("warehouse_stocks_wh_product_idx").on(
      table.warehouseId,
      table.productId,
    ),
  ],
);

// 17. Stock Movements Table (immutable stock ledger / audit trail)
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    type: stockMovementTypeEnum("type").notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "restrict" })
      .notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    qty: numeric("qty", { precision: 15, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0"),
    beforeQty: numeric("before_qty", { precision: 15, scale: 2 }).default("0"),
    afterQty: numeric("after_qty", { precision: 15, scale: 2 }).default("0"),
    batchId: uuid("batch_id").references(() => batches.id, {
      onDelete: "set null",
    }),
    refType: varchar("ref_type", { length: 50 }),
    refId: varchar("ref_id", { length: 255 }),
    note: text("note"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("stock_movements_product_idx").on(table.productId),
    index("stock_movements_warehouse_idx").on(table.warehouseId),
    index("stock_movements_created_idx").on(table.createdAt),
  ],
);

// 18. Batches Table (batch tracking & expiry date management)
export const batches = pgTable(
  "batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    warehouseId: uuid("warehouse_id")
      .references(() => warehouses.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    batchNo: varchar("batch_no", { length: 100 }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    qtyIn: numeric("qty_in", { precision: 15, scale: 2 }).default("0"),
    qtyOut: numeric("qty_out", { precision: 15, scale: 2 }).default("0"),
    qtyRemaining: numeric("qty_remaining", { precision: 15, scale: 2 }).default(
      "0",
    ),
    costPrice: numeric("cost_price", { precision: 15, scale: 2 }).default("0"),
    status: batchStatusEnum("status").default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("batches_product_idx").on(table.productId, table.batchNo),
    index("batches_expiry_idx").on(table.expiryDate),
  ],
);

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    opnameNumber: varchar("opname_number", { length: 50 }).notNull(),
    warehouseId: uuid("warehouse_id")
      .references(() => warehouses.id, { onDelete: "cascade" })
      .notNull(),
    status: opnameStatusEnum("status").default("DRAFT").notNull(),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    adjustedById: uuid("adjusted_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("stock_opnames_tenant_company_idx").on(table.tenantId, table.companyId),
    index("stock_opnames_warehouse_idx").on(table.warehouseId),
  ],
);

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    opnameId: uuid("opname_id")
      .references(() => stockOpnames.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    batchNo: varchar("batch_no", { length: 100 }),
    systemQty: numeric("system_qty", { precision: 15, scale: 2 }).default("0").notNull(),
    physicalQty: numeric("physical_qty", { precision: 15, scale: 2 }),
    varianceQty: numeric("variance_qty", { precision: 15, scale: 2 }).default("0").notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0").notNull(),
    varianceCost: numeric("variance_cost", { precision: 15, scale: 2 }).default("0").notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("stock_opname_items_opname_idx").on(table.opnameId),
    index("stock_opname_items_product_idx").on(table.productId),
  ],
);

// 19. Purchase Requests
export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    prNumber: varchar("pr_number", { length: 50 }).notNull(),
    requestType: prTypeEnum("request_type").default("FOR_RESALE").notNull(),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    department: varchar("department", { length: 100 }),
    status: prStatusEnum("status").default("DRAFT").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("pr_tenant_company_idx").on(table.tenantId, table.companyId),
  ],
);

export const purchaseRequestItems = pgTable(
  "purchase_request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    prId: uuid("pr_id")
      .references(() => purchaseRequests.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    qtyRequested: numeric("qty_requested", { precision: 15, scale: 2 }).default("1").notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0"),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("pr_items_pr_idx").on(table.prId),
  ],
);

// 20. Purchase Orders
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    poNumber: varchar("po_number", { length: 50 }).notNull(),
    poType: prTypeEnum("po_type").default("FOR_RESALE").notNull(),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "cascade" })
      .notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    prId: uuid("pr_id").references(() => purchaseRequests.id, { onDelete: "set null" }),
    status: poStatusEnum("status").default("DRAFT").notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("po_tenant_company_idx").on(table.tenantId, table.companyId),
    index("po_supplier_idx").on(table.supplierId),
    index("po_warehouse_idx").on(table.warehouseId),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    poId: uuid("po_id")
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    qtyOrdered: numeric("qty_ordered", { precision: 15, scale: 2 }).default("1").notNull(),
    qtyReceived: numeric("qty_received", { precision: 15, scale: 2 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("po_items_po_idx").on(table.poId),
  ],
);

// 21. Goods Receipts
export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    grNumber: varchar("gr_number", { length: 50 }).notNull(),
    poId: uuid("po_id")
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "cascade" })
      .notNull(),
    status: grStatusEnum("status").default("RECEIVED").notNull(),
    receivedById: uuid("received_by_id").references(() => users.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("gr_tenant_company_idx").on(table.tenantId, table.companyId),
    index("gr_po_idx").on(table.poId),
  ],
);

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    grId: uuid("gr_id")
      .references(() => goodsReceipts.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    batchNo: varchar("batch_no", { length: 100 }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    qtyReceived: numeric("qty_received", { precision: 15, scale: 2 }).default("1").notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("gr_items_gr_idx").on(table.grId),
  ],
);

// 22. Supplier Invoices & Payments
export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    poId: uuid("po_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "cascade" })
      .notNull(),
    status: purchasingInvoiceStatusEnum("status").default("UNPAID").notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("sup_inv_tenant_company_idx").on(table.tenantId, table.companyId),
    index("sup_inv_supplier_idx").on(table.supplierId),
  ],
);

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    paymentNumber: varchar("payment_number", { length: 50 }).notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => supplierInvoices.id, { onDelete: "cascade" })
      .notNull(),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "cascade" })
      .notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).default("0").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).default("TRANSFER"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).defaultNow(),
    referenceNo: varchar("reference_no", { length: 100 }),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("sup_pay_tenant_company_idx").on(table.tenantId, table.companyId),
    index("sup_pay_invoice_idx").on(table.invoiceId),
  ],
);

// 23. Sales Quotations
export const salesQuotations = pgTable(
  "sales_quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    sqNumber: varchar("sq_number", { length: 50 }).notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: sqStatusEnum("status").default("DRAFT").notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("sq_tenant_company_idx").on(table.tenantId, table.companyId),
    index("sq_customer_idx").on(table.customerId),
  ],
);

export const salesQuotationItems = pgTable(
  "sales_quotation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    sqId: uuid("sq_id")
      .references(() => salesQuotations.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    qtyRequested: numeric("qty_requested", { precision: 15, scale: 2 }).default("1").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
    discount: numeric("discount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    index("sq_items_sq_idx").on(table.sqId),
  ],
);

// 24. Sales Orders
export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    soNumber: varchar("so_number", { length: 50 }).notNull(),
    sqId: uuid("sq_id").references(() => salesQuotations.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    status: soStatusEnum("status").default("DRAFT").notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("so_tenant_company_idx").on(table.tenantId, table.companyId),
    index("so_customer_idx").on(table.customerId),
  ],
);

export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    soId: uuid("so_id")
      .references(() => salesOrders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    qtyOrdered: numeric("qty_ordered", { precision: 15, scale: 2 }).default("1").notNull(),
    qtyDelivered: numeric("qty_delivered", { precision: 15, scale: 2 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
    discount: numeric("discount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    index("so_items_so_idx").on(table.soId),
  ],
);

// 25. Delivery Orders (Surat Jalan / Stock OUT Execution)
export const deliveryOrders = pgTable(
  "delivery_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    doNumber: varchar("do_number", { length: 50 }).notNull(),
    soId: uuid("so_id")
      .references(() => salesOrders.id, { onDelete: "cascade" })
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    warehouseId: uuid("warehouse_id")
      .references(() => warehouses.id, { onDelete: "cascade" })
      .notNull(),
    status: doStatusEnum("status").default("SHIPPED").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }).defaultNow(),
    driverEmployeeId: uuid("driver_employee_id").references(() => employees.id, { onDelete: "set null" }),
    driverName: varchar("driver_name", { length: 100 }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("do_tenant_company_idx").on(table.tenantId, table.companyId),
    index("do_so_idx").on(table.soId),
  ],
);

export const deliveryOrderItems = pgTable(
  "delivery_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    doId: uuid("do_id")
      .references(() => deliveryOrders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    batchNo: varchar("batch_no", { length: 100 }),
    qtyShipped: numeric("qty_shipped", { precision: 15, scale: 2 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    index("do_items_do_idx").on(table.doId),
  ],
);

// 26. Customer Invoices & Payments
export const customerInvoices = pgTable(
  "customer_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    soId: uuid("so_id").references(() => salesOrders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    status: salesInvoiceStatusEnum("status").default("UNPAID").notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("cust_inv_tenant_company_idx").on(table.tenantId, table.companyId),
    index("cust_inv_customer_idx").on(table.customerId),
  ],
);

export const customerPayments = pgTable(
  "customer_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    paymentNumber: varchar("payment_number", { length: 50 }).notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => customerInvoices.id, { onDelete: "cascade" })
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).default("0").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).default("TRANSFER"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).defaultNow(),
    referenceNo: varchar("reference_no", { length: 100 }),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("cust_pay_tenant_company_idx").on(table.tenantId, table.companyId),
    index("cust_pay_invoice_idx").on(table.invoiceId),
  ],
);

// 27. Employees (Master Data Karyawan)
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    employeeCode: varchar("employee_code", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    jobTitle: varchar("job_title", { length: 100 }).default("Staff"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: employeeStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("emp_tenant_company_idx").on(table.tenantId, table.companyId),
    index("emp_code_idx").on(table.employeeCode),
  ],
);

// 28. Vehicles (Master Data Armada / Kendaraan)
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    vehicleCode: varchar("vehicle_code", { length: 50 }).notNull(),
    plateNumber: varchar("plate_number", { length: 50 }).notNull(),
    vehicleType: varchar("vehicle_type", { length: 100 }).default("Truck Box"),
    brandModel: varchar("brand_model", { length: 150 }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    status: vehicleStatusEnum("status").default("ACTIVE").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("veh_tenant_company_idx").on(table.tenantId, table.companyId),
    index("veh_plate_idx").on(table.plateNumber),
  ],
);

// -----------------------------------------------------------------------------
// Drizzle Relational Queries Definitions (Official Drizzle ORM Best Practice)
// -----------------------------------------------------------------------------

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  siteSettings: one(siteSettings, {
    fields: [tenants.id],
    references: [siteSettings.tenantId],
  }),
  companies: many(companies),
  users: many(users),
  auditLogs: many(auditLogs),
}));

export const siteSettingsRelations = relations(siteSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [siteSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),
  branches: many(branches),
  warehouses: many(warehouses),
  customers: many(customers),
  suppliers: many(suppliers),
  products: many(products),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const warehouseStocksRelations = relations(
  warehouseStocks,
  ({ one }) => ({
    warehouse: one(warehouses, {
      fields: [warehouseStocks.warehouseId],
      references: [warehouses.id],
    }),
    product: one(products, {
      fields: [warehouseStocks.productId],
      references: [products.id],
    }),
  }),
);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  batch: one(batches, {
    fields: [stockMovements.batchId],
    references: [batches.id],
  }),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [batches.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
}));

export const stockOpnamesRelations = relations(stockOpnames, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [stockOpnames.warehouseId],
    references: [warehouses.id],
  }),
  createdBy: one(users, {
    fields: [stockOpnames.createdById],
    references: [users.id],
  }),
  items: many(stockOpnameItems),
}));

export const stockOpnameItemsRelations = relations(stockOpnameItems, ({ one }) => ({
  opname: one(stockOpnames, {
    fields: [stockOpnameItems.opnameId],
    references: [stockOpnames.id],
  }),
  product: one(products, {
    fields: [stockOpnameItems.productId],
    references: [products.id],
  }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
  requestedBy: one(users, {
    fields: [purchaseRequests.requestedById],
    references: [users.id],
  }),
  items: many(purchaseRequestItems),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseOrders.warehouseId],
    references: [warehouses.id],
  }),
  createdBy: one(users, {
    fields: [purchaseOrders.createdById],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceipts.poId],
    references: [purchaseOrders.id],
  }),
  warehouse: one(warehouses, {
    fields: [goodsReceipts.warehouseId],
    references: [warehouses.id],
  }),
  supplier: one(suppliers, {
    fields: [goodsReceipts.supplierId],
    references: [suppliers.id],
  }),
  items: many(goodsReceiptItems),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplierInvoices.supplierId],
    references: [suppliers.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [supplierInvoices.poId],
    references: [purchaseOrders.id],
  }),
  payments: many(supplierPayments),
}));

// 23. Departments Table (Master Departemen / Divisi)
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const departmentsRelations = relations(departments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
}));


