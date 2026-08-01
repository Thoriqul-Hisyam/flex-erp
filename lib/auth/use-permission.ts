"use client";

import * as React from "react";
import { usePermissionContext } from "@/components/providers/module-provider";
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
  department: "md_departments",
  departments: "md_departments",
  customer: "crm_customers",
  supplier: "crm_suppliers",
  tax: "md_taxes",
  employee: "md_employees",
  employees: "md_employees",
  vehicle: "md_vehicles",
  vehicles: "md_vehicles",
  user: "sys_users",
  role: "sys_roles",
  audit: "sys_audit",
  stock: "inv_stocks",
  stocks: "inv_stocks",
  movement: "inv_movements",
  movements: "inv_movements",
  adjustment: "inv_adjustments",
  adjustments: "inv_adjustments",
  transfer: "inv_transfers",
  transfers: "inv_transfers",
  batch: "inv_batches",
  batches: "inv_batches",
  opname: "inv_opnames",
  opnames: "inv_opnames",
  inventory: "inv_stocks",
  purchaserequest: "pur_requests",
  purchaserequests: "pur_requests",
  pr: "pur_requests",
  purchaseorder: "pur_orders",
  purchaseorders: "pur_orders",
  po: "pur_orders",
  goodsreceipt: "pur_receipts",
  goodsreceipts: "pur_receipts",
  gr: "pur_receipts",
  supplierinvoice: "pur_invoices",
  supplierinvoices: "pur_invoices",
  salesquotation: "sal_quotations",
  salesquotations: "sal_quotations",
  sq: "sal_quotations",
  salesorder: "sal_orders",
  salesorders: "sal_orders",
  so: "sal_orders",
  deliveryorder: "sal_deliveries",
  deliveryorders: "sal_deliveries",
  do: "sal_deliveries",
  customerinvoice: "sal_invoices",
  customerinvoices: "sal_invoices",
  purchasing: "pur_orders",
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
    branchName,
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
      branchName,
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
    branchName,
    warehouseName,
    tenantCode,
  ]);
}
