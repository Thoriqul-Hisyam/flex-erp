"use client";

import * as React from "react";
import { MasterDataPage } from "@/components/crud/master-data-page";
import { UserAccountData } from "@/lib/types/entities";
import { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { fetchRecordsAction } from "@/app/actions/crud-actions";

export default function UsersManagementPage() {
  const [companies, setCompanies] = React.useState<{ label: string; value: string }[]>([]);
  const [branches, setBranches] = React.useState<
    { label: string; value: string; meta: { companyId: string | null } }[]
  >([]);
  const [warehouses, setWarehouses] = React.useState<
    { label: string; value: string; meta: { companyId: string | null; branchId: string | null } }[]
  >([]);
  const [roles, setRoles] = React.useState<{ label: string; value: string }[]>([]);

  const loadOptions = React.useCallback(() => {
    fetchRecordsAction("Company").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCompanies(
          res.data.map((c: any) => ({
            label: c.name || c.code,
            value: c.id,
          }))
        );
      }
    });

    fetchRecordsAction("Branch").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setBranches(
          res.data.map((b: any) => ({
            label: b.name || b.code,
            value: b.id,
            meta: { companyId: b.companyId ?? null },
          }))
        );
      }
    });

    fetchRecordsAction("Warehouse").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setWarehouses(
          res.data.map((w: any) => ({
            label: w.name || w.code,
            value: w.id,
            meta: { companyId: w.companyId ?? null, branchId: w.branchId ?? null },
          }))
        );
      }
    });

    fetchRecordsAction("Role").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setRoles(
          res.data.map((r: any) => ({
            label: `${r.name} (${r.code})`,
            value: r.id,
          }))
        );
      }
    });
  }, []);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const columns: Column<UserAccountData>[] = [
    {
      key: "code",
      header: "ID Pengguna",
      sortable: true,
      accessor: (item) => <span className="font-bold text-[#0f172a] dark:text-white font-mono">{item.code}</span>,
    },
    {
      key: "name",
      header: "Nama Lengkap",
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-[#0f172a] dark:text-white">{item.name}</div>
          <div className="text-[10px] text-[#8a94a6]">{item.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Peran Hak Akses",
      sortable: true,
      accessor: (item) => (
        <Badge variant="outline" className="text-[10px] font-semibold border-blue-500/40 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono">
          {item.role}
        </Badge>
      ),
    },
    {
      key: "companyName",
      header: "Cakupan Akses",
      accessor: (item) => (
        <div className="text-xs text-[#0f172a] dark:text-slate-200 space-y-0.5">
          <div>{item.companyName}</div>
          {item.companyName !== "Semua Perusahaan" && (
            <div className="text-[10px] text-[#8a94a6]">
              {item.branchName}
              {item.branchName !== "Semua Cabang" && item.warehouseName ? ` · ${item.warehouseName}` : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Sesi Terakhir",
      accessor: (item) => <span className="font-mono text-xs text-[#8a94a6]">{item.lastLogin || "Aktif Sesi Ini"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      accessor: (item) => (
        <Badge variant={item.status === "ACTIVE" ? "success" : "destructive"}>
          {item.status}
        </Badge>
      ),
    },
  ];

  const createFields = React.useMemo(() => [
    { name: "code", label: "Kode / ID Pengguna", required: true, disabledOnEdit: true, placeholder: "USR-006" },
    { name: "name", label: "Nama Lengkap", required: true, placeholder: "Rina Wijaya" },
    { name: "email", label: "Alamat Email Kerja", type: "email" as const, required: true, placeholder: "rina.wijaya@lefatech.co.id" },
    {
      name: "password",
      label: "Password (Reset Password)",
      type: "password" as const,
      placeholder: "Wajib diisi saat membuat akun baru. Kosongkan saat edit jika tidak ingin mengubah password.",
    },
    {
      name: "roleId",
      label: "Peran Hak Akses",
      type: "select" as const,
      required: true,
      options: roles.length > 0 ? roles : [
        { label: "Super Administrator (SUPER_ADMIN)", value: "role-1" },
        { label: "Staff Inventaris (INVENTORY_STAFF)", value: "role-2" },
      ],
    },
    {
      name: "companyId",
      label: "Cakupan Perusahaan",
      type: "select" as const,
      required: false,
      clearLabel: "-- Semua Perusahaan (Tidak Dibatasi) --",
      options: companies,
    },
    {
      name: "branchId",
      label: "Cakupan Cabang",
      type: "select" as const,
      required: false,
      clearLabel: "-- Semua Cabang di Perusahaan Ini --",
      dependsOn: ["companyId"],
      options: branches,
    },
    {
      name: "warehouseId",
      label: "Cakupan Gudang",
      type: "select" as const,
      required: false,
      clearLabel: "-- Semua Gudang di Cabang Ini --",
      dependsOn: ["companyId", "branchId"],
      filterOptions: (
        options: { label: string; value: string; meta?: Record<string, string | null> }[],
        formData: Record<string, any>,
      ) => {
        if (!formData.companyId) return [];
        const inCompany = options.filter((o) => o.meta?.companyId === formData.companyId);
        return formData.branchId
          ? inCompany.filter((o) => o.meta?.branchId === formData.branchId || !o.meta?.branchId)
          : inCompany;
      },
      options: warehouses,
    },
  ], [roles, companies, branches, warehouses]);

  return (
    <MasterDataPage<UserAccountData>
      title="Manajemen Pengguna & Pengaturan Akun"
      entityName="Pengguna"
      description="Kelola akun pengguna, penetapan peran hak akses (RBAC), cakupan perusahaan, dan keamanan akun."
      columns={columns}
      createFields={createFields}
    />
  );
}
