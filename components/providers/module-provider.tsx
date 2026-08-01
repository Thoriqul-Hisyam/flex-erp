"use client";

import * as React from "react";
import { LayoutGrid, Package, Users, ShieldCheck } from "lucide-react";
import { getSessionAllPermissionsAction } from "@/app/actions/crud-actions";

export type ModuleCategory = "ALL" | "MASTER_DATA" | "CRM" | "SYSTEM";

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
    pageKeys: ["md_products", "md_categories", "md_units", "md_companies", "md_branches", "md_warehouses", "md_taxes"],
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
}

const ModuleContext = React.createContext<ModuleContextType>({
  selectedModules: ["ALL"],
  toggleModule: () => {},
  selectAllModules: () => {},
  availableModules: [],
  isSuperAdmin: false,
  isLoadingPermissions: true,
});

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [selectedModules, setSelectedModules] = React.useState<ModuleCategory[]>(["ALL"]);
  const [userPermissions, setUserPermissions] = React.useState<Record<string, string[]>>({});
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(true);

  // Load user permissions to filter available module options
  React.useEffect(() => {
    let isMounted = true;
    async function loadPermissions() {
      try {
        const res = await getSessionAllPermissionsAction();
        if (!isMounted) return;

        if (res.success && res.data) {
          setIsSuperAdmin(!!res.data.isSuperAdmin);
          setUserPermissions(res.data.permissionsMap || {});
        } else {
          // Fallback default session is Super Admin
          setIsSuperAdmin(true);
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
        const actions = userPermissions[pk];
        return Array.isArray(actions) && actions.includes("read");
      });
    });
  }, [isLoadingPermissions, isSuperAdmin, userPermissions]);

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
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  return React.useContext(ModuleContext);
}
