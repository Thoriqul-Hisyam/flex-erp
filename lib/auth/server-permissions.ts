import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser, getUserContext, type SessionUser } from "./session";
import {
  actionAliases,
  resolvePageKey,
  type PermissionAction,
} from "./permission-map";

export class AuthorizationError extends Error {
  code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export interface AuthorizedUserContext {
  user: SessionUser;
  pageKey: string;
  action: PermissionAction;
}

export async function requirePermission(
  entityOrPageKey: string,
  action: PermissionAction,
): Promise<AuthorizedUserContext> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("UNAUTHORIZED", "Unauthorized: mohon login kembali.");
  }

  const pageKey = resolvePageKey(entityOrPageKey);
  const context = await getUserContext(user);
  if (context.isSuperAdmin) {
    return { user, pageKey, action };
  }

  if (!user.roleId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Akses ditolak: akun belum memiliki role aktif.",
    );
  }

  const permissionRows = await db
    .select({
      module: schema.permissions.module,
      actions: schema.permissions.actions,
    })
    .from(schema.permissions)
    .where(eq(schema.permissions.roleId, user.roleId));

  const aliases = actionAliases(action);
  const hasGlobalWildcard = permissionRows.some((row) => {
    const actions = Array.isArray(row.actions) ? row.actions : [];
    return actions.includes("*");
  });
  const scopedAllowed = permissionRows.some((row) => {
    if (row.module !== pageKey) return false;
    const actions = Array.isArray(row.actions) ? row.actions : [];
    return actions.includes("*") || aliases.some((alias) => actions.includes(alias));
  });

  if (!hasGlobalWildcard && !scopedAllowed) {
    throw new AuthorizationError(
      "FORBIDDEN",
      `Akses ditolak: Anda tidak memiliki izin ${action} untuk modul ini.`,
    );
  }

  return { user, pageKey, action };
}

export async function denyIfUnauthorized(
  entityOrPageKey: string,
  action: PermissionAction,
): Promise<{ success: false; message: string; error: string } | null> {
  try {
    await requirePermission(entityOrPageKey, action);
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        message: error.message,
        error: error.message,
      };
    }

    return {
      success: false,
      message: "Gagal memvalidasi hak akses.",
      error: "Gagal memvalidasi hak akses.",
    };
  }
}
