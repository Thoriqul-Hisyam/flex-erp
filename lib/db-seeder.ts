import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

export async function seedDatabaseIfEmpty() {
  try {
    const adminPasswordHash = bcrypt.hashSync("Password123!", 10);
    const financePasswordHash = bcrypt.hashSync("Password123!", 10);

    // 1. Seed or find Tenant
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

    // 2. Seed or find Company
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

    // 3. Seed Super Admin User
    const adminEmail = "admin@lefatech.co.id";
    let [adminUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail));

    if (!adminUser) {
      [adminUser] = await db
        .insert(schema.users)
        .values({
          tenantId: tenant.id,
          email: adminEmail,
          name: "Alexander Wright",
          passwordHash: adminPasswordHash,
          status: "ACTIVE",
        })
        .returning();
    }

    // 4. Seed Finance User
    const financeEmail = "finance@lefatech.co.id";
    let [financeUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, financeEmail));

    if (!financeUser) {
      [financeUser] = await db
        .insert(schema.users)
        .values({
          tenantId: tenant.id,
          email: financeEmail,
          name: "Elena Rostova",
          passwordHash: financePasswordHash,
          status: "ACTIVE",
        })
        .returning();
    }

    return { tenant, adminUser, financeUser };
  } catch (error) {
    console.error("Drizzle Seeding Error:", error);
    return null;
  }
}
