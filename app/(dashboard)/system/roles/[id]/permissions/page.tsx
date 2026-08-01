"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft, Check, Lock, RotateCcw, CheckSquare, Square, Search, Shield, Filter, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { RoleData } from "@/lib/types/entities";
import { updateRolePermissionsAction, fetchRecordsAction, fetchRolePermissionsAction } from "@/app/actions/crud-actions";

interface PageModuleConfig {
  key: string;
  name: string;
  route: string;
  category: string;
  icon: string;
  description: string;
}

// Per-Page / Per-Resource Enterprise ERP Matrix Catalog
const PAGE_MODULES: PageModuleConfig[] = [
  // 1. Master Data Pages
  { key: "md_companies", name: "Company Profiles & Legal Entities", route: "/master-data/companies", category: "Master Data", icon: "🏛️", description: "Manage corporate entities, tax IDs, multi-tenant subsidiaries, and currencies." },
  { key: "md_branches", name: "Branch Offices & Locations", route: "/master-data/branches", category: "Master Data", icon: "🏢", description: "Manage regional branches, headquarters flags, contact numbers, and office addresses." },
  { key: "md_warehouses", name: "Warehouses & Logistics Hubs", route: "/master-data/warehouses", category: "Master Data", icon: "📦", description: "Manage storage facilities, capacity utilization %, and default fulfillment hubs." },
  { key: "md_categories", name: "Product Categories", route: "/master-data/product-categories", category: "Master Data", icon: "🏷️", description: "Manage SKU category hierarchies, product classifications, and category codes." },
  { key: "md_products", name: "Products & Service Items", route: "/master-data/products", category: "Master Data", icon: "🛒", description: "Manage global SKU catalog, standard cost prices, list selling prices, and UOM." },

  // 2. Commercial & CRM Pages
  { key: "crm_customers", name: "Customer Directory & Credit Terms", route: "/crm/customers", category: "Commercial & CRM", icon: "🤝", description: "Manage customer profiles, credit limit limits, payment terms, and tax IDs." },
  { key: "crm_suppliers", name: "Supplier & Vendor Directory", route: "/crm/suppliers", category: "Commercial & CRM", icon: "🏭", description: "Manage vendor master records, supplier ratings, payment terms, and tax data." },
  { key: "sales_orders", name: "Sales Orders & POS Terminal", route: "/sales/orders", category: "Commercial & CRM", icon: "💳", description: "Create and process commercial sales orders, POS receipts, and invoice billing." },
  { key: "sales_quotations", name: "Commercial Quotations & Bids", route: "/sales/quotations", category: "Commercial & CRM", icon: "📑", description: "Draft sales proposals, price estimations, and customer quotations." },

  // 3. Inventory & Operations Pages
  { key: "inv_stocks", name: "Inventory Stock Balances", route: "/inventory/stock-balance", category: "Inventory & Logistics", icon: "📊", description: "Monitor real-time stock-on-hand, reserved inventory, and reorder alerts." },
  { key: "inv_transfers", name: "Inter-Warehouse Stock Transfers", route: "/inventory/stock-transfers", category: "Inventory & Logistics", icon: "🚚", description: "Issue and approve stock movements between branches and logistics hubs." },
  { key: "inv_adjustments", name: "Stock Count Adjustments", route: "/inventory/stock-adjustments", category: "Inventory & Logistics", icon: "⚖️", description: "Perform physical stock count reconciliation, write-offs, and stock variances." },

  // 4. Finance & Accounting Pages
  { key: "fin_coa", name: "Chart of Accounts (COA)", route: "/finance/chart-of-accounts", category: "Finance & Accounting", icon: "📚", description: "Manage GL account numbers, account types, balances, and parent structures." },
  { key: "fin_journals", name: "General Ledger & Journal Entries", route: "/finance/journal-entries", category: "Finance & Accounting", icon: "🧾", description: "Create, post, and audit double-entry journal vouchers and ledger postings." },
  { key: "fin_taxes", name: "Tax Rates & Rules Setup", route: "/finance/taxes", category: "Finance & Accounting", icon: "📝", description: "Configure VAT/PPN tax rates, inclusive/exclusive calculation, and tax codes." },
  { key: "fin_reports", name: "Financial Statements & Reports", route: "/finance/financial-reports", category: "Finance & Accounting", icon: "📈", description: "View and export Balance Sheet, Income Statement, and Trial Balance reports." },

  // 5. System Administration Pages
  { key: "sys_users", name: "User Accounts & Security Scope", route: "/system/users", category: "System Security", icon: "👤", description: "Manage user identities, assigned RBAC roles, multi-tenant scopes, and login status." },
  { key: "sys_roles", name: "RBAC Roles & Permissions Matrix", route: "/system/roles", category: "System Security", icon: "🛡️", description: "Define security roles, configure per-page action permissions, and access controls." },
  { key: "sys_audit", name: "Security Audit Trail Logs", route: "/system/audit-logs", category: "System Security", icon: "📜", description: "Inspect system audit logs, user activity timestamps, IP addresses, and payload diffs." },
  { key: "sys_settings", name: "Tenant & Portal Site Settings", route: "/system/settings", category: "System Security", icon: "⚙️", description: "Configure system branding, site logos, dark/light themes, and regional settings." },
];

