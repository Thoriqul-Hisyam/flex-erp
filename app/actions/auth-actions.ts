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

export interface LoginActionResult {
  success: boolean;
  message?: string;
  field?: string;
}

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
    // 2. Verify password against the stored bcrypt hash only.
    //    No hardcoded default password bypass.
    const isPasswordValid = userRecord.passwordHash
      ? await bcrypt
          .compare(password, userRecord.passwordHash)
          .catch(() => false)
      : false;

    if (!isPasswordValid) {
      return {
        success: false,
        message: "Email atau password salah.",
        field: "password",
      };
    }
    // 3. Check account status
    if (userRecord.status !== "ACTIVE") {
      return {
        success: false,
        message: `Akun ${userRecord.name} berstatus ${userRecord.status}. Akses ditolak.`,
      };
    }

    // 4. Update last login timestamp
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, userRecord.id))
      .catch(() => {});

    // 5. Create a server-side session (random token -> user) and store the
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
  } catch (err: any) {
    console.error("[loginAction] Error:", err?.message || err);
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
