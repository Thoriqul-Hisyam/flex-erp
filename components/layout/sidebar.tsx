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
  Briefcase,
  Receipt,
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  ClipboardCheck,
  FileText,
  ShoppingCart,
  PackageCheck,
  FileSpreadsheet,
  ShoppingBag,
  UserCheck,
  Car,
  Layers,
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
import { signOutAction } from "@/app/actions/auth-actions";
import {
  useModule,
  usePermissionContext,
  ModuleCategory,
} from "@/components/providers/module-provider";

export interface NavItem {
  icon: React.ElementType;
  href: string;
  label: string;
  pageKey: string | null;
  category: ModuleCategory;
}

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    href: "/",
    label: "Dashboard Overview",
    pageKey: null,
    category: "ALL",
  },
  {
    icon: Package,
    href: "/master-data/products",
    label: "Inventory Products",
    pageKey: "md_products",
    category: "MASTER_DATA",
  },
  {
    icon: FolderTree,
    href: "/master-data/product-categories",
    label: "Product Categories",
    pageKey: "md_categories",
    category: "MASTER_DATA",
  },
  {
    icon: Ruler,
    href: "/master-data/units",
    label: "Units of Measurement",
    pageKey: "md_units",
    category: "MASTER_DATA",
  },
  {
    icon: Building2,
    href: "/master-data/companies",
    label: "Companies",
    pageKey: "md_companies",
    category: "MASTER_DATA",
  },
  {
    icon: GitBranch,
    href: "/master-data/branches",
    label: "Branches",
    pageKey: "md_branches",
    category: "MASTER_DATA",
  },
  {
    icon: Warehouse,
    href: "/master-data/warehouses",
    label: "Warehouses",
    pageKey: "md_warehouses",
    category: "MASTER_DATA",
  },
  {
    icon: Receipt,
    href: "/master-data/taxes",
    label: "Tax Configuration",
    pageKey: "md_taxes",
    category: "MASTER_DATA",
  },
  {
    icon: Briefcase,
    href: "/master-data/departments",
    label: "Departments / Divisi",
    pageKey: "md_departments",
    category: "MASTER_DATA",
  },
  {
    icon: UserCheck,
    href: "/master-data/employees",
    label: "Data Karyawan",
    pageKey: "md_employees",
    category: "MASTER_DATA",
  },
  {
    icon: Car,
    href: "/master-data/vehicles",
    label: "Armada Kendaraan",
    pageKey: "md_vehicles",
    category: "MASTER_DATA",
  },
  {
    icon: Users,
    href: "/master-data/customers",
    label: "Customers",
    pageKey: "crm_customers",
    category: "CRM",
  },
  {
    icon: Truck,
    href: "/master-data/suppliers",
    label: "Suppliers",
    pageKey: "crm_suppliers",
    category: "CRM",
  },
  {
    icon: Boxes,
    href: "/inventory/stocks",
    label: "Warehouse Stocks",
    pageKey: "inv_stocks",
    category: "INVENTORY",
  },
  {
    icon: ArrowLeftRight,
    href: "/inventory/movements",
    label: "Stock Movements",
    pageKey: "inv_movements",
    category: "INVENTORY",
  },
  {
    icon: ClipboardList,
    href: "/inventory/adjustments",
    label: "Stock Adjustments",
    pageKey: "inv_adjustments",
    category: "INVENTORY",
  },
  {
    icon: Layers,
    href: "/inventory/transfers",
    label: "Stock Transfers",
    pageKey: "inv_transfers",
    category: "INVENTORY",
  },
  {
    icon: History,
    href: "/inventory/batches",
    label: "Batch & Expiry",
    pageKey: "inv_batches",
    category: "INVENTORY",
  },
  {
    icon: ClipboardCheck,
    href: "/inventory/opnames",
    label: "Stock Opname",
    pageKey: "inv_opnames",
    category: "INVENTORY",
  },
  {
    icon: FileText,
    href: "/purchasing/requests",
    label: "Purchase Requests",
    pageKey: "pur_requests",
    category: "PURCHASING",
  },
  {
    icon: ShoppingCart,
    href: "/purchasing/orders",
    label: "Purchase Orders",
    pageKey: "pur_orders",
    category: "PURCHASING",
  },
  {
    icon: PackageCheck,
    href: "/purchasing/receipts",
    label: "Goods Receipt (Stock IN)",
    pageKey: "pur_receipts",
    category: "PURCHASING",
  },
  {
    icon: FileSpreadsheet,
    href: "/purchasing/invoices",
    label: "Supplier Invoices",
    pageKey: "pur_invoices",
    category: "PURCHASING",
  },
  {
    icon: FileText,
    href: "/sales/quotations",
    label: "Sales Quotations",
    pageKey: "sal_quotations",
    category: "SALES",
  },
  {
    icon: ShoppingBag,
    href: "/sales/orders",
    label: "Sales Orders",
    pageKey: "sal_orders",
    category: "SALES",
  },
  {
    icon: Truck,
    href: "/sales/deliveries",
    label: "Delivery Orders (Surat Jalan)",
    pageKey: "sal_deliveries",
    category: "SALES",
  },
  {
    icon: Receipt,
    href: "/sales/invoices",
    label: "Customer Invoices",
    pageKey: "sal_invoices",
    category: "SALES",
  },
  {
    icon: UserCog,
    href: "/system/users",
    label: "Users Management",
    pageKey: "sys_users",
    category: "SYSTEM",
  },
  {
    icon: ShieldCheck,
    href: "/system/roles",
    label: "RBAC Roles & Permissions",
    pageKey: "sys_roles",
    category: "SYSTEM",
  },
  {
    icon: History,
    href: "/system/audit-logs",
    label: "System Audit Logs",
    pageKey: "sys_audit",
    category: "SYSTEM",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { selectedModules } = useModule();

  const { permissionsMap, isSuperAdmin } = usePermissionContext();

  // Filter nav items by read permission from shared context (no extra request).
  const permissionFilteredItems = React.useMemo(() => {
    if (isSuperAdmin) return navItems;

    return navItems.filter((item) => {
      if (item.pageKey === null) return true;
      const actions = permissionsMap[item.pageKey];
      return Array.isArray(actions) && actions.includes("read");
    });
  }, [isSuperAdmin, permissionsMap]);

  // Filter items based on selected modules array (Multi-select support)
  const visibleItems = React.useMemo(() => {
    if (selectedModules.includes("ALL")) return permissionFilteredItems;

    return permissionFilteredItems.filter(
      (item) => item.href === "/" || selectedModules.includes(item.category),
    );
  }, [permissionFilteredItems, selectedModules]);

  const handleSignOut = () => {
    void signOutAction();
  };

  return (
    <aside className="sticky top-3 h-[calc(100vh-1.5rem)] w-16 shrink-0 flex flex-col items-center justify-between py-1 select-none z-40 gap-3">
      {/* Top Sun/Moon Theme Switcher Pill */}
      <div className="bg-white dark:bg-[#12161f] p-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col gap-1.5 shrink-0 mb-1">
        <button
          onClick={() => theme !== "light" && toggleTheme()}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
            theme === "light"
              ? "bg-[#0088ff] text-white shadow-sm shadow-blue-500/20"
              : "text-[#8a94a6] hover:text-slate-900 dark:hover:text-white",
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
              : "text-[#8a94a6] hover:text-slate-900 dark:hover:text-white",
          )}
          title="Switch to Dark Theme"
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>

      {/* Main Center Floating Navigation Card */}
      <div className="bg-white dark:bg-[#12161f] px-2 py-3 rounded-[26px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col items-center gap-1.5 h-auto shrink-0 max-h-[calc(100vh-190px)] overflow-y-auto scrollbar-none my-1">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          // Check if category changed from previous item to insert a sleek divider
          const prevItem = visibleItems[index - 1];
          const showDivider = prevItem && prevItem.category !== item.category;

          return (
            <React.Fragment key={item.href}>
              {showDivider && (
                <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-800 my-1 rounded-full shrink-0" />
              )}
              <Link
                href={item.href}
                title={item.label}
                className={cn(
                  "h-9 w-9 shrink-0 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group",
                  isActive
                    ? "bg-[#0088ff] text-white shadow-md shadow-blue-500/25 scale-105"
                    : "text-[#8a94a6] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Icon className="h-4.5 w-4.5" />

                {/* Tooltip on hover */}
                <span className="absolute left-12 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-xl z-50 flex items-center gap-1.5">
                  <span className="text-[9px] uppercase font-mono text-blue-400 bg-blue-950/60 px-1 py-0.5 rounded">
                    {item.category}
                  </span>
                  {item.label}
                </span>
              </Link>
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom Help & Logout Floating Card */}
      <div className="bg-white dark:bg-[#12161f] p-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col items-center gap-1.5 shrink-0 mt-1">
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
