import { db, schema } from "@/db";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { SessionUser } from "./session";

// "Sees all branches in a company" is granted purely by an empty branchId
// here - it is intentionally independent of branches.isHeadquarters, which
// is just a physical/organizational label, not a scope level.
export interface ScopeContext {
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  warehouseId: string | null;
}

export function getScopeContext(user: SessionUser): ScopeContext {
  return {
    tenantId: user.tenantId,
    companyId: user.companyId,
    branchId: user.branchId,
    warehouseId: user.warehouseId,
  };
}

/**
 * Ids of warehouses reachable under a branch-level scope: the branch's own
 * warehouses plus company-wide warehouses (branchId null) - used to widen a
 * warehouseId filter on tables that have no branchId column of their own.
 */
export async function resolveScopedWarehouseIds(
  ctx: ScopeContext | null,
): Promise<string[] | undefined> {
  if (!ctx) return undefined;
  if (ctx.warehouseId) return [ctx.warehouseId];
  if (!ctx.branchId) return undefined;

  const conditions = [
    or(eq(schema.warehouses.branchId, ctx.branchId), isNull(schema.warehouses.branchId)) as SQL,
  ];
  if (ctx.companyId) conditions.push(eq(schema.warehouses.companyId, ctx.companyId));

  const rows = await db
    .select({ id: schema.warehouses.id })
    .from(schema.warehouses)
    .where(and(...conditions));

  return rows.map((r) => r.id);
}

/**
 * Builds the company -> branch -> warehouse visibility filter for a list
 * query against `table`, given the acting user's scope. Each tier only
 * applies when the user has that field set AND the table has the matching
 * column - an empty field widens what the user sees (empty company = all
 * companies, empty branch = all branches in their company, empty warehouse
 * = all warehouses in their branch).
 *
 * purchaseOrders/salesOrders carry BOTH branchId and warehouseId, used for
 * mutually-exclusive document types (branchId for INTERNAL_USE docs,
 * warehouseId for FOR_RESALE docs) - a branch-scoped user needs both kinds
 * visible, so the branch tier becomes an OR across the two columns instead
 * of a plain AND.
 */
export async function withScope(
  table: unknown,
  ctx: ScopeContext | null,
  extra?: Array<SQL | undefined>,
): Promise<SQL | undefined> {
  const tableAny = table as any;
  const conditions: SQL[] = [];

  if (ctx?.tenantId && tableAny.tenantId) {
    conditions.push(eq(tableAny.tenantId, ctx.tenantId));
  }
  if (ctx?.companyId && tableAny.companyId) {
    conditions.push(eq(tableAny.companyId, ctx.companyId));
  }

  // The warehouses table has no warehouseId column of its own - a
  // warehouse-scoped user's visibility here resolves against its primary
  // key instead, otherwise they'd fall through to seeing every warehouse
  // in their branch instead of just the one they're assigned to.
  if (table === schema.warehouses) {
    if (ctx?.warehouseId) {
      conditions.push(eq(tableAny.id, ctx.warehouseId));
    } else if (ctx?.branchId) {
      conditions.push(
        or(eq(tableAny.branchId, ctx.branchId), isNull(tableAny.branchId)) as SQL,
      );
    }
    const all = [...conditions, ...(extra ?? [])].filter((c): c is SQL => Boolean(c));
    if (all.length === 0) return undefined;
    return all.length === 1 ? all[0] : and(...all);
  }

  const hasBranchCol = Boolean(tableAny.branchId);
  const hasWarehouseCol = Boolean(tableAny.warehouseId);

  if (ctx?.warehouseId) {
    if (hasWarehouseCol) {
      conditions.push(eq(tableAny.warehouseId, ctx.warehouseId));
    } else if (hasBranchCol && ctx.branchId) {
      conditions.push(eq(tableAny.branchId, ctx.branchId));
    }
  } else if (ctx?.branchId) {
    if (hasBranchCol && hasWarehouseCol) {
      const warehouseIds = await resolveScopedWarehouseIds(ctx);
      const branchMatch = eq(tableAny.branchId, ctx.branchId);
      conditions.push(
        warehouseIds && warehouseIds.length > 0
          ? (or(branchMatch, inArray(tableAny.warehouseId, warehouseIds)) as SQL)
          : branchMatch,
      );
    } else if (hasBranchCol) {
      conditions.push(eq(tableAny.branchId, ctx.branchId));
    } else if (hasWarehouseCol) {
      const warehouseIds = await resolveScopedWarehouseIds(ctx);
      if (warehouseIds) conditions.push(inArray(tableAny.warehouseId, warehouseIds));
    }
  }

  const all = [...conditions, ...(extra ?? [])].filter((c): c is SQL => Boolean(c));
  if (all.length === 0) return undefined;
  return all.length === 1 ? all[0] : and(...all);
}

