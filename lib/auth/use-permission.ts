"use client";

import * as React from "react";
import { usePermissionContext } from "@/components/providers/module-provider";
import { resolvePageKey } from "./permission-map";
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
  companyLogoUrl?: string;
  branchId?: string | null;
  branchName?: string;
  warehouseId?: string | null;
  warehouseName?: string;
  tenantCode?: string;
}

export { resolvePageKey };

/**
 * Client hook that evaluates the logged-in user's RBAC permissions for a given
 * entity/page. Instead of issuing its own server action per call, it reads from
 * the shared permission context provided once by ModuleProvider — keeping the
 * app's network/DB footprint minimal (one consolidated request per mount).
 */
export function usePermission(entityOrPageKey: string): PermissionState {
  const pageKey = resolvePageKey(entityOrPageKey);
  const {
    permissionsMap,
    isSuperAdmin,
    isReady,
    roleCode,
    roleName,
    userName,
    companyName,
    companyLogoUrl,
    branchId,
    branchName,
    warehouseId,
    warehouseName,
    tenantCode,
  } = usePermissionContext();

  return React.useMemo(() => {
    const actions = permissionsMap[pageKey] || [];
    const canRead = isSuperAdmin || actions.includes("read");
    const canCreate = isSuperAdmin || actions.includes("create");
    const canUpdate = isSuperAdmin || actions.includes("update");
    const canDelete = isSuperAdmin || actions.includes("delete");
    const canApprove = isSuperAdmin || actions.includes("approve");
    const canExport = isSuperAdmin || actions.includes("export");

    return {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canApprove,
      canExport,
      roleCode: roleCode || "",
      roleName: roleName || "",
      isSuperAdmin,
      isLoading: !isReady,
      userName,
      companyName,
      companyLogoUrl,
      branchId,
      branchName,
      warehouseId,
      warehouseName,
      tenantCode,
    };
  }, [
    pageKey,
    permissionsMap,
    isSuperAdmin,
    isReady,
    roleCode,
    roleName,
    userName,
    companyName,
    companyLogoUrl,
    branchId,
    branchName,
    warehouseId,
    warehouseName,
    tenantCode,
  ]);
}
