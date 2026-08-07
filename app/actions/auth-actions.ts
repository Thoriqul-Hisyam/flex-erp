"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/logger";
import { getErrorMessage } from "@/lib/utils";

export interface LoginActionResult {
  success: boolean;
  message?: string;
  field?: string;
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Authenticates a user against the PostgreSQL users table via Drizzle ORM
 * and establishes a secure httpOnly `nexus_session` cookie bound to a random
 * server-side session token.
 *
 * On success the cookie is set and the component redirects to the dashboard.
 */
export async function loginAction(
  _prevState: LoginActionResult | null,
  formData: FormData,
): Promise<LoginActionResult> {
  try {
    const email = (formData.get("email") || "").toString().trim().toLowerCase();
    const password = (formData.get("password") || "").toString();

    if (!email || !password) {
      return {
        success: false,
        message: "Email dan password wajib diisi.",
        field: "email",
      };
    }

    // 1. Look up user by email
    const [userRecord] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (!userRecord) {
      return {
        success: false,
        message: "Email atau password salah.",
        field: "email",
      };
    }

    // 2. Reject outright if the account is currently locked out.
    if (userRecord.lockedUntil && userRecord.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (userRecord.lockedUntil.getTime() - Date.now()) / 60000,
      );
      await logAuditEvent({
        tenantId: userRecord.tenantId,
        userId: userRecord.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: userRecord.id,
        newPayload: { reason: "account_locked" },
      });
      return {
        success: false,
        message: `Akun terkunci sementara akibat terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`,
      };
    }

    // 3. Verify password against the stored bcrypt hash only.
    //    No hardcoded default password bypass.
    const isPasswordValid = userRecord.passwordHash
      ? await bcrypt
          .compare(password, userRecord.passwordHash)
          .catch(() => false)
      : false;

    if (!isPasswordValid) {
      const nextAttempts = userRecord.failedLoginAttempts + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

      await db
        .update(schema.users)
        .set(
          shouldLock
            ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
            : { failedLoginAttempts: nextAttempts },
        )
        .where(eq(schema.users.id, userRecord.id))
        .catch(() => {});

      await logAuditEvent({
        tenantId: userRecord.tenantId,
        userId: userRecord.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: userRecord.id,
        newPayload: { reason: "wrong_password", attempts: nextAttempts },
      });

      if (shouldLock) {
        return {
          success: false,
          message: `Terlalu banyak percobaan gagal. Akun terkunci selama 15 menit.`,
        };
      }
      return {
        success: false,
        message: "Email atau password salah.",
        field: "password",
      };
    }
    // 4. Check account status
    if (userRecord.status !== "ACTIVE") {
      return {
        success: false,
        message: `Akun ${userRecord.name} berstatus ${userRecord.status}. Akses ditolak.`,
      };
    }

    // 5. Reset lockout state + update last login timestamp
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(schema.users.id, userRecord.id))
      .catch(() => {});

    await logAuditEvent({
      tenantId: userRecord.tenantId,
      userId: userRecord.id,
      action: "LOGIN",
      entity: "User",
      entityId: userRecord.id,
    });

    // 6. Create a server-side session (random token -> user) and store the
    //    token in a secure httpOnly cookie.
    const token = await createSession(userRecord.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch (err) {
    console.error("[loginAction] Error:", getErrorMessage(err) || err);
    return {
      success: false,
      message: "Terjadi kesalahan server. Coba lagi nanti.",
    };
  }

  // Authentication succeeded — redirect outside the try/catch so the
  // navigation signal is never swallowed by the error handler above.
  redirect("/");
}

/**
 * Revokes the active server-side session cookie + DB record and redirects.
 */
export async function signOutAction(): Promise<void> {
  await revokeSession();
  redirect("/login");
}
