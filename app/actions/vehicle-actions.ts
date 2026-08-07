"use server";

import { db, schema } from "@/db";
import { eq, sql, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { denyIfUnauthorized } from "@/lib/auth/server-permissions";
import { getScopeContext, withScope, assertCompanyScopedBranch } from "@/lib/auth/scope";
import { logAuditEvent } from "@/lib/audit/logger";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export async function fetchVehiclesAction(): Promise<ActionResult<any[]>> {
  try {
    const denied = await denyIfUnauthorized("md_vehicles", "read");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId) {
      return { success: false, message: "Unauthorized." };
    }
    const scope = getScopeContext(user);
    const vehWhere = await withScope(schema.vehicles, scope);

    const vehBaseQuery = db
      .select({
        id: schema.vehicles.id,
        vehicleCode: schema.vehicles.vehicleCode,
        plateNumber: schema.vehicles.plateNumber,
        vehicleType: schema.vehicles.vehicleType,
        brandModel: schema.vehicles.brandModel,
        branchId: schema.vehicles.branchId,
        branchName: schema.branches.name,
        status: schema.vehicles.status,
        notes: schema.vehicles.notes,
        createdAt: schema.vehicles.createdAt,
      })
      .from(schema.vehicles)
      .leftJoin(schema.branches, eq(schema.vehicles.branchId, schema.branches.id));
    const vehs = await (vehWhere ? vehBaseQuery.where(vehWhere) : vehBaseQuery).orderBy(
      desc(schema.vehicles.createdAt),
    );

    return {
      success: true,
      data: vehs.map((v) => ({
        ...v,
        branchName: v.branchName || "-",
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : "",
      })),
    };
  } catch (error) {
    console.error("fetchVehiclesAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengambil data armada kendaraan." };
  }
}

export async function createVehicleAction(params: {
  plateNumber: string;
  vehicleCode?: string;
  vehicleType?: string;
  brandModel?: string;
  branchId?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("md_vehicles", "create");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    if (!params.plateNumber) {
      return { success: false, message: "Nomor Polisi (Plat Nomor) wajib diisi." };
    }

    // Cabang Penempatan is managed by a centralized fleet admin across all branches,
    // so it's only validated against the company (not against user.branchId).
    const resolvedBranchId = await assertCompanyScopedBranch(
      user.companyId,
      params.branchId,
      null,
    );

    let vehicleCode = params.vehicleCode;
    if (!vehicleCode) {
      const [lastVeh] = await db
        .select({ code: schema.vehicles.vehicleCode })
        .from(schema.vehicles)
        .where(eq(schema.vehicles.companyId, user.companyId))
        .orderBy(desc(schema.vehicles.createdAt))
        .limit(1);

      let nextSeq = 1;
      if (lastVeh?.code) {
        const parts = lastVeh.code.split("-");
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          nextSeq = Number(parts[1]) + 1;
        }
      }
      vehicleCode = `ARM-${String(nextSeq).padStart(3, "0")}`;
    }

    const [v] = await db
      .insert(schema.vehicles)
      .values({
        tenantId: user.tenantId,
        companyId: user.companyId,
        vehicleCode,
        plateNumber: params.plateNumber.toUpperCase(),
        vehicleType: params.vehicleType || "Truck Box",
        brandModel: params.brandModel || null,
        branchId: resolvedBranchId || null,
        notes: params.notes || null,
        status: "ACTIVE",
      })
      .returning();

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "Vehicle",
      entityId: v.id,
    });

    revalidatePath("/master-data/vehicles");
    return { success: true, message: `Armada ${v.plateNumber} (${vehicleCode}) berhasil ditambahkan.` };
  } catch (error) {
    console.error("createVehicleAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal menambah kendaraan armada." };
  }
}

export async function updateVehicleAction(
  id: string,
  params: {
    plateNumber?: string;
    vehicleType?: string;
    brandModel?: string;
    branchId?: string;
    notes?: string;
    status?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  }
): Promise<ActionResult> {
  try {
    const denied = await denyIfUnauthorized("md_vehicles", "update");
    if (denied) return denied;

    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const resolvedBranchId = await assertCompanyScopedBranch(
      user.companyId,
      params.branchId,
      null,
    );

    await db
      .update(schema.vehicles)
      .set({
        ...(params.plateNumber ? { plateNumber: params.plateNumber.toUpperCase() } : {}),
        ...(params.vehicleType ? { vehicleType: params.vehicleType } : {}),
        ...(params.brandModel !== undefined ? { brandModel: params.brandModel || null } : {}),
        ...(params.branchId !== undefined ? { branchId: resolvedBranchId || null } : {}),
        ...(params.notes !== undefined ? { notes: params.notes || null } : {}),
        ...(params.status ? { status: params.status } : {}),
        updatedAt: new Date(),
      })
      .where(sql`${schema.vehicles.id} = ${id} AND ${schema.vehicles.companyId} = ${user.companyId}`);

    revalidatePath("/master-data/vehicles");
    return { success: true, message: "Data Kendaraan Armada berhasil diperbarui." };
  } catch (error) {
    console.error("updateVehicleAction Error:", error);
    return { success: false, message: getErrorMessage(error) || "Gagal mengupdate kendaraan." };
  }
}
