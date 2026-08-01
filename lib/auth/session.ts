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
 *
 * Returns null when there is no valid session (fail-closed).
 *
 * Wrapped in React `cache()` so that all server calls within a single
 * request reuse one result instead of re-reading the DB each time.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const now = new Date();

    // 1. Look up an active session by token in a single query
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

    // 2. Resolve the owning user in a single query
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
 * user, running the lookups in parallel via `Promise.all`. Shared by the
 * permission server actions so they don't duplicate the same queries, and
 * memoized with `cache()` per request.
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

    const [company, branch, tenant, role] = await Promise.all([
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
    ]);

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

/**
 * Revokes the current session: clears the cookie AND marks the DB record
 * as revoked so the token can no longer be used even if stolen.
 */
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
  } catch (error) {
    console.warn("[session] revokeSession error:", error);
  } finally {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
