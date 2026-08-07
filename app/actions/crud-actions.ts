"use server";

import { db, schema } from "@/db";
import { logAuditEvent } from "@/lib/audit/logger";
import { and, eq } from "drizzle-orm";
import { getSessionUser, getUserContext } from "@/lib/auth/session";
import { denyIfUnauthorized } from "@/lib/auth/server-permissions";
import {
  getScopeContext,
  withScope,
  assertBranchBelongsToCompany,
  assertWarehouseBelongsToCompanyAndBranch,
  type ScopeContext,
} from "@/lib/auth/scope";
import bcrypt from "bcryptjs";

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  products_company_code_idx: "Kode produk ini sudah dipakai di perusahaan ini.",
  products_company_sku_idx: "SKU ini sudah dipakai di perusahaan ini.",
  customers_company_code_idx: "Kode customer ini sudah dipakai di perusahaan ini.",
  suppliers_company_code_idx: "Kode supplier ini sudah dipakai di perusahaan ini.",
  emp_company_code_idx: "Kode karyawan ini sudah dipakai di perusahaan ini.",
};

/**
 * Turns a Postgres unique-violation (23505) into a friendly Indonesian
 * message for known business-code constraints; falls back to the caller's
 * default message for anything else.
 */
function friendlyDbErrorMessage(dbErr: any, fallback: string): string {
  if (dbErr?.code === "23505") {
    const constraint = dbErr.constraint as string | undefined;
    if (constraint && UNIQUE_CONSTRAINT_MESSAGES[constraint]) {
      return UNIQUE_CONSTRAINT_MESSAGES[constraint];
    }
    return "Data duplikat: kode/SKU ini sudah dipakai di perusahaan ini.";
  }
  return dbErr?.message || fallback;
}

async function getCurrentScope(): Promise<ScopeContext | null> {
  const user = await getSessionUser();
  return user ? getScopeContext(user) : null;
}

function getStoreKey(entityName: string): string {
  const normalized = entityName.toLowerCase();
  if (
    normalized.includes("category") ||
    normalized.includes("productcategory") ||
    normalized.includes("kategori")
  )
    return "productcategory";
  if (normalized.includes("product") || normalized.includes("produk"))
    return "product";
  if (normalized.includes("company") || normalized.includes("perusahaan"))
    return "company";
  if (normalized.includes("branch") || normalized.includes("cabang"))
    return "branch";
  if (normalized.includes("warehouse") || normalized.includes("gudang"))
    return "warehouse";
  if (normalized.includes("customer") || normalized.includes("pelanggan"))
    return "customer";
  if (normalized.includes("supplier") || normalized.includes("pemasok"))
    return "supplier";
  if (normalized.includes("unit") || normalized.includes("satuan"))
    return "unit";
  if (normalized.includes("department") || normalized.includes("departemen") || normalized.includes("divisi"))
    return "department";
  if (normalized.includes("tax") || normalized.includes("pajak")) return "tax";
  if (
    normalized.includes("user") ||
    normalized.includes("pengguna") ||
    normalized.includes("akun")
  )
    return "user";
  if (
    normalized.includes("role") ||
    normalized.includes("peran") ||
    normalized.includes("akses")
  )
    return "role";
  if (normalized.includes("audit")) return "auditlog";
  return normalized;
}

// Helper to map entity name string to Drizzle table
function getTableForEntity(entityName: string) {
  const normalized = entityName.toLowerCase();
  if (
    normalized.includes("category") ||
    normalized.includes("productcategory") ||
    normalized.includes("kategori")
  )
    return schema.productCategories;
  if (normalized.includes("product") || normalized.includes("produk"))
    return schema.products;
  if (normalized.includes("company") || normalized.includes("perusahaan"))
    return schema.companies;
  if (normalized.includes("branch") || normalized.includes("cabang"))
    return schema.branches;
  if (normalized.includes("warehouse") || normalized.includes("gudang"))
    return schema.warehouses;
  if (normalized.includes("customer") || normalized.includes("pelanggan"))
    return schema.customers;
  if (normalized.includes("supplier") || normalized.includes("pemasok"))
    return schema.suppliers;
  if (normalized.includes("unit") || normalized.includes("satuan"))
    return schema.units;
  if (
    normalized.includes("department") ||
    normalized.includes("departemen") ||
    normalized.includes("divisi")
  )
    return schema.departments;
  if (normalized.includes("tax") || normalized.includes("pajak"))
    return schema.taxes;
  if (
    normalized.includes("user") ||
    normalized.includes("pengguna") ||
    normalized.includes("akun")
  )
    return schema.users;
  if (
    normalized.includes("role") ||
    normalized.includes("peran") ||
    normalized.includes("akses")
  )
    return schema.roles;
  if (normalized.includes("audit")) return schema.auditLogs;
  return null;
}

