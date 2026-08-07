import { db } from "../../db";
import * as schema from "../../db/schema";

export interface AuditPayload {
  tenantId: string;
  userId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "POST" | "CANCEL" | "LOGIN" | "LOGIN_FAILED";
  entity: string;
  entityId: string;
  oldPayload?: Record<string, unknown>;
  newPayload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(payload: AuditPayload): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      tenantId: payload.tenantId,
      userId: payload.userId ?? null,
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      oldPayload: payload.oldPayload ?? null,
      newPayload: payload.newPayload ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    });
  } catch (error) {
    console.error("Audit logging failed", error);
  }
}
