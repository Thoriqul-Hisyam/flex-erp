"use client";

import * as React from "react";
import { LayoutGrid, Package, Users, ShieldCheck, Boxes, ShoppingCart, ShoppingBag } from "lucide-react";
import { getUserSessionDataAction } from "@/app/actions/crud-actions";

export type ModuleCategory =
  | "ALL"
  | "MASTER_DATA"
  | "CRM"
  | "SYSTEM"
  | "INVENTORY"
  | "PURCHASING"
  | "SALES";

export interface UserPermissionContext {
  permissionsMap: Record<string, string[]>;
  isSuperAdmin: boolean;
  roleCode: string;
  roleName: string;
  userId?: string;
  userName?: string;
  companyName?: string;
  companyLogoUrl?: string;
  branchName?: string;
  warehouseName?: string;
  tenantCode?: string;
  tenantName?: string;
}

export interface ModuleOption {
  id: ModuleCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  pageKeys: string[];
}

export const MODULE_OPTIONS: ModuleOption[] = [
  {
    id: "ALL",
    label: "Semua Modul System",
    shortLabel: "Semua Modul",
    description: "Tampilkan seluruh modul berizin",
    icon: LayoutGrid,
    pageKeys: [],
  },
  {
    id: "MASTER_DATA",
    label: "Master Data Catalog",
    shortLabel: "Master Data",
    description: "Produk, Kategori, Satuan, Perusahaan, Cabang, Gudang & Pajak",
    icon: Package,
    pageKeys: [
      "md_products",
      "md_categories",
      "md_units",
      "md_departments",
      "md_companies",
      "md_branches",
      "md_warehouses",
      "md_taxes",
      "md_employees",
      "md_vehicles",
    ],
  },
  {
    id: "CRM",
    label: "CRM & Vendor Directory",
    shortLabel: "CRM & Vendors",
    description: "Direktori Pelanggan & Pemasok / Supplier",
    icon: Users,
    pageKeys: ["crm_customers", "crm_suppliers"],
  },
  {
    id: "INVENTORY",
    label: "Inventory & Warehouse",
    shortLabel: "Inventory",
    description:
      "Stok per Gudang, Movement Ledger, Adjustment, Transfer & Batch/Expiry",
    icon: Boxes,
    pageKeys: [
      "inv_stocks",
      "inv_movements",
      "inv_adjustments",
      "inv_transfers",
      "inv_batches",
      "inv_opnames",
    ],
  },
  {
    id: "PURCHASING",
    label: "Purchasing & Procurement",
    shortLabel: "Purchasing",
    description: "Purchase Request, PO, Goods Receipt & Supplier Invoices",
    icon: ShoppingCart,
    pageKeys: ["pur_requests", "pur_orders", "pur_receipts", "pur_invoices"],
  },
  {
    id: "SALES",
    label: "Sales & Distribution",
    shortLabel: "Sales",
    description: "Sales Quotations, Sales Orders, Delivery Orders & Customer Invoices",
    icon: ShoppingBag,
    pageKeys: ["sal_quotations", "sal_orders", "sal_deliveries", "sal_invoices"],
  },
  {
    id: "SYSTEM",
    label: "System Administration",
    shortLabel: "System Admin",
    description: "Users, Roles & Permissions Matrix, Audit Logs",
    icon: ShieldCheck,
    pageKeys: ["sys_users", "sys_roles", "sys_audit"],
  },
];

interface ModuleContextType {
  selectedModules: ModuleCategory[];
  toggleModule: (mod: ModuleCategory) => void;
  selectAllModules: () => void;
  availableModules: ModuleOption[];
  isSuperAdmin: boolean;
  isLoadingPermissions: boolean;
  permissionsMap: Record<string, string[]>;
  userContext: Partial<UserPermissionContext>;
}

