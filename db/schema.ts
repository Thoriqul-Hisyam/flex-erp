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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const tenantPlanEnum = pgEnum("TenantPlan", ["STARTER", "GROWTH", "ENTERPRISE"]);
export const tenantStatusEnum = pgEnum("TenantStatus", ["ACTIVE", "SUSPENDED", "CANCELLED"]);
export const userStatusEnum = pgEnum("UserStatus", ["ACTIVE", "INACTIVE", "BLOCKED"]);
export const productTypeEnum = pgEnum("ProductType", ["GOODS", "SERVICE", "RAW_MATERIAL"]);
export const auditActionEnum = pgEnum("AuditAction", ["CREATE", "UPDATE", "DELETE", "APPROVE", "POST", "CANCEL"]);

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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull().unique(),
  siteName: varchar("site_name", { length: 255 }).default("Flex ERP").notNull(),
  siteTitle: varchar("site_title", { length: 255 }).default("Flex ERP Enterprise Platform"),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 6. Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
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

// 7. Customers Table
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 255 }),
  taxId: varchar("tax_id", { length: 255 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 50 }).default("ID"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).default("0"),
  balanceOutstanding: numeric("balance_outstanding", { precision: 15, scale: 2 }).default("0"),
  paymentTerms: integer("payment_terms").default(30),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 8. Suppliers Table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }),
  type: productTypeEnum("type").default("GOODS"),
  unit: varchar("unit", { length: 50 }).default("PCS"),
  costPrice: numeric("cost_price", { precision: 15, scale: 2 }).default("0"),
  sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }).default("0"),
  stockOnHand: numeric("stock_on_hand", { precision: 15, scale: 2 }).default("0"),
  reorderLevel: numeric("reorder_level", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 10. Audit Logs Table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  actions: json("actions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 14. Units Table (Master Satuan Barang)
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull().default("11.00"),
  type: varchar("type", { length: 50 }).default("EXCLUSIVE"),
  status: varchar("status", { length: 50 }).default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});


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
