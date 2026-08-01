"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { RoleData } from "@/lib/types/entities";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_ROLES: RoleData[] = [
  {
    id: "role-1",
    code: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Unrestricted access across all enterprise modules, multi-tenant settings, and system security controls.",
    usersCount: 3,
    permissionsCount: 42,
    isSystem: true,
    status: "ACTIVE",
  },
  {
    id: "role-2",
    code: "FINANCE_DIR",
    name: "Finance Director",
    description: "Full authority over general ledger, financial postings, tax reports, and purchase order approvals.",
    usersCount: 2,
    permissionsCount: 26,
    status: "ACTIVE",
  },
  {
    id: "role-3",
    code: "SALES_MGR",
    name: "Sales Manager",
    description: "Authority to manage POS orders, customer accounts, price lists, and commercial export reports.",
    usersCount: 5,
    permissionsCount: 20,
    status: "ACTIVE",
  },
  {
    id: "role-4",
    code: "WH_SUPERVISOR",
    name: "Warehouse Supervisor",
    description: "Full control over physical inventory counts, stock transfers, warehouse allocations, and goods receiving.",
    usersCount: 8,
    permissionsCount: 20,
    status: "ACTIVE",
  },
  {
    id: "role-5",
    code: "PROCUREMENT_SPEC",
    name: "Procurement Specialist",
    description: "Manages vendor quotations, purchase requisitions, supplier master records, and receipt verification.",
    usersCount: 4,
    permissionsCount: 16,
    status: "ACTIVE",
  },
];

export default function RolesPermissionsPage() {
  const router = useRouter();

  const handleNavigateToPermissions = (roleId: string) => {
    router.push(`/system/roles/${roleId}/permissions`);
  };

  const columns: Column<RoleData>[] = [
    {
      key: "code",
      header: "Role Code",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Role Name & Scope Description",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-slate-200 flex items-center gap-2">
            {item.name}
            {item.isSystem && (
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400">
                System Built-in
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{item.description}</div>
        </div>
      ),
    },
    {
      key: "usersCount",
      header: "Assigned Users",
      align: "center",
      accessor: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.usersCount || 0} users
        </Badge>
      ),
    },
    {
      key: "permissionsCount",
      header: "Active Permissions",
      align: "center",
      accessor: (item) => (
        <button
          onClick={() => handleNavigateToPermissions(item.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" />
          {item.permissionsCount || 0} active
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      accessor: (item) => (
        <Badge variant={item.status === "ACTIVE" ? "success" : "secondary"}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "matrixControl",
      header: "Permission Control",
      align: "center",
      accessor: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleNavigateToPermissions(item.id)}
          className="h-7 text-xs rounded-full border-[#0088ff]/40 text-[#0088ff] hover:bg-[#f0f7ff] dark:hover:bg-blue-950/50 gap-1.5 cursor-pointer font-medium"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-[#0088ff]" />
          Configure Matrix <ArrowRight className="h-3 w-3" />
        </Button>
      ),
    },
  ];

  return (
    <MasterDataPage<RoleData>
      title="Manajemen Peran & Hak Akses Pengguna"
      entityName="Peran Hak Akses"
      description="Atur peran pengguna dan matriks hak akses secara terperinci untuk seluruh modul sistem."
      columns={columns}
      initialData={DEFAULT_ROLES}
      createFields={[
        { name: "code", label: "Kode Peran (contoh: STAF_AKUNTANSI)", required: true, placeholder: "STAF_AKUNTANSI" },
        { name: "name", label: "Nama Peran Hak Akses", required: true, placeholder: "Staf Akuntansi" },
        { name: "description", label: "Deskripsi & Cakupan Tugas Peran", type: "textarea", required: true, placeholder: "Akses untuk membuat jurnal umum dan melihat laporan buku besar." },
      ]}
    />
  );
}
