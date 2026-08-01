import { db, schema } from "./index";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting Official Drizzle ORM Database Seeder for PT Lefatech Indonesia...");

  // Generate real bcrypt hashes (Cost factor: 10)
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  // 1. Seed or query Tenant
  let [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.code, "LEFATECH-GLOBAL"));

  if (!tenant) {
    [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: "Lefatech Enterprise Tenant",
        code: "LEFATECH-GLOBAL",
        domain: "lefatech.co.id",
        plan: "ENTERPRISE",
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Tenant:", tenant.code);

  // 2. Seed Tenant-Scoped Site Settings
  let [settings] = await db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.tenantId, tenant.id));

  if (!settings) {
    [settings] = await db
      .insert(schema.siteSettings)
      .values({
        tenantId: tenant.id,
        siteName: "Flex ERP",
        siteTitle: "Flex ERP - PT Lefatech Indonesia Enterprise Portal",
        logoUrl: "/logo/logo.png",
        faviconUrl: "/logo/logo.png",
        primaryColor: "#0284c7",
        accentColor: "#0369a1",
        themeMode: "dark",
        timezone: "Asia/Jakarta",
        dateFormat: "DD/MM/YYYY",
        currency: "IDR",
        currencySymbol: "Rp",
        maintenanceMode: false,
      })
      .returning();
  } else {
    [settings] = await db
      .update(schema.siteSettings)
      .set({
        logoUrl: "/logo/logo.png",
        faviconUrl: "/logo/logo.png",
      })
      .where(eq(schema.siteSettings.id, settings.id))
      .returning();
  }
  console.log("✅ Drizzle Seeded Site Settings Logo URL:", settings.logoUrl);

  // 3. Seed Company
  let [company] = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.code, "LEFATECH-ID"));

  if (!company) {
    [company] = await db
      .insert(schema.companies)
      .values({
        tenantId: tenant.id,
        name: "PT Lefatech Indonesia",
        code: "LEFATECH-ID",
        taxId: "01.992.810.2-015.000",
        email: "info@lefatech.co.id",
        phone: "+62 21 889 0192",
        currency: "IDR",
        isDefault: true,
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Company:", company.name);

  // 4. Seed Branch
  let [branch] = await db
    .select()
    .from(schema.branches)
    .where(eq(schema.branches.code, "BR-LEFA-HQ"));

  if (!branch) {
    [branch] = await db
      .insert(schema.branches)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        name: "Lefatech Head Office Jakarta",
        code: "BR-LEFA-HQ",
        phone: "+62 21 889 0100",
        isHeadquarters: true,
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Branch:", branch.name);

  // 5. Seed Warehouse
  let [warehouse] = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.code, "WH-LEFA-MAIN"));

  if (!warehouse) {
    [warehouse] = await db
      .insert(schema.warehouses)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        branchId: branch.id,
        name: "Lefatech Central Warehouse",
        code: "WH-LEFA-MAIN",
        location: "Jakarta Selatan",
        isDefault: true,
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Warehouse:", warehouse.name);

  // 6. Seed Roles & Permissions
  const ALL_MODULES = [
    "md_products",
    "md_categories",
    "md_units",
    "md_taxes",
    "md_companies",
    "md_branches",
    "md_warehouses",
    "crm_customers",
    "crm_suppliers",
    "sys_users",
    "sys_roles",
    "sys_audit",
  ];
  const ALL_ACTIONS = ["read", "create", "update", "delete", "approve", "export"];

  // 6a. Super Admin Role
  let [superAdminRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, "SUPER_ADMIN"));

  if (!superAdminRole) {
    [superAdminRole] = await db
      .insert(schema.roles)
      .values({
        tenantId: tenant.id,
        code: "SUPER_ADMIN",
        name: "Super Administrator",
        description: "Full unchecked administrative control over all modules",
        isSystem: true,
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Seeded Role:", superAdminRole.name);

  // Seed permissions for Super Admin
  for (const mod of ALL_MODULES) {
    const [existingPerm] = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.roleId, superAdminRole.id));

    // Upsert permissions
    await db
      .insert(schema.permissions)
      .values({
        tenantId: tenant.id,
        roleId: superAdminRole.id,
        module: mod,
        actions: ALL_ACTIONS,
      })
      .onConflictDoNothing();
  }
  console.log("✅ Seeded Permissions for Super Admin (All Modules Granted)");

  // 6b. Inventory Staff Role (Restricted Permissions for testing)
  let [inventoryRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, "INVENTORY_STAFF"));

  if (!inventoryRole) {
    [inventoryRole] = await db
      .insert(schema.roles)
      .values({
        tenantId: tenant.id,
        code: "INVENTORY_STAFF",
        name: "Inventory Staff",
        description: "Access limited to products and product categories only",
        isSystem: false,
        status: "ACTIVE",
      })
      .returning();

    // Grant read/create/update on products and categories
    await db.insert(schema.permissions).values([
      {
        tenantId: tenant.id,
        roleId: inventoryRole.id,
        module: "md_products",
        actions: ["read", "create", "update"],
      },
      {
        tenantId: tenant.id,
        roleId: inventoryRole.id,
        module: "md_categories",
        actions: ["read"],
      },
    ]);
  }
  console.log("✅ Seeded Role:", inventoryRole.name);

  // 7. Seed Users with roleId assigned
  // 7a. Super Admin User
  let [adminUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@lefatech.co.id"));

  if (!adminUser) {
    [adminUser] = await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        branchId: branch.id,
        roleId: superAdminRole.id,
        role: "Super Administrator",
        email: "admin@lefatech.co.id",
        name: "Alexander Wright",
        passwordHash: passwordHash,
        status: "ACTIVE",
      })
      .returning();
  } else {
    // Ensure roleId is linked
    [adminUser] = await db
      .update(schema.users)
      .set({
        roleId: superAdminRole.id,
        role: "Super Administrator",
      })
      .where(eq(schema.users.id, adminUser.id))
      .returning();
  }
  console.log("✅ Seeded Super Admin User:", adminUser.email, "(Role:", adminUser.role + ")");

  // 7b. Staff User (Inventory Staff)
  let [staffUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "staff@lefatech.co.id"));

  if (!staffUser) {
    [staffUser] = await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        branchId: branch.id,
        roleId: inventoryRole.id,
        role: "Inventory Staff",
        email: "staff@lefatech.co.id",
        name: "Rizky Ramadhan",
        passwordHash: passwordHash,
        status: "ACTIVE",
      })
      .returning();
  } else {
    [staffUser] = await db
      .update(schema.users)
      .set({
        roleId: inventoryRole.id,
        role: "Inventory Staff",
      })
      .where(eq(schema.users.id, staffUser.id))
      .returning();
  }
  console.log("✅ Seeded Staff User:", staffUser.email, "(Role:", staffUser.role + ")");

  // 8. Seed Customer
  let [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.code, "CUST-10041"));

  if (!customer) {
    [customer] = await db
      .insert(schema.customers)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        code: "CUST-10041",
        name: "PT Apex Global Dynamics",
        email: "ap@apexglobal.co.id",
        phone: "+62 21 555 9012",
        taxId: "01.991.201.9-012.000",
        creditLimit: "2500000000.00",
        balanceOutstanding: "421500000.00",
        paymentTerms: 30,
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Customer:", customer.name);

  // 9. Seed Product
  let [product] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.code, "PRD-CPU-7950X"));

  if (!product) {
    [product] = await db
      .insert(schema.products)
      .values({
        tenantId: tenant.id,
        companyId: company.id,
        code: "PRD-CPU-7950X",
        sku: "PRD-CPU-7950X",
        name: "Enterprise Microcontroller Module X7",
        category: "Semiconductors",
        type: "GOODS",
        unit: "PCS",
        costPrice: "4200000.00",
        sellingPrice: "8500000.00",
        stockOnHand: "1420.00",
        reorderLevel: "250.00",
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Drizzle Seeded Product:", product.name);

  // 10. Seed Units of Measurement
  const defaultUnits = [
    { code: "PCS", name: "Pieces", symbol: "pcs" },
    { code: "BOX", name: "Box", symbol: "box" },
    { code: "KG", name: "Kilogram", symbol: "kg" },
    { code: "GR", name: "Gram", symbol: "gr" },
    { code: "LTR", name: "Liter", symbol: "ltr" },
    { code: "MTR", name: "Meter", symbol: "m" },
    { code: "SET", name: "Set", symbol: "set" },
    { code: "UNIT", name: "Unit", symbol: "unit" },
    { code: "PACK", name: "Pack", symbol: "pack" },
    { code: "DZN", name: "Dozen", symbol: "dzn" },
    { code: "ROLL", name: "Roll", symbol: "roll" },
    { code: "BTL", name: "Bottle", symbol: "btl" },
  ];

  for (const u of defaultUnits) {
    const [existing] = await db.select().from(schema.units).where(eq(schema.units.code, u.code));
    if (!existing) {
      await db.insert(schema.units).values({ tenantId: tenant.id, ...u });
    }
  }
  console.log("✅ Seeded", defaultUnits.length, "Units of Measurement");

  // 11. Seed Tax Rates
  const defaultTaxes = [
    { code: "PPN11", name: "PPN 11%", rate: "11.00", type: "EXCLUSIVE" },
    { code: "PPN12", name: "PPN 12%", rate: "12.00", type: "EXCLUSIVE" },
    { code: "PPH23", name: "PPh 23 (2%)", rate: "2.00", type: "EXCLUSIVE" },
    { code: "PPH21", name: "PPh 21 (5%)", rate: "5.00", type: "EXCLUSIVE" },
    { code: "PPN0", name: "PPN 0% (Ekspor)", rate: "0.00", type: "EXCLUSIVE" },
    { code: "PPNINC", name: "PPN 11% Inclusive", rate: "11.00", type: "INCLUSIVE" },
  ];

  for (const t of defaultTaxes) {
    const [existing] = await db.select().from(schema.taxes).where(eq(schema.taxes.code, t.code));
    if (!existing) {
      await db.insert(schema.taxes).values({ tenantId: tenant.id, ...t });
    }
  }
  console.log("✅ Seeded", defaultTaxes.length, "Tax Rates");

  console.log("🎉 SUCCESS: Official Drizzle ORM Seeding completed with Super Admin and Staff Users!");
}

main()
  .catch((e) => {
    console.error("❌ Drizzle Seeding Error:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