const ModuleContext = React.createContext<ModuleContextType>({
  selectedModules: ["ALL"],
  toggleModule: () => {},
  selectAllModules: () => {},
  availableModules: [],
  isSuperAdmin: false,
  isLoadingPermissions: true,
  permissionsMap: {},
  userContext: {},
});

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [selectedModules, setSelectedModules] = React.useState<
    ModuleCategory[]
  >(["ALL"]);
  const [permissionsMap, setPermissionsMap] = React.useState<
    Record<string, string[]>
  >({});
  const [userContext, setUserContext] = React.useState<
    Partial<UserPermissionContext>
  >({});
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(true);

  // Load user permissions ONLY once per app mount (single consolidated request).
  // Every other consumer (Sidebar, usePermission, header) reads from context below.
  React.useEffect(() => {
    let isMounted = true;
    async function loadPermissions() {
      try {
        const res = await getUserSessionDataAction();
        if (!isMounted) return;

        if (res.success && res.data) {
          setIsSuperAdmin(!!res.data.isSuperAdmin);
          setPermissionsMap(res.data.permissionsMap || {});
          setUserContext({
            isSuperAdmin: !!res.data.isSuperAdmin,
            roleCode: res.data.roleCode,
            roleName: res.data.roleName,
            userId: res.data.userId,
            userName: res.data.userName,
            companyName: res.data.companyName,
            companyLogoUrl: res.data.companyLogoUrl,
            branchName: res.data.branchName,
            warehouseName: res.data.warehouseName,
            tenantCode: res.data.tenantCode,
            tenantName: res.data.tenantName,
          });
        } else {
          // Fail-closed default: grant nothing
          setIsSuperAdmin(false);
          setPermissionsMap({});
          setUserContext({});
        }
      } catch (err) {
        console.warn("[ModuleProvider] Error loading permissions:", err);
      } finally {
        if (isMounted) setIsLoadingPermissions(false);
      }
    }
    loadPermissions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Strict Filter for Available Modules:
  // - If still loading, return empty array so no unauthorized modules flash.
  // - If Super Admin, return all options.
  // - For regular users, ONLY return module if user has "read" action on AT LEAST ONE pageKey in module.
  const availableModules = React.useMemo(() => {
    if (isLoadingPermissions) {
      return [];
    }

    if (isSuperAdmin) {
      return MODULE_OPTIONS;
    }

    return MODULE_OPTIONS.filter((mod) => {
      // "ALL" option is always available
      if (mod.id === "ALL") return true;

      // Check if user's role has 'read' permission on ANY page in this module
      return mod.pageKeys.some((pk) => {
        const actions = permissionsMap[pk];
        return Array.isArray(actions) && actions.includes("read");
      });
    });
  }, [isLoadingPermissions, isSuperAdmin, permissionsMap]);

  const toggleModule = (mod: ModuleCategory) => {
    if (mod === "ALL") {
      setSelectedModules(["ALL"]);
      return;
    }

    setSelectedModules((prev) => {
      if (prev.includes("ALL")) {
        return [mod];
      }

      if (prev.includes(mod)) {
        const next = prev.filter((m) => m !== mod);
        return next.length === 0 ? ["ALL"] : next;
      }

      return [...prev.filter((m) => m !== "ALL"), mod];
    });
  };

  const selectAllModules = () => {
    setSelectedModules(["ALL"]);
  };

  return (
    <ModuleContext.Provider
      value={{
        selectedModules,
        toggleModule,
        selectAllModules,
        availableModules,
        isSuperAdmin,
        isLoadingPermissions,
        permissionsMap,
        userContext,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  return React.useContext(ModuleContext);
}

/**
 * Shared hook to read the consolidated user permission context (permissions map,
 * role, super-admin) provided by ModuleProvider. If consumed OUTSIDE the
 * provider (e.g. during SSR edge cases), it falls back to an empty loading state.
 */
export function usePermissionContext() {
  const ctx = React.useContext(ModuleContext);
  return {
    permissionsMap: ctx.permissionsMap,
    isSuperAdmin: ctx.isSuperAdmin,
    isReady: !ctx.isLoadingPermissions,
    roleCode: ctx.userContext.roleCode,
    roleName: ctx.userContext.roleName,
    userId: ctx.userContext.userId,
    userName: ctx.userContext.userName,
    companyName: ctx.userContext.companyName,
    companyLogoUrl: ctx.userContext.companyLogoUrl,
    branchName: ctx.userContext.branchName,
    warehouseName: ctx.userContext.warehouseName,
    tenantCode: ctx.userContext.tenantCode,
    tenantName: ctx.userContext.tenantName,
  };
}
