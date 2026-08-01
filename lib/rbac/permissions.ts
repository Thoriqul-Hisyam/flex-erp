export const PERMISSIONS = {
  MASTER_DATA_READ: "master_data:read",
  MASTER_DATA_WRITE: "master_data:write",
  SALES_READ: "sales:read",
  SALES_WRITE: "sales:write",
  SALES_APPROVE: "sales:approve",
  PURCHASING_READ: "purchasing:read",
  PURCHASING_WRITE: "purchasing:write",
  PURCHASING_APPROVE: "purchasing:approve",
  INVENTORY_READ: "inventory:read",
  INVENTORY_WRITE: "inventory:write",
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  ACCOUNTING_READ: "accounting:read",
  ACCOUNTING_WRITE: "accounting:write",
  ACCOUNTING_POST: "accounting:post",
  AUDIT_READ: "audit:read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(userPermissions: string[], permission: PermissionCode): boolean {
  if (userPermissions.includes("*")) return true;
  return userPermissions.includes(permission);
}
