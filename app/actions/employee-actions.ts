"use server";

import { db, schema } from "@/db";
import { eq, sql, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export async function fetchEmployeesAction(): Promise<ActionResult<any[]>> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    const emps = await db
      .select({
        id: schema.employees.id,
        employeeCode: schema.employees.employeeCode,
        name: schema.employees.name,
        email: schema.employees.email,
        phone: schema.employees.phone,
        jobTitle: schema.employees.jobTitle,
        departmentId: schema.employees.departmentId,
        departmentName: schema.departments.name,
        branchId: schema.employees.branchId,
        branchName: schema.branches.name,
        userId: schema.employees.userId,
        userName: schema.users.name,
        status: schema.employees.status,
        createdAt: schema.employees.createdAt,
      })
      .from(schema.employees)
      .leftJoin(schema.departments, eq(schema.employees.departmentId, schema.departments.id))
      .leftJoin(schema.branches, eq(schema.employees.branchId, schema.branches.id))
      .leftJoin(schema.users, eq(schema.employees.userId, schema.users.id))
      .where(eq(schema.employees.companyId, user.companyId))
      .orderBy(desc(schema.employees.createdAt));

    return {
      success: true,
      data: emps.map((e) => ({
        ...e,
        departmentName: e.departmentName || "-",
        branchName: e.branchName || "-",
        userName: e.userName || "-",
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : "",
      })),
    };
  } catch (error: any) {
    console.error("fetchEmployeesAction Error:", error);
    return { success: false, message: error.message || "Gagal mengambil data karyawan." };
  }
}

export async function createEmployeeAction(params: {
  name: string;
  employeeCode?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  branchId?: string;
  userId?: string;
}): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    if (!params.name) {
      return { success: false, message: "Nama Karyawan wajib diisi." };
    }

    let employeeCode = params.employeeCode;
    if (!employeeCode) {
      const [lastEmp] = await db
        .select({ code: schema.employees.employeeCode })
        .from(schema.employees)
        .where(eq(schema.employees.companyId, user.companyId))
        .orderBy(desc(schema.employees.createdAt))
        .limit(1);

      let nextSeq = 1;
      if (lastEmp?.code) {
        const parts = lastEmp.code.split("-");
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          nextSeq = Number(parts[1]) + 1;
        }
      }
      employeeCode = `EMP-${String(nextSeq).padStart(3, "0")}`;
    }

    const [emp] = await db
      .insert(schema.employees)
      .values({
        tenantId: user.tenantId,
        companyId: user.companyId,
        employeeCode,
        name: params.name,
        email: params.email || null,
        phone: params.phone || null,
        jobTitle: params.jobTitle || "Staff",
        departmentId: params.departmentId || null,
        branchId: params.branchId || null,
        userId: params.userId || null,
        status: "ACTIVE",
      })
      .returning();

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CREATE",
      entity: "Employee",
      entityId: emp.id,
    });

    revalidatePath("/master-data/employees");
    return { success: true, message: `Karyawan ${params.name} (${employeeCode}) berhasil ditambahkan.` };
  } catch (error: any) {
    console.error("createEmployeeAction Error:", error);
    return { success: false, message: error.message || "Gagal menambah karyawan." };
  }
}

export async function updateEmployeeAction(
  id: string,
  params: {
    name?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    departmentId?: string;
    branchId?: string;
    userId?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || !user.tenantId || !user.companyId) {
      return { success: false, message: "Unauthorized." };
    }

    await db
      .update(schema.employees)
      .set({
        ...(params.name ? { name: params.name } : {}),
        ...(params.email !== undefined ? { email: params.email || null } : {}),
        ...(params.phone !== undefined ? { phone: params.phone || null } : {}),
        ...(params.jobTitle ? { jobTitle: params.jobTitle } : {}),
        ...(params.departmentId !== undefined ? { departmentId: params.departmentId || null } : {}),
        ...(params.branchId !== undefined ? { branchId: params.branchId || null } : {}),
        ...(params.userId !== undefined ? { userId: params.userId || null } : {}),
        ...(params.status ? { status: params.status } : {}),
        updatedAt: new Date(),
      })
      .where(sql`${schema.employees.id} = ${id} AND ${schema.employees.companyId} = ${user.companyId}`);

    revalidatePath("/master-data/employees");
    return { success: true, message: "Data Karyawan berhasil diperbarui." };
  } catch (error: any) {
    console.error("updateEmployeeAction Error:", error);
    return { success: false, message: error.message || "Gagal mengupdate karyawan." };
  }
}
