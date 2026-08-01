import { cookies } from "next/headers";
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
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const now = new Date();

    // 1. Look up an active (non-revoked, non-expired) session by token
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

    // 2. Resolve the owning user
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
}

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
