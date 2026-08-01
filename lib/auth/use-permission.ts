"use client";

import * as React from "react";
import { getSessionPermissionsAction } from "@/app/actions/crud-actions";

export interface PermissionState {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  roleCode: string;
  roleName: string;
  isSuperAdmin: boolean;
  isLoading: boolean;
  userName?: string;
  companyName?: string;
  branchName?: string;
  warehouseName?: string;
  tenantCode?: string;
}

const ENTITY_TO_PAGE_KEY_MAP: Record<string, string> = {
  company: "md_companies",
  branch: "md_branches",
  warehouse: "md_warehouses",
  productcategory: "md_categories",
  product: "md_products",
  unit: "md_units",
  customer: "crm_customers",
  supplier: "crm_suppliers",
  tax: "md_taxes",
  user: "sys_users",
  role: "sys_roles",
  audit: "sys_audit",
};

/**
 * Resolves entityName or path to pageKey (e.g. "Product" -> "md_products")
 */
export function resolvePageKey(entityOrPath: string): string {
  if (!entityOrPath) return "md_products";
  const clean = entityOrPath.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ENTITY_TO_PAGE_KEY_MAP[clean]) {
    return ENTITY_TO_PAGE_KEY_MAP[clean];
  }
  for (const [key, pageKey] of Object.entries(ENTITY_TO_PAGE_KEY_MAP)) {
    if (clean.includes(key)) return pageKey;
  }
  return entityOrPath;
}

/**
 * Client hook that evaluates the logged-in user's RBAC permissions
 * for a given entity/page by calling the server action which reads
 * the nexus_session cookie and resolves user → role → permissions.
 */
export function usePermission(entityOrPageKey: string): PermissionState {
  const pageKey = resolvePageKey(entityOrPageKey);
  const [state, setState] = React.useState<PermissionState>({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canApprove: false,
    canExport: false,
    roleCode: "",
    roleName: "",
    isSuperAdmin: false,
    isLoading: true,
  });

  React.useEffect(() => {
    let isMounted = true;

    async function evaluatePermissions() {
      try {
        const res = await getSessionPermissionsAction(pageKey);

        if (!isMounted) return;

        if (res.success && res.data) {
          setState({
            canRead: !!res.data.canRead,
            canCreate: !!res.data.canCreate,
            canUpdate: !!res.data.canUpdate,
            canDelete: !!res.data.canDelete,
            canApprove: !!res.data.canApprove,
            canExport: !!res.data.canExport,
            roleCode: res.data.roleCode || "",
            roleName: res.data.roleName || "",
            isSuperAdmin: !!res.data.isSuperAdmin,
            isLoading: false,
            userName: res.data.userName,
            companyName: res.data.companyName,
            branchName: res.data.branchName,
            warehouseName: res.data.warehouseName,
            tenantCode: res.data.tenantCode,
          });
        } else {
          // Failed to resolve session — deny all access (fail-closed)
          setState({
            canRead: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canApprove: false,
            canExport: false,
            roleCode: "",
            roleName: "",
            isSuperAdmin: false,
            isLoading: false,
          });
        }
      } catch (err) {
        console.warn("[usePermission] Error:", err);
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }

    evaluatePermissions();

    return () => {
      isMounted = false;
    };
  }, [pageKey]);

  return state;
}