const ACTIONS = [
  { key: "read", label: "Read / View", desc: "View page records, tables, and details" },
  { key: "create", label: "Create", desc: "Create new records on this page" },
  { key: "update", label: "Edit / Modify", desc: "Modify existing records on this page" },
  { key: "delete", label: "Delete / Purge", desc: "Permanently delete or void records" },
  { key: "approve", label: "Approve / Post", desc: "Approve workflow requisitions or post journals" },
  { key: "export", label: "Export Data", desc: "Export page data to CSV, Excel, or PDF" },
];

const DEFAULT_ROLES_MAP: Record<string, RoleData> = {
  "role-1": {
    id: "role-1",
    code: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Unrestricted access across all enterprise pages, multi-tenant settings, and system security controls.",
    usersCount: 3,
    permissionsCount: 120,
    isSystem: true,
    status: "ACTIVE",
    permissions: PAGE_MODULES.reduce((acc, m) => {
      acc[m.key] = ["read", "create", "update", "delete", "approve", "export"];
      return acc;
    }, {} as Record<string, string[]>),
  },
  "role-2": {
    id: "role-2",
    code: "FINANCE_DIR",
    name: "Finance Director",
    description: "Full authority over financial statements, general ledger, tax rules, and purchase order approvals.",
    usersCount: 2,
    permissionsCount: 54,
    status: "ACTIVE",
    permissions: {
      md_companies: ["read", "export"],
      md_branches: ["read"],
      md_warehouses: ["read"],
      md_categories: ["read"],
      md_products: ["read", "export"],
      crm_customers: ["read", "export"],
      crm_suppliers: ["read", "approve", "export"],
      sales_orders: ["read", "export"],
      sales_quotations: ["read"],
      inv_stocks: ["read", "export"],
      inv_transfers: ["read"],
      inv_adjustments: ["read", "approve"],
      fin_coa: ["read", "create", "update", "delete", "export"],
      fin_journals: ["read", "create", "update", "delete", "approve", "export"],
      fin_taxes: ["read", "create", "update", "export"],
      fin_reports: ["read", "create", "export"],
      sys_users: ["read"],
      sys_roles: ["read"],
      sys_audit: ["read", "export"],
      sys_settings: ["read"],
    },
  },
  "role-3": {
    id: "role-3",
    code: "SALES_MGR",
    name: "Sales Manager",
    description: "Authority to manage POS orders, commercial quotations, customer accounts, and price lists.",
    usersCount: 5,
    permissionsCount: 38,
    status: "ACTIVE",
    permissions: {
      md_companies: ["read"],
      md_branches: ["read"],
      md_warehouses: ["read"],
      md_categories: ["read"],
      md_products: ["read", "export"],
      crm_customers: ["read", "create", "update", "export"],
      crm_suppliers: ["read"],
      sales_orders: ["read", "create", "update", "approve", "export"],
      sales_quotations: ["read", "create", "update", "approve", "export"],
      inv_stocks: ["read"],
      inv_transfers: ["read"],
      inv_adjustments: ["read"],
      fin_coa: ["read"],
      fin_journals: ["read"],
      fin_taxes: ["read"],
      fin_reports: ["read"],
      sys_users: ["read"],
      sys_roles: ["read"],
      sys_audit: ["read"],
      sys_settings: ["read"],
    },
  },
  "role-4": {
    id: "role-4",
    code: "WH_SUPERVISOR",
    name: "Warehouse Supervisor",
    description: "Full control over physical stock counts, stock transfers, warehouse allocations, and goods receiving.",
    usersCount: 8,
    permissionsCount: 42,
    status: "ACTIVE",
    permissions: {
      md_companies: ["read"],
      md_branches: ["read"],
      md_warehouses: ["read", "update"],
      md_categories: ["read"],
      md_products: ["read", "update", "export"],
      crm_customers: ["read"],
      crm_suppliers: ["read", "update"],
      sales_orders: ["read"],
      sales_quotations: ["read"],
      inv_stocks: ["read", "create", "update", "approve", "export"],
      inv_transfers: ["read", "create", "update", "approve", "export"],
      inv_adjustments: ["read", "create", "update", "approve", "export"],
      fin_coa: ["read"],
      fin_journals: ["read"],
      fin_taxes: ["read"],
      fin_reports: ["read"],
      sys_users: ["read"],
      sys_roles: ["read"],
      sys_audit: ["read"],
      sys_settings: ["read"],
    },
  },
  "role-5": {
    id: "role-5",
    code: "PROCUREMENT_SPEC",
    name: "Procurement Specialist",
    description: "Manages vendor quotations, purchase requisitions, supplier master records, and receipt verification.",
    usersCount: 4,
    permissionsCount: 30,
    status: "ACTIVE",
    permissions: {
      md_companies: ["read"],
      md_branches: ["read"],
      md_warehouses: ["read"],
      md_categories: ["read"],
      md_products: ["read"],
      crm_customers: ["read"],
      crm_suppliers: ["read", "create", "update", "export"],
      sales_orders: ["read"],
      sales_quotations: ["read"],
      inv_stocks: ["read"],
      inv_transfers: ["read"],
      inv_adjustments: ["read"],
      fin_coa: ["read"],
      fin_journals: ["read"],
      fin_taxes: ["read"],
      fin_reports: ["read"],
      sys_users: ["read"],
      sys_roles: ["read"],
      sys_audit: ["read"],
      sys_settings: ["read"],
    },
  },
};