// -----------------------------------------------------------------------------
// Write-time guards: validate a submitted branch/warehouse FK actually
// belongs to the ACTING user's own company/branch before a create/update.
// Canonical home for logic that used to be redeclared identically in
// purchasing-actions.ts, sales-actions.ts, vehicle-actions.ts and
// inventory-actions.ts.
// -----------------------------------------------------------------------------

export async function assertCompanyScopedBranch(
  companyId: string,
  branchId: string | null | undefined,
  userBranchId: string | null,
): Promise<string | null> {
  if (!branchId) return null;
  if (userBranchId && branchId !== userBranchId) {
    throw new Error("Cabang tidak sesuai dengan konteks akun Anda.");
  }

  const [branch] = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(and(eq(schema.branches.id, branchId), eq(schema.branches.companyId, companyId)));

  if (!branch) {
    throw new Error("Cabang tidak valid untuk perusahaan Anda.");
  }

  return branch.id;
}

export async function assertCompanyScopedWarehouse(
  companyId: string,
  warehouseId: string | null | undefined,
  userBranchId: string | null,
): Promise<string | null> {
  if (!warehouseId) return null;

  const [warehouse] = await db
    .select({ id: schema.warehouses.id, branchId: schema.warehouses.branchId })
    .from(schema.warehouses)
    .where(and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.companyId, companyId)));

  if (!warehouse) {
    throw new Error("Gudang tidak valid untuk perusahaan Anda.");
  }

  if (userBranchId && warehouse.branchId && warehouse.branchId !== userBranchId) {
    throw new Error("Gudang tidak sesuai dengan cabang akun Anda.");
  }

  return warehouse.id;
}

// -----------------------------------------------------------------------------
// Admin-form validators: pure relational-integrity checks with no acting-user
// component - used when an admin assigns a company/branch/warehouse scope to
// ANOTHER user, or a branch to a warehouse, via the master-data UI.
// -----------------------------------------------------------------------------

export async function assertBranchBelongsToCompany(
  branchId: string,
  companyId: string | null | undefined,
): Promise<void> {
  if (!companyId) {
    throw new Error("Pilih Cakupan Perusahaan terlebih dahulu sebelum memilih cabang.");
  }

  const [branch] = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(and(eq(schema.branches.id, branchId), eq(schema.branches.companyId, companyId)));

  if (!branch) {
    throw new Error("Cabang yang dipilih tidak termasuk dalam perusahaan yang dipilih.");
  }
}

export async function assertWarehouseBelongsToCompanyAndBranch(
  warehouseId: string,
  companyId: string | null | undefined,
  branchId: string | null | undefined,
): Promise<void> {
  if (!companyId) {
    throw new Error("Pilih Cakupan Perusahaan terlebih dahulu sebelum memilih gudang.");
  }

  const [warehouse] = await db
    .select({ id: schema.warehouses.id, branchId: schema.warehouses.branchId })
    .from(schema.warehouses)
    .where(and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.companyId, companyId)));

  if (!warehouse) {
    throw new Error("Gudang yang dipilih tidak termasuk dalam perusahaan yang dipilih.");
  }

  if (branchId && warehouse.branchId && warehouse.branchId !== branchId) {
    throw new Error("Gudang yang dipilih tidak termasuk dalam cabang yang dipilih.");
  }
}