// Helper to resolve valid Tenant UUID for PostgreSQL foreign key constraints
async function getDefaultTenantId(): Promise<string> {
  try {
    const existing = await db.select().from(schema.tenants).limit(1);
    if (existing && existing.length > 0) {
      return existing[0].id;
    }
    const [newTenant] = await db
      .insert(schema.tenants)
      .values({
        name: "Default Enterprise Tenant",
        code: "DEFAULT-TENANT",
        plan: "ENTERPRISE",
        status: "ACTIVE",
      })
      .returning();
    return newTenant.id;
  } catch (err) {
    return "00000000-0000-0000-0000-000000000000";
  }
}

// Helper to resolve valid Company UUID for PostgreSQL tables requiring companyId .notNull()
async function getDefaultCompanyId(tenantId: string): Promise<string> {
  try {
    const comps = await db.select().from(schema.companies).limit(1);
    if (comps && comps[0]) return comps[0].id;
    const [newComp] = await db
      .insert(schema.companies)
      .values({
        tenantId,
        code: "DEFAULT-CO",
        name: "Default Company",
        currency: "IDR",
      })
      .returning();
    return newComp.id;
  } catch (err) {
    return "00000000-0000-0000-0000-000000000000";
  }
}

/**
 * Filter out virtual/UI-only keys (e.g. companyName, branchName) so PostgreSQL queries don't fail,
 * and map form fields like city to SQL columns like address.
 */
function sanitizePayloadForTable(
  entityName: string,
  payload: Record<string, any>,
): Record<string, any> {
  const storeKey = getStoreKey(entityName);
  const clean: Record<string, any> = { ...payload };

  // Map virtual form fields to actual DB columns
  if (storeKey === "branch") {
    if (clean.city && !clean.address) {
      clean.address = clean.city;
    }
    if (clean.isHeadquarters !== undefined) {
      clean.isHeadquarters =
        clean.isHeadquarters === true || clean.isHeadquarters === "true";
    }
  }
  if (storeKey === "warehouse" && clean.address && !clean.location) {
    clean.location = clean.address;
  }

  const allowedKeys: Record<string, string[]> = {
    company: [
      "tenantId",
      "code",
      "name",
      "taxId",
      "email",
      "phone",
      "currency",
      "address",
      "logoUrl",
      "isDefault",
      "highValuePoThreshold",
    ],
    branch: [
      "tenantId",
      "companyId",
      "code",
      "name",
      "phone",
      "address",
      "isHeadquarters",
    ],
    warehouse: [
      "tenantId",
      "companyId",
      "branchId",
      "code",
      "name",
      "location",
      "isDefault",
    ],
    productcategory: ["tenantId", "code", "name", "description", "status"],
    product: [
      "tenantId",
      "companyId",
      "code",
      "sku",
      "name",
      "category",
      "categoryId",
      "type",
      "unit",
      "unitId",
      "costPrice",
      "sellingPrice",
      "stockOnHand",
      "reorderLevel",
      "status",
    ],
    customer: [
      "tenantId",
      "companyId",
      "code",
      "name",
      "email",
      "phone",
      "creditLimit",
      "balanceOutstanding",
      "paymentTerms",
      "taxId",
      "address",
      "city",
      "country",
      "status",
    ],
    supplier: [
      "tenantId",
      "companyId",
      "code",
      "name",
      "email",
      "phone",
      "paymentTerms",
      "rating",
      "address",
      "city",
      "taxId",
      "status",
    ],
    user: [
      "tenantId",
      "companyId",
      "branchId",
      "warehouseId",
      "roleId",
      "role",
      "code",
      "name",
      "email",
      "passwordHash",
      "avatarUrl",
      "status",
    ],
    role: ["tenantId", "code", "name", "description", "isSystem", "status"],
  };

  const validKeys = allowedKeys[storeKey];
  if (!validKeys) return payload;

  const result: Record<string, any> = {};
  for (const key of validKeys) {
    if (clean[key] !== undefined) {
      result[key] = clean[key];
    }
  }

  return result;
}

/**
 * Server Action to fetch records dynamically from Drizzle ORM PostgreSQL or Server Store.
 */
