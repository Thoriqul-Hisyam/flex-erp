export interface AuditPayload {
  tenantId: string;
  userId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "VOID" | "POST";
  entity: string;
  entityId: string;
  oldPayload?: Record<string, unknown>;
  newPayload?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAuditEvent(payload: AuditPayload): Promise<void> {
  console.log(`[AUDIT LOG] [${new Date().toISOString()}] Action: ${payload.action} | Entity: ${payload.entity} (${payload.entityId}) | User: ${payload.userId || "SYSTEM"}`);
}
