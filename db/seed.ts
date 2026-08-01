import { db, schema } from "./index";
import * as bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";

async function main() {
  console.log(
    "🚀 Starting Official Drizzle ORM Comprehensive Database Seeder for Flex ERP...",
  );

  // Real bcrypt hash for Password123!
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  // 1. Seed Tenant
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
  console.log("✅ Seeded Tenant:", tenant.code);

  // 2. Seed Tenant Site Settings
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
  }
  console.log("✅ Seeded Site Settings");

  // 3. Seed Companies
  const companiesList = [
    { name: "PT Lefatech Indonesia", code: "LEFATECH-ID", taxId: "01.992.810.2-015.000", email: "info@lefatech.co.id", phone: "+62 21 889 0192", currency: "IDR", isDefault: true },
    { name: "PT Lefatech Distribusi Nusantara", code: "LEFATECH-DIST", taxId: "02.881.990.1-016.000", email: "dist@lefatech.co.id", phone: "+62 31 778 0011", currency: "IDR", isDefault: false },
  ];

  const seededCompanies: Record<string, any> = {};
  for (const c of companiesList) {
    let [comp] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.code, c.code));
    if (!comp) {
      [comp] = await db
        .insert(schema.companies)
        .values({
          tenantId: tenant.id,
          ...c,
        })
        .returning();
    }
    seededCompanies[c.code] = comp;
  }
  const mainCompany = seededCompanies["LEFATECH-ID"];
  console.log("✅ Seeded", Object.keys(seededCompanies).length, "Companies");

  // 4. Seed Branches
  const branchesList = [
    { code: "BR-LEFA-HQ", name: "Lefatech Head Office Jakarta", phone: "+62 21 889 0100", isHeadquarters: true },
    { code: "BR-LEFA-SUB", name: "Lefatech Surabaya Regional Branch", phone: "+62 31 778 0100", isHeadquarters: false },
    { code: "BR-LEFA-BDG", name: "Lefatech Bandung Branch", phone: "+62 22 420 8900", isHeadquarters: false },
  ];

  const seededBranches: Record<string, any> = {};
  for (const b of branchesList) {
    let [br] = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.code, b.code));
    if (!br) {
      [br] = await db
        .insert(schema.branches)
        .values({
          tenantId: tenant.id,
          companyId: mainCompany.id,
          ...b,
        })
        .returning();
    }
    seededBranches[b.code] = br;
  }
  const mainBranch = seededBranches["BR-LEFA-HQ"];
  console.log("✅ Seeded", Object.keys(seededBranches).length, "Branches");

  // 5. Seed Warehouses
  const warehousesList = [
    { code: "WH-LEFA-MAIN", name: "Lefatech Central Warehouse Jakarta", location: "Jakarta Selatan", type: "COMMERCIAL" as const, isDefault: true, branchId: mainBranch.id },
    { code: "WH-LEFA-SUB", name: "Gudang Transit & Distribusi Surabaya", location: "Surabaya Industrial Estate", type: "COMMERCIAL" as const, isDefault: false, branchId: seededBranches["BR-LEFA-SUB"].id },
    { code: "WH-LEFA-BDG", name: "Gudang Logistik Regional Bandung", location: "Kawasan Industri Cimahi", type: "COMMERCIAL" as const, isDefault: false, branchId: seededBranches["BR-LEFA-BDG"].id },
    { code: "WH-OFFICE-HQ", name: "Gudang Perlengkapan & Inventaris Kantor (Jakarta HQ)", location: "Jakarta Head Office", type: "INTERNAL_OFFICE" as const, isDefault: false, branchId: mainBranch.id },
    { code: "WH-OFFICE-SUB", name: "Gudang Perlengkapan & Inventaris Kantor (Surabaya)", location: "Surabaya Branch", type: "INTERNAL_OFFICE" as const, isDefault: false, branchId: seededBranches["BR-LEFA-SUB"].id },
  ];

  const seededWarehouses: Record<string, any> = {};
  for (const w of warehousesList) {
    let [wh] = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.code, w.code));
    if (!wh) {
      [wh] = await db
        .insert(schema.warehouses)
        .values({
          tenantId: tenant.id,
          companyId: mainCompany.id,
          ...w,
        })
        .returning();
    }
    seededWarehouses[w.code] = wh;
  }
  const mainWarehouse = seededWarehouses["WH-LEFA-MAIN"];
  console.log("✅ Seeded", Object.keys(seededWarehouses).length, "Warehouses");

  // 6. Seed Roles & Permissions
  const ALL_MODULES = [
    "md_products",
    "md_categories",
    "md_units",
    "md_taxes",
    "md_departments",
    "md_companies",
    "md_branches",
    "md_warehouses",
    "crm_customers",
    "crm_suppliers",
    "inv_stocks",
    "inv_movements",
    "inv_adjustments",
    "inv_transfers",
    "inv_batches",
    "inv_opnames",
    "pur_requests",
    "pur_orders",
    "pur_receipts",
    "pur_invoices",
    "sys_users",
    "sys_roles",
    "sys_audit",
  ];
  const ALL_ACTIONS = ["read", "create", "update", "delete", "approve", "export"];

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

  for (const mod of ALL_MODULES) {
    const [existingPerm] = await db
      .select()
      .from(schema.permissions)
      .where(
        and(
          eq(schema.permissions.roleId, superAdminRole.id),
          eq(schema.permissions.module, mod)
        )
      );

    if (!existingPerm) {
      await db.insert(schema.permissions).values({
        tenantId: tenant.id,
        roleId: superAdminRole.id,
        module: mod,
        actions: ALL_ACTIONS,
      });
    }
  }

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
        description: "Access limited to inventory and stock operations",
        isSystem: false,
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Seeded Roles & Permissions");

  // 7. Seed Users
  let [adminUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@lefatech.co.id"));

  if (!adminUser) {
    [adminUser] = await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        branchId: mainBranch.id,
        roleId: superAdminRole.id,
        role: "Super Administrator",
        email: "admin@lefatech.co.id",
        name: "Alexander Wright",
        passwordHash,
        status: "ACTIVE",
      })
      .returning();
  }

  let [staffUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "staff@lefatech.co.id"));

  if (!staffUser) {
    [staffUser] = await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        branchId: mainBranch.id,
        roleId: inventoryRole.id,
        role: "Inventory Staff",
        email: "staff@lefatech.co.id",
        name: "Rizky Ramadhan",
        passwordHash,
        status: "ACTIVE",
      })
      .returning();
  }
  console.log("✅ Seeded Users (admin@lefatech.co.id & staff@lefatech.co.id)");

  // 8. Seed Departments
  const deptList = [
    { code: "DEP-LOGISTICS", name: "Gudang & Logistik", description: "Pengelolaan persediaan dan pengadaan barang." },
    { code: "DEP-OPS", name: "Operational & IT", description: "Operasional sistem dan infrastruktur IT." },
    { code: "DEP-FIN", name: "Finance & Accounting", description: "Keuangan dan akuntansi perusahaan." },
    { code: "DEP-SALES", name: "Sales & Marketing", description: "Penjualan dan pemasaran produk." },
    { code: "DEP-HR", name: "HR & General Affairs", description: "Sumber daya manusia dan urusan umum." },
    { code: "DEP-PROD", name: "Produksi & Manufaktur", description: "Perencanaan dan proses produksi barang." },
  ];

  for (const d of deptList) {
    const [existing] = await db
      .select()
      .from(schema.departments)
      .where(
        and(
          eq(schema.departments.companyId, mainCompany.id),
          eq(schema.departments.code, d.code)
        )
      );
    if (!existing) {
      await db.insert(schema.departments).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        code: d.code,
        name: d.name,
        description: d.description,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded", deptList.length, "Departments");

  // 9. Seed Product Categories
  const categoriesList = [
    { code: "CAT-ELEC", name: "Elektronik & Perangkat Komputer", description: "Komponen komputer, microchip, monitor, & UPS." },
    { code: "CAT-RAW", name: "Bahan Baku & Komponen Industri", description: "Material dasar manufaktur & perakitan." },
    { code: "CAT-OFFICE", name: "Perlengkapan & ATK Kantor", description: "Kertas, alat tulis, dan konsumsi kantor." },
    { code: "CAT-SPARE", name: "Suku Cadang & Spareparts", description: "Bearing, kabel, valve, & suku cadang mesin." },
    { code: "CAT-CHEM", name: "Bahan Kimia & Pembersih", description: "Liquid solvent cleaner & bahan perawatan." },
  ];

  for (const c of categoriesList) {
    const [existing] = await db
      .select()
      .from(schema.productCategories)
      .where(eq(schema.productCategories.code, c.code));
    if (!existing) {
      await db.insert(schema.productCategories).values({
        tenantId: tenant.id,
        code: c.code,
        name: c.name,
        description: c.description,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded", categoriesList.length, "Product Categories");

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
    const [existing] = await db
      .select()
      .from(schema.units)
      .where(eq(schema.units.code, u.code));
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
    const [existing] = await db
      .select()
      .from(schema.taxes)
      .where(eq(schema.taxes.code, t.code));
    if (!existing) {
      await db.insert(schema.taxes).values({ tenantId: tenant.id, ...t });
    }
  }
  console.log("✅ Seeded", defaultTaxes.length, "Tax Rates");

  // 12. Seed Customers
  const customersList = [
    { code: "CUST-10041", name: "PT Apex Global Dynamics", email: "ap@apexglobal.co.id", phone: "+62 21 555 9012", taxId: "01.991.201.9-012.000", creditLimit: "2500000000.00", balanceOutstanding: "421500000.00", paymentTerms: 30 },
    { code: "CUST-10042", name: "CV Solusi Teknologi Mandiri", email: "procurement@solusitek.co.id", phone: "+62 21 778 1122", taxId: "02.112.445.8-014.000", creditLimit: "500000000.00", balanceOutstanding: "85000000.00", paymentTerms: 14 },
    { code: "CUST-10043", name: "PT Triutama Mitra Sejahtera", email: "admin@triutama.co.id", phone: "+62 31 889 4455", taxId: "03.443.112.5-018.000", creditLimit: "1200000000.00", balanceOutstanding: "0.00", paymentTerms: 30 },
    { code: "CUST-10044", name: "Megah Jaya Retail Corp", email: "buying@megahjaya.com", phone: "+62 22 411 9000", taxId: "04.554.887.1-019.000", creditLimit: "800000000.00", balanceOutstanding: "125000000.00", paymentTerms: 30 },
  ];

  for (const cust of customersList) {
    const [existing] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.code, cust.code));
    if (!existing) {
      await db.insert(schema.customers).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        ...cust,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded", customersList.length, "Customers");

  // 13. Seed Suppliers
  const suppliersList = [
    { code: "SUP-001", name: "PT Nusantara Komponindo Utama", email: "sales@komponindo.co.id", phone: "+62 21 890 1122", taxId: "01.223.445.1-011.000", paymentTerms: 30, rating: "4.8" },
    { code: "SUP-002", name: "CV Sinar Jaya Abadi Paper", email: "orders@sinarjaya.co.id", phone: "+62 21 665 9900", taxId: "02.334.112.9-013.000", paymentTerms: 14, rating: "4.5" },
    { code: "SUP-003", name: "PT Delta Teknik Industri", email: "info@deltateknik.co.id", phone: "+62 31 556 7788", taxId: "03.887.114.2-017.000", paymentTerms: 30, rating: "4.9" },
    { code: "SUP-004", name: "Global Chemical Indonesia", email: "sales@globalchemical.co.id", phone: "+62 22 700 8811", taxId: "04.119.332.0-020.000", paymentTerms: 30, rating: "4.7" },
  ];

  for (const sup of suppliersList) {
    const [existing] = await db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.code, sup.code));
    if (!existing) {
      await db.insert(schema.suppliers).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        ...sup,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded", suppliersList.length, "Suppliers");

  // 14. Seed Products (Multiple Realistic SKUs)
  const productsList: Array<{
    code: string;
    sku: string;
    name: string;
    category: string;
    type: "GOODS" | "SERVICE" | "RAW_MATERIAL";
    unit: string;
    costPrice: string;
    sellingPrice: string;
    stockOnHand: string;
    reorderLevel: string;
  }> = [
    { code: "PRD-CPU-7950X", sku: "PRD-CPU-7950X", name: "Enterprise Microcontroller Module X7", category: "Elektronik & Perangkat Komputer", type: "GOODS", unit: "PCS", costPrice: "4200000.00", sellingPrice: "8500000.00", stockOnHand: "1420.00", reorderLevel: "250.00" },
    { code: "PRD-MON-27", sku: "PRD-MON-27", name: "Monitor IPS 27 Inch Enterprise 4K", category: "Elektronik & Perangkat Komputer", type: "GOODS", unit: "UNIT", costPrice: "3100000.00", sellingPrice: "5200000.00", stockOnHand: "150.00", reorderLevel: "30.00" },
    { code: "PRD-OFF-PAPER-A4", sku: "PRD-OFF-PAPER-A4", name: "Kertas HVS A4 80gr Sinar Dunia", category: "Perlengkapan & ATK Kantor", type: "GOODS", unit: "BOX", costPrice: "210000.00", sellingPrice: "275000.00", stockOnHand: "500.00", reorderLevel: "100.00" },
    { code: "PRD-IND-BEARING-6204", sku: "PRD-IND-BEARING-6204", name: "Ball Bearing Industri 6204-2RS", category: "Suku Cadang & Spareparts", type: "GOODS", unit: "PCS", costPrice: "85000.00", sellingPrice: "145000.00", stockOnHand: "800.00", reorderLevel: "150.00" },
    { code: "PRD-CHEM-CLEANER-5L", sku: "PRD-CHEM-CLEANER-5L", name: "Liquid Solvent Cleaner 5L", category: "Bahan Kimia & Pembersih", type: "GOODS", unit: "BTL", costPrice: "175000.00", sellingPrice: "260000.00", stockOnHand: "240.00", reorderLevel: "50.00" },
    { code: "PRD-CABLE-CAT6-300M", sku: "PRD-CABLE-CAT6-300M", name: "Kabel UTP Cat6 305m Draka", category: "Elektronik & Perangkat Komputer", type: "GOODS", unit: "ROLL", costPrice: "1850000.00", sellingPrice: "2450000.00", stockOnHand: "85.00", reorderLevel: "20.00" },
    { code: "PRD-UPS-2000VA", sku: "PRD-UPS-2000VA", name: "UPS Server Online 2000VA Smart-APC", category: "Elektronik & Perangkat Komputer", type: "GOODS", unit: "UNIT", costPrice: "6800000.00", sellingPrice: "9800000.00", stockOnHand: "45.00", reorderLevel: "10.00" },
  ];

  for (const p of productsList) {
    const [existing] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.code, p.code));
    if (!existing) {
      await db.insert(schema.products).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        ...p,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded", productsList.length, "Products");

  // 15. Seed Warehouse Stock Balances, Batches & Opening Movements
  const allSeededProducts = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.companyId, mainCompany.id));

  for (const prod of allSeededProducts) {
    const cost = Number(prod.costPrice || 0) || 100000;
    const onHand = Number(prod.stockOnHand || 0) || 50;

    const [existingStock] = await db
      .select()
      .from(schema.warehouseStocks)
      .where(
        and(
          eq(schema.warehouseStocks.warehouseId, mainWarehouse.id),
          eq(schema.warehouseStocks.productId, prod.id)
        )
      );

    if (!existingStock) {
      await db.insert(schema.warehouseStocks).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        warehouseId: mainWarehouse.id,
        productId: prod.id,
        qtyOnHand: String(onHand),
        qtyReserved: String(Math.round(onHand * 0.1)),
        qtyIncoming: "0",
        avgCost: String(cost),
        lastMovementAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
    }

    const [existsMov] = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, prod.id))
      .limit(1);

    if (!existsMov) {
      await db.insert(schema.stockMovements).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        type: "STOCK_IN",
        productId: prod.id,
        warehouseId: mainWarehouse.id,
        qty: String(onHand),
        unitCost: String(cost),
        beforeQty: "0",
        afterQty: String(onHand),
        refType: "OPENING_BALANCE",
        refId: "SEED-0001",
        note: "Saldo Awal Stok (Seeded)",
        userId: adminUser.id,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
    }

    // Seed Batches for electronics & chemicals
    if (prod.code === "PRD-CPU-7950X" || prod.code === "PRD-CHEM-CLEANER-5L") {
      const [existsBatch] = await db
        .select()
        .from(schema.batches)
        .where(eq(schema.batches.productId, prod.id))
        .limit(1);

      if (!existsBatch) {
        await db.insert(schema.batches).values({
          tenantId: tenant.id,
          companyId: mainCompany.id,
          warehouseId: mainWarehouse.id,
          productId: prod.id,
          batchNo: `BATCH-2026-${prod.code.slice(-4)}`,
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          qtyIn: String(onHand),
          qtyOut: "0",
          qtyRemaining: String(onHand),
          costPrice: String(cost),
          status: "OPEN",
        });
      }
    }
  }
  // Seed Office Warehouse Stocks
  const officeWh = seededWarehouses["WH-OFFICE-HQ"];
  if (officeWh && allSeededProducts.length > 0) {
    const officeProds = allSeededProducts.filter((p) =>
      ["PRD-OFF-PAPER-A4", "PRD-CHEM-CLEANER-5L", "PRD-MON-27"].includes(p.code)
    );
    for (const prod of officeProds) {
      const cost = Number(prod.costPrice || 0) || 100000;
      const onHand = prod.code === "PRD-OFF-PAPER-A4" ? 150 : prod.code === "PRD-CHEM-CLEANER-5L" ? 40 : 12;

      const [existingStock] = await db
        .select()
        .from(schema.warehouseStocks)
        .where(
          and(
            eq(schema.warehouseStocks.warehouseId, officeWh.id),
            eq(schema.warehouseStocks.productId, prod.id)
          )
        );

      if (!existingStock) {
        await db.insert(schema.warehouseStocks).values({
          tenantId: tenant.id,
          companyId: mainCompany.id,
          warehouseId: officeWh.id,
          productId: prod.id,
          qtyOnHand: String(onHand),
          qtyReserved: "0",
          qtyIncoming: "0",
          avgCost: String(cost),
          lastMovementAt: new Date(),
        });
      }
    }
  }

  console.log("✅ Seeded Warehouse & Office Stock Balances, Movements & Batches");

  // Seed Employees (Drivers & Logistics Staff)
  const empList = [
    { code: "EMP-001", name: "Budi Santoso", jobTitle: "Driver / Supir Utama", phone: "081234567890", email: "budi.driver@lefatech.co.id" },
    { code: "EMP-002", name: "Agus Setiawan", jobTitle: "Driver / Supir Pengantar", phone: "081298765432", email: "agus.driver@lefatech.co.id" },
    { code: "EMP-003", name: "Joko Widodo", jobTitle: "Staff Logistik & Delivery", phone: "081311223344", email: "joko.logistics@lefatech.co.id" },
    { code: "EMP-004", name: "Siti Rahmawati", jobTitle: "Admin Sales & Customer Relation", phone: "081355667788", email: "siti.sales@lefatech.co.id" },
  ];

  for (const emp of empList) {
    const [existing] = await db.select().from(schema.employees).where(eq(schema.employees.employeeCode, emp.code));
    if (!existing) {
      await db.insert(schema.employees).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        employeeCode: emp.code,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        jobTitle: emp.jobTitle,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded Master Employees");

  // Seed Vehicles (Master Armada)
  const vehList = [
    { code: "ARM-001", plate: "B 9123 SCN", type: "Truck Box Isuzu Elf", model: "Isuzu NMR 71", notes: "Kapasitas 5 Ton Box Alumunium" },
    { code: "ARM-002", plate: "L 8090 AB", type: "Pickup Cargo L300", model: "Mitsubishi L300", notes: "Cabang Surabaya Regional" },
    { code: "ARM-003", plate: "B 4567 CD", type: "Blind Van Express", model: "Daihatsu GranMax", notes: "Kirim Paket Dalam Kota Express" },
  ];

  for (const v of vehList) {
    const [existing] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.vehicleCode, v.code));
    if (!existing) {
      await db.insert(schema.vehicles).values({
        tenantId: tenant.id,
        companyId: mainCompany.id,
        vehicleCode: v.code,
        plateNumber: v.plate,
        vehicleType: v.type,
        brandModel: v.model,
        notes: v.notes,
        status: "ACTIVE",
      });
    }
  }
  console.log("✅ Seeded Master Armada / Vehicles");

  console.log(
    "🎉 SUCCESS: Official Flex ERP Comprehensive Master Data Seeding Completed!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Drizzle Seeding Error:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