export default function RolePermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const roleId = (params?.id as string) || "role-1";
  const [role, setRole] = React.useState<RoleData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [activePermissions, setActivePermissions] = React.useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const defaultRole = DEFAULT_ROLES_MAP[roleId] || {
      id: roleId,
      code: "CUSTOM_ROLE",
      name: "Custom Enterprise Role",
      description: "Configured custom security access role.",
      usersCount: 1,
      permissionsCount: 20,
      status: "ACTIVE" as const,
      permissions: PAGE_MODULES.reduce((acc, m) => {
        acc[m.key] = ["read"];
        return acc;
      }, {} as Record<string, string[]>),
    };

    fetchRecordsAction("Role").then((res) => {
      if (!isMounted) return;
      if (res.success && Array.isArray(res.data)) {
        const found = res.data.find((r: any) => r.id === roleId);
        if (found) {
          setRole(found);
        } else {
          setRole(defaultRole);
        }
      } else {
        setRole(defaultRole);
      }
    });

    fetchRolePermissionsAction(roleId).then((res) => {
      if (!isMounted) return;
      if (res.success && res.data && Object.keys(res.data).length > 0) {
        setActivePermissions(res.data);
      } else if (defaultRole.permissions) {
        setActivePermissions(defaultRole.permissions);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [roleId]);

  const togglePermission = (pageKey: string, actionKey: string) => {
    setActivePermissions((prev) => {
      const currentPageActions = prev[pageKey] || [];
      const hasAction = currentPageActions.includes(actionKey);
      const updatedActions = hasAction
        ? currentPageActions.filter((a) => a !== actionKey)
        : [...currentPageActions, actionKey];

      return {
        ...prev,
        [pageKey]: updatedActions,
      };
    });
  };

  const toggleRowAll = (pageKey: string) => {
    setActivePermissions((prev) => {
      const currentPageActions = prev[pageKey] || [];
      const allActionKeys = ACTIONS.map((a) => a.key);
      const isAllSelected = allActionKeys.every((a) => currentPageActions.includes(a));

      return {
        ...prev,
        [pageKey]: isAllSelected ? [] : allActionKeys,
      };
    });
  };

  const applyPreset = (preset: "full" | "readonly" | "clear") => {
    if (preset === "clear") {
      setActivePermissions({});
      return;
    }

    const newPerms: Record<string, string[]> = {};
    PAGE_MODULES.forEach((pageMod) => {
      if (preset === "full") {
        newPerms[pageMod.key] = ACTIONS.map((a) => a.key);
      } else if (preset === "readonly") {
        newPerms[pageMod.key] = ["read"];
      }
    });
    setActivePermissions(newPerms);
  };

  const calculateTotalPermissions = () => {
    let count = 0;
    Object.values(activePermissions).forEach((actions) => {
      count += actions.length;
    });
    return count;
  };

  const handleSave = () => {
    setIsSaving(true);
    updateRolePermissionsAction(roleId, activePermissions).then((res) => {
      setIsSaving(false);
      const totalCount = calculateTotalPermissions();
      if (res.success) {
        showToast({
          type: "success",
          title: "Permission Berhasil Disimpan",
          message: `Pengaturan permission halaman untuk "${role?.name}" telah diperbarui (${totalCount} permission aktif).`,
        });
      } else {
        showToast({
          type: "error",
          title: "Gagal Menyimpan",
          message: res.error || "Gagal memperbarui pengaturan permission halaman.",
        });
      }
    });
  };

  const filteredPageModules = PAGE_MODULES.filter((pageMod) => {
    const matchesSearch =
      pageMod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pageMod.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pageMod.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "ALL" || pageMod.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = ["ALL", "Master Data", "Commercial & CRM", "Inventory & Logistics", "Finance & Accounting", "System Security"];
  const totalActive = calculateTotalPermissions();
  const maxPossible = PAGE_MODULES.length * ACTIONS.length;

  if (!role) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto w-full animate-pulse p-2">
        <div className="h-24 bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800" />
        <div className="h-20 bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800" />
        <div className="h-96 bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/system/roles")}
              className="h-8 rounded-full text-xs gap-1 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Roles
            </Button>
            <span className="text-[#8a94a6] text-xs">/</span>
            <span className="text-[#8a94a6] text-xs">Per-Page Permissions</span>
            <span className="text-[#8a94a6] text-xs">/</span>
            <span className="text-xs font-semibold text-[#0088ff]">{role.code}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2 pt-1">
            <Shield className="h-6 w-6 text-[#0088ff]" />
            Pengaturan Permission Halaman: {role.name}
            {role.isSystem && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600 dark:text-blue-400">
                System Built-in
              </Badge>
            )}
          </h1>
          <p className="text-xs text-[#8a94a6] max-w-3xl">{role.description}</p>
        </div>

        {/* Live Active Counter Badge & Primary Save Button */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-xs text-[#8a94a6]">Total Permission Aktif</div>
            <div className="text-xl font-bold font-mono text-[#0088ff]">{totalActive} / {maxPossible}</div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 py-2.5 gap-2 shadow-lg shadow-blue-500/20 font-semibold"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Menyimpan Permission..." : "Simpan Permission"}
          </Button>
        </div>
      </div>

      {/* Toolbar Controls: Search, Category Filter, Presets */}
      <div className="shrink-0 bg-white dark:bg-[#12161f] p-4 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ERP page name, route URL (/master-data/products)..."
              className="pl-10 rounded-full border-[#e6e9f0] dark:border-slate-800 bg-[#f8f9fc] dark:bg-[#1e293b]/50 text-xs h-9"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <Filter className="h-3.5 w-3.5 text-[#8a94a6] mr-1 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  categoryFilter === cat
                    ? "bg-[#0088ff] text-white shadow-sm"
                    : "bg-[#f8f9fc] dark:bg-[#1e293b]/50 text-slate-600 dark:text-slate-400 border border-[#e6e9f0] dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Presets Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#f0f2f7] dark:border-slate-800/80">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#10b981]" />
            Per-Page Batch Presets:
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyPreset("full")}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" /> Full Admin Access
            </button>
            <button
              type="button"
              onClick={() => applyPreset("readonly")}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> Read-Only Access
            </button>
            <button
              type="button"
              onClick={() => applyPreset("clear")}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear All Page Grants
            </button>
          </div>
        </div>
      </div>

      {/* Main Per-Page Granular Permissions Matrix Grid */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="sticky -top-4 md:-top-6 z-20 bg-[#f8f9fc] dark:bg-[#1e293b] shadow-sm">
              <tr className="text-[#8a94a6] font-semibold border-b border-[#e6e9f0] dark:border-slate-800">
                <th className="py-3 px-5 bg-[#f8f9fc] dark:bg-[#1e293b]">ERP Page / Route Resource</th>
                {ACTIONS.map((act) => (
                  <th key={act.key} className="py-3 px-2 text-center bg-[#f8f9fc] dark:bg-[#1e293b]" title={act.desc}>
                    <div className="font-bold text-[#0f172a] dark:text-slate-200 text-[11px]">{act.label}</div>
                    <div className="text-[9px] font-normal text-slate-400 hidden sm:block">{act.key}</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-center bg-[#f8f9fc] dark:bg-[#1e293b]">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60">
              {filteredPageModules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#8a94a6]">
                    No ERP pages match your search or category filter.
                  </td>
                </tr>
              ) : (
                filteredPageModules.map((pageMod) => {
                  const currentPageActions = activePermissions[pageMod.key] || [];
                  const allActionKeys = ACTIONS.map((a) => a.key);
                  const isAllSelected = allActionKeys.every((a) => currentPageActions.includes(a));

                  return (
                    <tr key={pageMod.key} className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40 transition-colors">
                      {/* ERP Page Details & Route Badge */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-start gap-3">
                          <span className="text-xl p-2 rounded-2xl bg-[#f8f9fc] dark:bg-[#1e293b] border border-[#e6e9f0] dark:border-slate-800 shrink-0">
                            {pageMod.icon}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                              {pageMod.name}
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-mono">
                                {pageMod.category}
                              </Badge>
                            </div>
                            <div className="text-xs text-[#0088ff] font-mono font-medium mt-0.5 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {pageMod.route}
                            </div>
                            <div className="text-xs text-[#8a94a6] leading-snug mt-0.5">{pageMod.description}</div>
                          </div>
                        </div>
                      </td>

                      {/* Action Checkboxes per Page */}
                      {ACTIONS.map((act) => {
                        const isChecked = currentPageActions.includes(act.key);
                        return (
                          <td key={act.key} className="py-3.5 px-2 text-center align-middle">
                            <label className="inline-flex items-center justify-center cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(pageMod.key, act.key)}
                                className="sr-only"
                              />
                              <div
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                  isChecked
                                    ? "bg-[#0088ff] border-[#0088ff] text-white shadow-xs scale-105"
                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#0088ff]"
                                }`}
                              >
                                {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </div>
                            </label>
                          </td>
                        );
                      })}

                      {/* Toggle Entire Page Row */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => toggleRowAll(pageMod.key)}
                          className="inline-flex items-center justify-center text-slate-500 hover:text-[#0088ff] p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                          title={isAllSelected ? "Unselect all page actions" : "Select all page actions"}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="h-4.5 w-4.5 text-[#0088ff]" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-slate-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
}