export async function fetchRecordsAction(
  entityName: string,
): Promise<ActionResult> {
  const storeKey = getStoreKey(entityName);
  try {
    const denied = await denyIfUnauthorized(entityName, "read");
    if (denied) return denied;

    const table = getTableForEntity(entityName);
    if (table) {
      const scope = await getCurrentScope();
      const whereClause = await withScope(table, scope);
      const records = whereClause
        ? await db.select().from(table as any).where(whereClause)
        : await db.select().from(table as any);

      // Enrich relational data for Branch (companyId, companyName, city, warehousesCount)
      if (storeKey === "branch") {
        const compList = await db.select().from(schema.companies);
        const warehouseList = await db.select().from(schema.warehouses);
        const compMap = new Map(compList.map((c) => [c.id, c.name]));
        const warehouseCountMap = new Map<string, number>();
        warehouseList.forEach((w: any) => {
          if (w.branchId) {
            warehouseCountMap.set(
              w.branchId,
              (warehouseCountMap.get(w.branchId) || 0) + 1,
            );
          }
        });

        const enriched = records.map((r: any) => ({
          status: "ACTIVE",
          ...r,
          companyId: r.companyId,
          companyName:
            r.companyName ||
            compMap.get(r.companyId) ||
            "-",
          city: r.city || r.address || "",
          warehousesCount: warehouseCountMap.get(r.id) || 0,
        }));
        return { success: true, data: enriched };
      }

      // Enrich relational data for Warehouse (companyId, branchId, companyName, branchName, location, capacityUtilization)
      if (storeKey === "warehouse") {
        const compList = await db.select().from(schema.companies);
        const branchList = await db.select().from(schema.branches);
        const compMap = new Map(compList.map((c) => [c.id, c.name]));
        const branchMap = new Map(branchList.map((b) => [b.id, b.name]));

        const enriched = records.map((r: any) => ({
          status: "ACTIVE",
          ...r,
          capacityUtilization:
            r.capacityUtilization !== undefined
              ? Number(r.capacityUtilization)
              : 0,
          companyId: r.companyId,
          branchId: r.branchId,
          companyName:
            r.companyName ||
            compMap.get(r.companyId) ||
            (compList[0]?.name ?? "-"),
          branchName: r.branchId
            ? r.branchName || branchMap.get(r.branchId) || "-"
            : "Semua Cabang (Gudang Pusat)",
          location: r.location || r.address || "",
        }));
        return { success: true, data: enriched };
      }

      // Enrich relational data for Product (categoryId, warehouseId, defaultWarehouse, resolved category, numbers)
      if (storeKey === "product") {
        const whList = await db.select().from(schema.warehouses);
        const catList = await db.select().from(schema.productCategories);
        const catMap = new Map<string, string>();
        catList.forEach((c: any) => {
          if (c.id) catMap.set(c.id, c.name || c.code);
          if (c.code) catMap.set(c.code, c.name || c.code);
          if (c.name) catMap.set(c.name, c.name || c.code);
        });
        const whMap = new Map<string, string>();
        whList.forEach((w: any) => {
          if (w.id) whMap.set(w.id, w.name || w.code);
          if (w.name) whMap.set(w.name, w.name || w.code);
        });

        const defaultWhName = whList && whList[0] ? whList[0].name : "-";
        const defaultCatName =
          catList && catList[0] ? catList[0].name || catList[0].code : "-";

        const enriched = records.map((r: any) => {
          const rawCat = r.categoryId || r.category;
          const rawWh = r.warehouseId || r.defaultWarehouse;
          const resolvedCat = catMap.get(rawCat) || rawCat || defaultCatName;
          const resolvedWh = whMap.get(rawWh) || rawWh || defaultWhName;
          return {
            status: r.status || "ACTIVE",
            stockOnHand: Number(r.stockOnHand) || 0,
            costPrice: Number(r.costPrice) || 0,
            sellingPrice: Number(r.sellingPrice) || 0,
            reorderLevel: Number(r.reorderLevel) || 0,
            ...r,
            categoryId: rawCat || catList[0]?.id,
            category: resolvedCat,
            warehouseId: rawWh || whList[0]?.id,
            defaultWarehouse: resolvedWh,
          };
        });
        return { success: true, data: enriched };
      }

      // Enrich relational data for User (companyId, branchId, roleId, companyName, branchName, role)
      if (storeKey === "user") {
        const compList = await db.select().from(schema.companies);
        const branchList = await db.select().from(schema.branches);
        const warehouseList = await db.select().from(schema.warehouses);
        const roleList = await db.select().from(schema.roles);
        const compMap = new Map(compList.map((c) => [c.id, c.name]));
        const branchMap = new Map(branchList.map((b) => [b.id, b.name]));
        const warehouseMap = new Map(warehouseList.map((w) => [w.id, w.name]));
        const roleMap = new Map<string, string>();
        roleList.forEach((r: any) => {
          if (r.id) roleMap.set(r.id, r.name);
          if (r.code) roleMap.set(r.code, r.name);
          if (r.name) roleMap.set(r.name, r.name);
        });

        const enriched = records.map((r: any) => {
          const rawRole = r.roleId || r.role || "Super Administrator";
          const resolvedRole =
            roleMap.get(rawRole) || rawRole || "Super Administrator";
          // Never send the password hash to the client, even though it's
          // hashed - it has no legitimate use in the browser.
          const { passwordHash, ...rest } = r;
          return {
            status: r.status || "ACTIVE",
            ...rest,
            code: r.code || r.id?.slice(0, 8) || "USR-001",
            roleId: rawRole,
            role: resolvedRole,
            companyId: r.companyId,
            branchId: r.branchId,
            warehouseId: r.warehouseId,
            companyName: r.companyId ? compMap.get(r.companyId) || "-" : "Semua Perusahaan",
            branchName: r.branchId ? branchMap.get(r.branchId) || "-" : "Semua Cabang",
            warehouseName: r.warehouseId ? warehouseMap.get(r.warehouseId) || "-" : "Semua Gudang",
          };
        });
        return { success: true, data: enriched };
      }

      // Ensure status and branchesCount are present for company
      if (storeKey === "company") {
        const branchList = await db.select().from(schema.branches);
        const branchCountMap = new Map<string, number>();
        branchList.forEach((b: any) => {
          if (b.companyId) {
            branchCountMap.set(
              b.companyId,
              (branchCountMap.get(b.companyId) || 0) + 1,
            );
          }
        });

        const enriched = records.map((r: any) => ({
          status: "ACTIVE",
          ...r,
          branchesCount: branchCountMap.get(r.id) || 0,
        }));
        return { success: true, data: enriched };
      }

      // Enrich relational data for Role (permissionsCount)
      if (storeKey === "role") {
        const permList = await db.select().from(schema.permissions);
        const permCountMap = new Map<string, number>();
        permList.forEach((p: any) => {
          const acts = Array.isArray(p.actions) ? p.actions.length : 0;
          permCountMap.set(p.roleId, (permCountMap.get(p.roleId) || 0) + acts);
        });

        const enriched = records.map((r: any) => {
          const pCount =
            permCountMap.get(r.id) !== undefined && permCountMap.get(r.id)! > 0
              ? permCountMap.get(r.id)!
              : r.permissionsCount || 18;
          return {
            status: "ACTIVE",
            ...r,
            permissionsCount: pCount,
            permissions: r.permissions,
          };
        });
        return { success: true, data: enriched };
      }

      // Enrich Audit Log rows: resolve the actor's name and build a
      // human-readable summary instead of raw userId/payload JSON.
      if (storeKey === "auditlog") {
        const userList = await db.select().from(schema.users);
        const userMap = new Map(userList.map((u) => [u.id, u.name || u.email]));

        const enriched = (records as any[])
          .slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((r: any) => {
            const changedFields =
              r.newPayload && typeof r.newPayload === "object"
                ? Object.keys(r.newPayload).slice(0, 5).join(", ")
                : "";
            return {
              id: r.id,
              timestamp: r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-",
              createdAt: r.createdAt,
              user: userMap.get(r.userId) || (r.userId ? "Pengguna Terhapus" : "System"),
              userId: r.userId,
              action: r.action,
              entity: r.entity,
              entityId: r.entityId,
              details: changedFields
                ? `${r.entity} #${String(r.entityId).slice(0, 8)} - field diubah: ${changedFields}`
                : `${r.entity} #${String(r.entityId).slice(0, 8)}`,
              ipAddress: r.ipAddress || "-",
            };
          });
        return { success: true, data: enriched };
      }

      return { success: true, data: records };
    }
  } catch (err: any) {
    console.error(
      `[Drizzle ORM Fetch ${entityName} Error]:`,
      err?.message || err,
    );
    return { success: false, error: err?.message || "Failed to fetch records" };
  }

  return { success: true, data: [] };
}

