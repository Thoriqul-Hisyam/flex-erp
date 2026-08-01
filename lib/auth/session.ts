import { cookies } from "next/headers";
import { cache } from "react";
import { randomBytes } from "crypto";
import { db, schema } from "@/db";
import { eq, and, gt, isNull } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "nexus_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours expiration

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string | null;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
}

export interface UserContext {
  userId: string;
  userName: string;
  email: string;
  roleCode: string;
  roleName: string;
  isSuperAdmin: boolean;
  companyId: string | null;
  companyName: string;
  companyLogoUrl?: string;
  branchId: string | null;
  branchName: string;
  warehouseName: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  roleId: string | null;
}

/**
 * Generates a cryptographically-secure random session token.
 */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Creates a new session record for the given user and returns the raw token.
 * The token (NOT the user id) is what gets stored in the cookie.
 */
export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(schema.sessions).values({
    token,
    userId,
    ipAddress: meta?.ipAddress || null,
    userAgent: meta?.userAgent || null,
    expiresAt,
  });

  return token;
}

/**
 * Reads the session cookie and resolves the authenticated user ONLY if the
 * session token is valid: exists in DB, not revoked, and not expired.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const now = new Date();

    const [sessionRecord] = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, sessionCookie.value),
          isNull(schema.sessions.revokedAt),
          gt(schema.sessions.expiresAt, now),
        ),
      );

    if (!sessionRecord) {
      return null;
    }

    const [userRecord] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, sessionRecord.userId));

    if (!userRecord || userRecord.status !== "ACTIVE") {
      return null;
    }

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role || "",
      roleId: userRecord.roleId,
      tenantId: userRecord.tenantId,
      companyId: userRecord.companyId,
      branchId: userRecord.branchId,
    };
  } catch (error) {
    console.warn("[session] getSessionUser error:", error);
    return null;
  }
});

/**
 * Resolves display context (company/branch/tenant/role names) for a session
 * user, querying siteSettings.logoUrl and companies.logoUrl from DB.
 */
export const getUserContext = cache(
  async (user: SessionUser): Promise<UserContext> => {
    let companyName = "PT Lefatech Indonesia";
    let branchName = "Lefatech Head Office Jakarta";
    let warehouseName = "Lefatech Central Warehouse";
    let tenantCode = "LEFATECH-GLOBAL";
    let roleCode = "UNKNOWN";
    let roleName = user.role || "Unknown";
    let isSuperAdmin = false;

    const [company, branch, tenant, role, settings] = await Promise.all([
      user.companyId
        ? db
            .select()
            .from(schema.companies)
            .where(eq(schema.companies.id, user.companyId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      user.branchId
        ? db
            .select()
            .from(schema.branches)
            .where(eq(schema.branches.id, user.branchId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, user.tenantId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      user.roleId
        ? db
            .select()
            .from(schema.roles)
            .where(eq(schema.roles.id, user.roleId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      db
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.tenantId, user.tenantId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    let companyLogoUrl = company?.logoUrl || settings?.logoUrl || "/logo/logo.png";

    if (company) companyName = company.name;
    if (branch) branchName = branch.name;
    if (tenant) tenantCode = tenant.code;

    if (role) {
      roleCode = role.code || "UNKNOWN";
      roleName = role.name || roleName;
      isSuperAdmin =
        roleCode === "SUPER_ADMIN" ||
        roleName.toLowerCase().includes("super admin");
    } else {
      isSuperAdmin = (user.role || "").toLowerCase().includes("super admin");
      if (isSuperAdmin) roleCode = "SUPER_ADMIN";
    }

    const tenantName = tenant?.name || user.tenantId;

    return {
      userId: user.id,
      userName: user.name,
      email: user.email,
      roleCode,
      roleName,
      isSuperAdmin,
      companyId: user.companyId,
      companyName,
      companyLogoUrl,
      branchId: user.branchId,
      branchName,
      warehouseName,
      tenantId: user.tenantId,
      tenantCode,
      roleId: user.roleId,
      tenantName,
    } as UserContext;
  },
);

export async function revokeSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) {
      await db
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.sessions.token, sessionCookie.value));
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.warn("[session] revokeSession error:", error);
  }
}
