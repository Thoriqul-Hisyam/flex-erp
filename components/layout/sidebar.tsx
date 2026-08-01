"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Building2,
  GitBranch,
  Warehouse,
  Users,
  Truck,
  Ruler,
  Receipt,
  UserCog,
  ShieldCheck,
  History,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { getSessionAllPermissionsAction } from "@/app/actions/crud-actions";
import { useModule, ModuleCategory } from "@/components/providers/module-provider";

export interface NavItem {
  icon: React.ElementType;
  href: string;
  label: string;
  pageKey: string | null;
  category: ModuleCategory;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, href: "/", label: "Dashboard Overview", pageKey: null, category: "ALL" },
  { icon: Package, href: "/master-data/products", label: "Inventory Products", pageKey: "md_products", category: "MASTER_DATA" },
  { icon: FolderTree, href: "/master-data/product-categories", label: "Product Categories", pageKey: "md_categories", category: "MASTER_DATA" },
  { icon: Ruler, href: "/master-data/units", label: "Units of Measurement", pageKey: "md_units", category: "MASTER_DATA" },
  { icon: Building2, href: "/master-data/companies", label: "Companies", pageKey: "md_companies", category: "MASTER_DATA" },
  { icon: GitBranch, href: "/master-data/branches", label: "Branches", pageKey: "md_branches", category: "MASTER_DATA" },
  { icon: Warehouse, href: "/master-data/warehouses", label: "Warehouses", pageKey: "md_warehouses", category: "MASTER_DATA" },
  { icon: Receipt, href: "/master-data/taxes", label: "Tax Configuration", pageKey: "md_taxes", category: "MASTER_DATA" },
  { icon: Users, href: "/master-data/customers", label: "Customers", pageKey: "crm_customers", category: "CRM" },
  { icon: Truck, href: "/master-data/suppliers", label: "Suppliers", pageKey: "crm_suppliers", category: "CRM" },
  { icon: UserCog, href: "/system/users", label: "Users Management", pageKey: "sys_users", category: "SYSTEM" },
  { icon: ShieldCheck, href: "/system/roles", label: "RBAC Roles & Permissions", pageKey: "sys_roles", category: "SYSTEM" },
  { icon: History, href: "/system/audit-logs", label: "System Audit Logs", pageKey: "sys_audit", category: "SYSTEM" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { selectedModules } = useModule();

  const [permissionFilteredItems, setPermissionFilteredItems] = React.useState<NavItem[]>(navItems);

  // Load RBAC permissions
  React.useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      try {
        const res = await getSessionAllPermissionsAction();
        if (!isMounted) return;

        if (res.success && res.data) {
          if (res.data.isSuperAdmin) {
            setPermissionFilteredItems(navItems);
          } else {
            const permMap: Record<string, string[]> = res.data.permissionsMap || {};
            const filtered = navItems.filter((item) => {
              if (item.pageKey === null) return true;
              const actions = permMap[item.pageKey];
              return actions && actions.includes("read");
            });
            setPermissionFilteredItems(filtered);
          }
        }
      } catch (err) {
        console.warn("[Sidebar] Permission load error:", err);
      }
    }

    loadPermissions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter items based on selected modules array (Multi-select support)
  const visibleItems = React.useMemo(() => {
    if (selectedModules.includes("ALL")) return permissionFilteredItems;

    return permissionFilteredItems.filter(
      (item) => item.href === "/" || selectedModules.includes(item.category)
    );
  }, [permissionFilteredItems, selectedModules]);

  const handleSignOut = () => {
    document.cookie = "nexus_session=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="sticky top-3 h-[calc(100vh-1.5rem)] w-16 shrink-0 flex flex-col items-center justify-between py-2 select-none z-40">
      {/* Top Sun/Moon Theme Switcher Pill */}
      <div className="bg-white dark:bg-[#12161f] p-1 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col gap-1.5">
        <button
          onClick={() => theme !== "light" && toggleTheme()}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
            theme === "light"
              ? "bg-[#0088ff] text-white shadow-sm shadow-blue-500/20"
              : "text-[#8a94a6] hover:text-slate-900 dark:hover:text-white"
          )}
          title="Switch to Light Theme"
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          onClick={() => theme !== "dark" && toggleTheme()}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
            theme === "dark"
              ? "bg-[#0088ff] text-white shadow-sm shadow-blue-500/20"
              : "text-[#8a94a6] hover:text-slate-900 dark:hover:text-white"
          )}
          title="Switch to Dark Theme"
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>

      {/* Main Center Floating Navigation Card */}
      <div className="bg-white dark:bg-[#12161f] px-2 py-3.5 rounded-[26px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col items-center gap-2 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group",
                isActive
                  ? "bg-[#0088ff] text-white shadow-md shadow-blue-500/25"
                  : "text-[#8a94a6] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />

              {/* Tooltip on hover */}
              <span className="absolute left-14 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Help & Logout Floating Card */}
      <div className="bg-white dark:bg-[#12161f] p-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col items-center gap-1.5">
        <button
          className="h-8 w-8 rounded-full flex items-center justify-center text-[#8a94a6] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Help & Support"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          onClick={handleSignOut}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[#8a94a6] hover:text-rose-600 transition-colors cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