/**
 * Server Action for creating a new CRUD record.
 */
export async function createRecordAction(
  entityName: string,
  formData: Record<string, any>,
): Promise<ActionResult> {
  const denied = await denyIfUnauthorized(entityName, "create");
  if (denied) return denied;

  const storeKey = getStoreKey(entityName);
  const newItemId = `${storeKey}-${Date.now()}`;
  const newItem: Record<string, any> = {
    id: newItemId,
    code:
      formData.code ||
      `${entityName.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: formData.status || "ACTIVE",
    ...formData,
    createdAt: new Date().toISOString(),
  };

  // Attempt Drizzle ORM insert with valid UUID & sanitized columns
  try {
    const table = getTableForEntity(entityName);
    if (table) {
      const scope = await getCurrentScope();
      const tenantId = scope?.tenantId ?? (await getDefaultTenantId());
      const insertPayload: Record<string, any> = {
        code: newItem.code,
        name: formData.name || newItem.code,
        ...formData,
      };
      insertPayload.tenantId = tenantId;

      // Map pure ID fields to SQL columns. For a User record, the admin is
      // explicitly choosing ANOTHER person's scope via the form - never
      // auto-stamp the acting admin's own company/branch/warehouse here,
      // since a field left empty intentionally means "wider scope for this
      // user," not "same as mine."
      if (storeKey === "user") {
        insertPayload.companyId = formData.companyId || null;
        insertPayload.branchId = formData.branchId || null;
        insertPayload.warehouseId = formData.warehouseId || null;
      } else {
        if (scope?.companyId) {
          insertPayload.companyId = scope.companyId;
        }
        if (formData.companyId) insertPayload.companyId = formData.companyId;
        if (scope?.branchId) {
          insertPayload.branchId = scope.branchId;
        }
        if (formData.branchId) insertPayload.branchId = formData.branchId;
      }
      if (formData.categoryId) insertPayload.category = formData.categoryId;
      if (formData.roleId) insertPayload.roleId = formData.roleId;

      // Automatically resolve companyId if not provided
      const requiresCompanyId = [
        "branch",
        "warehouse",
        "product",
        "customer",
        "supplier",
      ].includes(storeKey);
      if (requiresCompanyId && !insertPayload.companyId) {
        if (formData.companyName) {
          const matchingComp = await db
            .select()
            .from(schema.companies)
            .where(eq(schema.companies.name, formData.companyName))
            .limit(1);
          if (matchingComp && matchingComp[0]) {
            insertPayload.companyId = matchingComp[0].id;
          }
        }
        if (!insertPayload.companyId) {
          insertPayload.companyId = await getDefaultCompanyId(tenantId);
        }
      }

      // Resolve branchId by name if given - a warehouse legitimately has no
      // branch at all (company-wide warehouse), so unlike company there is
      // no forced fallback to "some default branch" here.
      if (
        storeKey === "warehouse" &&
        !insertPayload.branchId &&
        formData.branchName
      ) {
        const matchingBr = await db
          .select()
          .from(schema.branches)
          .where(eq(schema.branches.name, formData.branchName))
          .limit(1);
        if (matchingBr && matchingBr[0]) {
          insertPayload.branchId = matchingBr[0].id;
        }
      }

      // Hash the password for a new user - never store it in plaintext,
      // and never fall back to a fake/default hash that would leave the
      // account permanently unable to log in.
      if (storeKey === "user") {
        if (!formData.password || String(formData.password).length < 6) {
          return {
            success: false,
            error: "Password wajib diisi (minimal 6 karakter) saat membuat akun baru.",
          };
        }
        insertPayload.passwordHash = await bcrypt.hash(String(formData.password), 10);
        delete insertPayload.password;
      }

      // Automatically fill code and sku for product
      if (storeKey === "product") {
        insertPayload.code =
          insertPayload.code || insertPayload.sku || `PRD-${Date.now()}`;
        insertPayload.sku = insertPayload.sku || insertPayload.code;

        // Resolve the real category/unit FK instead of stuffing the raw id
        // into the free-text display column.
        if (formData.categoryId) {
          const [cat] = await db
            .select()
            .from(schema.productCategories)
            .where(eq(schema.productCategories.id, formData.categoryId));
          if (cat) {
            insertPayload.categoryId = cat.id;
            insertPayload.category = cat.name || cat.code;
          }
        }
        if (formData.unit) {
          const [unitRow] = await db
            .select()
            .from(schema.units)
            .where(eq(schema.units.code, formData.unit));
          if (unitRow) {
            insertPayload.unitId = unitRow.id;
            insertPayload.unit = unitRow.code;
          }
        }
      }

      // Relational-integrity guard: a branch/warehouse assigned to a User or
      // Warehouse row must actually belong to the company (and branch) also
      // being assigned - thrown Errors are caught below and surfaced as-is.
      if (storeKey === "user") {
        if (insertPayload.branchId) {
          await assertBranchBelongsToCompany(insertPayload.branchId, insertPayload.companyId);
        }
        if (insertPayload.warehouseId) {
          await assertWarehouseBelongsToCompanyAndBranch(
            insertPayload.warehouseId,
            insertPayload.companyId,
            insertPayload.branchId,
          );
        }
      }
      if (storeKey === "warehouse" && insertPayload.branchId) {
        await assertBranchBelongsToCompany(insertPayload.branchId, insertPayload.companyId);
      }

      const sanitizedPayload = sanitizePayloadForTable(
        entityName,
        insertPayload,
      );
      const insertedRecords = (await db
        .insert(table as any)
        .values(sanitizedPayload)
        .returning()) as any[];
      if (Array.isArray(insertedRecords) && insertedRecords.length > 0) {
        newItem.id = insertedRecords[0].id;
      }
    }
  } catch (dbErr: any) {
    console.error(
      `[Drizzle ORM Insert ${entityName} Error]:`,
      dbErr?.message || dbErr,
    );
    const friendlyMessage = friendlyDbErrorMessage(dbErr, `Gagal membuat ${entityName}.`);
    return {
      success: false,
      error: dbErr?.message || "Failed to create record",
      message: friendlyMessage,
    };
  }

  const actor = await getSessionUser();
  const auditTenantId = actor?.tenantId;
  const auditUserId = actor?.id;

  // Server-side audit trail log - skip rather than misattribute to a fake
  // tenant if the session somehow evaporated mid-request.
  if (auditTenantId) {
  await logAuditEvent({
    tenantId: auditTenantId,
    userId: auditUserId,
    action: "CREATE",
    entity: entityName,
    entityId: String(newItem.id),
    newPayload: newItem,
  });
  }

  return {
    success: true,
    data: newItem,
    message: `${entityName} created successfully via Server Action.`,
  };
}

/**
 * Server Action for updating an existing CRUD record.
 */
export async function updateRecordAction(
  entityName: string,
  id: string,
  formData: Record<string, any>,
): Promise<ActionResult> {
  const denied = await denyIfUnauthorized(entityName, "update");
  if (denied) return denied;

  const updatePayload: Record<string, any> = { ...formData };
  const storeKey = getStoreKey(entityName);

  // Map pure ID fields to SQL columns. For User/Warehouse, an empty field is
  // an explicit choice to widen scope (see createRecordAction) - persist
  // that as NULL instead of silently keeping whatever the row had before.
  if (storeKey === "user") {
    updatePayload.companyId = formData.companyId || null;
    updatePayload.branchId = formData.branchId || null;
    updatePayload.warehouseId = formData.warehouseId || null;
  } else if (storeKey === "warehouse") {
    if (formData.companyId) updatePayload.companyId = formData.companyId;
    updatePayload.branchId = formData.branchId || null;
  } else {
    if (formData.companyId) updatePayload.companyId = formData.companyId;
    if (formData.branchId) updatePayload.branchId = formData.branchId;
  }
  if (formData.roleId) updatePayload.roleId = formData.roleId;

  // Resolve the real category/unit FK instead of stuffing the raw id into
  // the free-text display column.
  if (storeKey === "product") {
    if (formData.categoryId) {
      const [cat] = await db
        .select()
        .from(schema.productCategories)
        .where(eq(schema.productCategories.id, formData.categoryId));
      if (cat) {
        updatePayload.categoryId = cat.id;
        updatePayload.category = cat.name || cat.code;
      }
    }
    if (formData.unit) {
      const [unitRow] = await db
        .select()
        .from(schema.units)
        .where(eq(schema.units.code, formData.unit));
      if (unitRow) {
        updatePayload.unitId = unitRow.id;
        updatePayload.unit = unitRow.code;
      }
    }
  }

  // Admin password reset: only hash + set passwordHash when a new password
  // was actually typed - an empty field means "keep the current password."
  if (storeKey === "user") {
    if (formData.password && String(formData.password).trim().length > 0) {
      if (String(formData.password).length < 6) {
        return {
          success: false,
          error: "Password baru minimal 6 karakter.",
        };
      }
      updatePayload.passwordHash = await bcrypt.hash(String(formData.password), 10);
    }
    delete updatePayload.password;
  }

  // Attempt Drizzle ORM update
  try {
    const table = getTableForEntity(entityName);
    if (table) {
      const scope = await getCurrentScope();
      // Automatically resolve companyId/branchId from a companyName/branchName
      // string - only for entities that don't already resolve their own id
      // above (CSV import rows carry name strings, not ids). User and
      // Warehouse rows already have authoritative id resolution at lines
      // 793-799, including "" -> null for an intentional clear; running this
      // fallback for them too would see the STALE companyName/branchName the
      // edit form still carries from the original record (only the select's
      // id field gets updated on change) and silently re-resolve the id right
      // back to the old value, undoing the clear.
      if (storeKey !== "user" && storeKey !== "warehouse") {
        if (formData.companyName && !updatePayload.companyId) {
          const matchingComp = await db
            .select()
            .from(schema.companies)
            .where(eq(schema.companies.name, formData.companyName))
            .limit(1);
          if (matchingComp && matchingComp[0]) {
            updatePayload.companyId = matchingComp[0].id;
          }
        }

        if (formData.branchName && !updatePayload.branchId) {
          const matchingBr = await db
            .select()
            .from(schema.branches)
            .where(eq(schema.branches.name, formData.branchName))
            .limit(1);
          if (matchingBr && matchingBr[0]) {
            updatePayload.branchId = matchingBr[0].id;
          }
        }
      }

      // Relational-integrity guard: a branch/warehouse assigned to a User or
      // Warehouse row must actually belong to the company (and branch) also
      // being assigned - thrown Errors are caught below and surfaced as-is.
      if (storeKey === "user") {
        if (updatePayload.branchId) {
          await assertBranchBelongsToCompany(updatePayload.branchId, updatePayload.companyId);
        }
        if (updatePayload.warehouseId) {
          await assertWarehouseBelongsToCompanyAndBranch(
            updatePayload.warehouseId,
            updatePayload.companyId,
            updatePayload.branchId,
          );
        }
      }
      if (storeKey === "warehouse" && updatePayload.branchId) {
        await assertBranchBelongsToCompany(updatePayload.branchId, updatePayload.companyId);
      }

      const sanitizedPayload = sanitizePayloadForTable(
        entityName,
        updatePayload,
      );
      if (Object.keys(sanitizedPayload).length > 0) {
        const whereClause = await withScope(table, scope, [eq((table as any).id, id)]);
        await db
          .update(table as any)
          .set({
            ...sanitizedPayload,
            updatedAt: new Date(),
          })
          .where(whereClause ?? eq((table as any).id, id));
      }
    }
  } catch (dbErr: any) {
    console.error(
      `[Drizzle ORM Update ${entityName} Error]:`,
      dbErr?.message || dbErr,
    );
    const friendlyMessage = friendlyDbErrorMessage(dbErr, `Gagal memperbarui ${entityName}.`);
    return {
      success: false,
      error: dbErr?.message || "Failed to update record",
      message: friendlyMessage,
    };
  }

  if (formData.isHeadquarters !== undefined) {
    const isHqBool =
      formData.isHeadquarters === true || formData.isHeadquarters === "true";
    formData.isHeadquarters = isHqBool;
    updatePayload.isHeadquarters = isHqBool;
  }

  const finalPayload = {
    id,
    ...formData,
    ...updatePayload,
    isHeadquarters:
      formData.isHeadquarters !== undefined
        ? formData.isHeadquarters === true || formData.isHeadquarters === "true"
        : updatePayload.isHeadquarters,
    updatedAt: new Date().toISOString(),
  };

  const actor = await getSessionUser();
  const auditTenantId = actor?.tenantId;
  const auditUserId = actor?.id;

  // Server-side audit trail log - skip rather than misattribute to a fake
  // tenant if the session somehow evaporated mid-request.
  if (auditTenantId) {
  await logAuditEvent({
    tenantId: auditTenantId,
    userId: auditUserId,
    action: "UPDATE",
    entity: entityName,
    entityId: id,
    newPayload: finalPayload,
  });
  }

  return {
    success: true,
    data: finalPayload,
    message: `${entityName} updated successfully via Server Action.`,
  };
}

/**
 * Server Action for deleting a CRUD record.
 */
export async function deleteRecordAction(
  entityName: string,
  id: string,
): Promise<ActionResult> {
  const denied = await denyIfUnauthorized(entityName, "delete");
  if (denied) return denied;

  // Attempt Drizzle ORM delete
  try {
    const table = getTableForEntity(entityName);
    if (table) {
      const scope = await getCurrentScope();
      const whereClause = await withScope(table, scope, [eq((table as any).id, id)]);
      await db.delete(table as any).where(whereClause ?? eq((table as any).id, id));
    }
  } catch (dbErr: any) {
    console.error(
      `[Drizzle ORM Delete ${entityName} Error]:`,
      dbErr?.message || dbErr,
    );
    return {
      success: false,
      error: dbErr?.message || "Failed to delete record",
      message: `Gagal menghapus ${entityName}.`,
    };
  }

  const actor = await getSessionUser();
  const auditTenantId = actor?.tenantId;
  const auditUserId = actor?.id;

  // Server-side audit trail log - skip rather than misattribute to a fake
  // tenant if the session somehow evaporated mid-request.
  if (auditTenantId) {
  await logAuditEvent({
    tenantId: auditTenantId,
    userId: auditUserId,
    action: "DELETE",
    entity: entityName,
    entityId: id,
  });
  }

  return {
    success: true,
    data: { id },
    message: `${entityName} deleted successfully via Server Action.`,
  };
}

/**
 * Server Action for saving fine-grained Role Permissions Matrix to PostgreSQL and dynamic memory store.
 */
export async function updateRolePermissionsAction(
  roleId: string,
  permissions: Record<string, string[]>,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sys_roles", "update");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, error: "Unauthorized." };
    }
    const tenantId = user.tenantId;

    const [role] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(and(eq(schema.roles.id, roleId), eq(schema.roles.tenantId, tenantId)));
    if (!role) {
      return { success: false, error: "Role tidak ditemukan." };
    }

    let totalCount = 0;
    Object.values(permissions).forEach((actions) => {
      totalCount += actions.length;
    });

    // 1. Drizzle ORM PostgreSQL update/insert for permissions table - errors here
    // must propagate to the outer catch, not be swallowed, otherwise the caller
    // is told the save succeeded when it didn't.
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.permissions)
        .where(eq(schema.permissions.roleId, roleId));
      const insertValues = Object.entries(permissions)
        .filter(([_, actions]) => actions && actions.length > 0)
        .map(([moduleName, actions]) => ({
          tenantId,
          roleId,
          module: moduleName,
          actions,
        }));

      if (insertValues.length > 0) {
        await tx.insert(schema.permissions).values(insertValues);
      }

      await tx
        .update(schema.roles)
        .set({ updatedAt: new Date() })
        .where(eq(schema.roles.id, roleId));
    });

    // 2. Server-side audit log
    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "UPDATE",
      entity: "Role Permissions Matrix",
      entityId: roleId,
      newPayload: { permissions, permissionsCount: totalCount },
    });

    return {
      success: true,
      data: { roleId, permissions, permissionsCount: totalCount },
      message: `Permissions matrix updated successfully.`,
    };
  } catch (err: any) {
    console.error("[updateRolePermissionsAction Error]:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Server Action for fetching fine-grained Role Permissions Matrix from PostgreSQL or memory store.
 */
export async function fetchRolePermissionsAction(
  roleId: string,
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("sys_roles", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, error: "Unauthorized." };
    }

    const [role] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(and(eq(schema.roles.id, roleId), eq(schema.roles.tenantId, user.tenantId)));
    if (!role) {
      return { success: false, error: "Role tidak ditemukan." };
    }

    const table = schema.permissions;
    if (table) {
      const perms = await db
        .select()
        .from(table)
        .where(eq(schema.permissions.roleId, roleId));
      if (perms && perms.length > 0) {
        const permMap: Record<string, string[]> = {};
        perms.forEach((p: any) => {
          if (p.module) {
            permMap[p.module] = Array.isArray(p.actions) ? p.actions : [];
          }
        });
        return { success: true, data: permMap };
      }
    }
  } catch (err: any) {
    console.error("[fetchRolePermissionsAction] Error:", err?.message || err);
    return {
      success: false,
      error: err?.message || "Failed to fetch permissions",
    };
  }

  return { success: true, data: null };
}

/**
 * Server Action: Single consolidated call that returns the logged-in user's
 * context + full permissions map. With React `cache()` on the underlying
 * session/context helpers, this is memory-cheap and runs in a single request.
 * ModuleProvider calls this ONCE per app mount; every other component reads
 * the shared result from context instead of issuing its own request.
 */
export async function getUserSessionDataAction(): Promise<ActionResult> {
  try {
    const user = await getSessionUser();

    if (!user) {
      return { success: false, error: "No valid session cookie" };
    }

    const ctx = await getUserContext(user);
    const isSuperAdmin = ctx.isSuperAdmin;

    const contextData = {
      isSuperAdmin,
      roleCode: ctx.roleCode,
      roleName: ctx.roleName,
      userId: ctx.userId,
      userName: ctx.userName,
      companyName: ctx.companyName,
      companyLogoUrl: ctx.companyLogoUrl,
      branchId: ctx.branchId,
      branchName: ctx.branchName,
      warehouseId: ctx.warehouseId,
      warehouseName: ctx.warehouseName,
      tenantCode: ctx.tenantCode,
      tenantName: ctx.tenantName,
    };

    // Super Admin: full access to all modules
    if (isSuperAdmin) {
      const fullPermsMap: Record<string, string[]> = {};
      [
        "md_products",
        "md_categories",
        "md_units",
        "md_taxes",
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
        "sys_users",
        "sys_roles",
        "sys_audit",
      ].forEach((m) => {
        fullPermsMap[m] = [
          "read",
          "create",
          "update",
          "delete",
          "approve",
          "export",
        ];
      });

      return {
        success: true,
        data: { ...contextData, permissionsMap: fullPermsMap },
      };
    }

    if (!user.roleId) {
      return { success: true, data: { ...contextData, permissionsMap: {} } };
    }

    const perms = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.roleId, user.roleId));

    const permissionsMap: Record<string, string[]> = {};
    perms.forEach((p: any) => {
      if (p.module) {
        permissionsMap[p.module] = Array.isArray(p.actions) ? p.actions : [];
      }
    });

    return { success: true, data: { ...contextData, permissionsMap } };
  } catch (err: any) {
    console.error("[getUserSessionDataAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Failed" };
  }
}

/**
 * Server Action: Get the logged in user's saved theme preference from DB
 */
export async function getUserThemeAction(): Promise<ActionResult> {
  try {
    const user = await getSessionUser();

    if (!user) {
      return { success: true, data: { theme: "light" } };
    }

    const [userRecord] = await db
      .select({
        themePreference: schema.users.themePreference,
        id: schema.users.id,
      })
      .from(schema.users)
      .where(eq(schema.users.id, user.id));

    return {
      success: true,
      data: {
        userId: userRecord?.id,
        theme: userRecord?.themePreference || "light",
      },
    };
  } catch (err: any) {
    return { success: true, data: { theme: "light" } };
  }
}

/**
 * Server Action: Update and save the logged in user's theme preference in DB
 */
export async function updateUserThemeAction(
  theme: "light" | "dark",
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();

    if (!user) {
      return { success: false, error: "No session found" };
    }

    await db
      .update(schema.users)
      .set({
        themePreference: theme,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    return {
      success: true,
      data: { theme },
    };
  } catch (err: any) {
    console.error("[updateUserThemeAction] Error:", err?.message || err);
    return { success: false, error: err?.message || "Failed to update theme" };
  }
}
