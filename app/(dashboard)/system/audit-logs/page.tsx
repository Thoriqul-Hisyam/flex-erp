"use client";

import * as React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { AuditLogData } from "@/lib/types/entities";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { ShieldCheck } from "lucide-react";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";

export default function SystemAuditLogsPage() {
  const permission = usePermission("sys_audit");
  const [logs, setLogs] = React.useState<AuditLogData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [filterUser, setFilterUser] = React.useState("ALL");
  const [filterEntity, setFilterEntity] = React.useState("ALL");
  const [filterAction, setFilterAction] = React.useState("ALL");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  React.useEffect(() => {
    setIsLoading(true);
    fetchRecordsAction("Audit Log").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data as AuditLogData[]);
      }
      setIsLoading(false);
    });
  }, []);

  const userOptions = React.useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.user))).sort();
    return [{ value: "ALL", label: "Semua Pengguna" }, ...unique.map((u) => ({ value: u, label: u }))];
  }, [logs]);

  const entityOptions = React.useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.entity))).sort();
    return [{ value: "ALL", label: "Semua Entitas" }, ...unique.map((e) => ({ value: e, label: e }))];
  }, [logs]);

  const actionOptions = [
    { value: "ALL", label: "Semua Aksi" },
    { value: "CREATE", label: "CREATE" },
    { value: "UPDATE", label: "UPDATE" },
    { value: "DELETE", label: "DELETE" },
    { value: "APPROVE", label: "APPROVE" },
    { value: "POST", label: "POST" },
    { value: "CANCEL", label: "CANCEL" },
    { value: "LOGIN", label: "LOGIN" },
    { value: "LOGIN_FAILED", label: "LOGIN_FAILED" },
  ];

  const filtered = logs.filter((l) => {
    if (filterUser !== "ALL" && l.user !== filterUser) return false;
    if (filterEntity !== "ALL" && l.entity !== filterEntity) return false;
    if (filterAction !== "ALL" && l.action !== filterAction) return false;
    const created = (l as any).createdAt ? new Date((l as any).createdAt) : null;
    if (dateFrom && created && created < new Date(dateFrom)) return false;
    if (dateTo && created && created > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const columns: Column<AuditLogData>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortable: true,
      accessor: (item) => <span className="font-mono text-xs text-[#8a94a6]">{item.timestamp}</span>,
    },
    {
      key: "user",
      header: "Actor / User",
      sortable: true,
      accessor: (item) => <span className="font-semibold text-[#0f172a] dark:text-white">{item.user}</span>,
    },
    {
      key: "action",
      header: "Action",
      align: "center",
      accessor: (item) => (
        <Badge
          variant={
            item.action === "APPROVE" || item.action === "POST"
              ? "success"
              : item.action === "CREATE"
              ? "default"
              : item.action === "DELETE"
              ? "destructive"
              : "secondary"
          }
          className="text-[10px] font-mono"
        >
          {item.action}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Target Entity",
      sortable: true,
      accessor: (item) => (
        <div>
          <span className="font-semibold text-[#0f172a] dark:text-white">{item.entity}</span>
          <span className="ml-2 font-mono text-[10px] text-[#8a94a6]">({item.entityId})</span>
        </div>
      ),
    },
    {
      key: "details",
      header: "Audit Log Details",
      accessor: (item) => <span className="text-xs text-slate-600 dark:text-slate-300">{item.details}</span>,
    },
    {
      key: "ipAddress",
      header: "IP Address",
      align: "right",
      accessor: (item) => <span className="font-mono text-xs text-[#8a94a6]">{item.ipAddress || "-"}</span>,
    },
  ];

  if (permission.isLoading || isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!permission.isSuperAdmin && !permission.canRead) {
    return <UnauthorizedCard pageName="System Audit Logs" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-[#e6e9f0] dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-[#10b981]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              Log Riwayat Audit Sistem
            </h1>
            <Badge variant="success" className="font-mono text-xs">
              Pencatatan Permanen
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[#8a94a6]">
            Riwayat aktivitas sistem yang mencatat setiap tindakan Penambahan, Perubahan, Penghapusan, dan Persetujuan data secara permanen.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Pengguna</label>
          <SearchableSelect value={filterUser} onChange={setFilterUser} options={userOptions} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Entitas</label>
          <SearchableSelect value={filterEntity} onChange={setFilterEntity} options={entityOptions} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Aksi</label>
          <SearchableSelect value={filterAction} onChange={setFilterAction} options={actionOptions} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Dari Tanggal</label>
          <DatePicker value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Sampai Tanggal</label>
          <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
        </div>
      </div>

      {/* Audit Logs DataTable */}
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Cari riwayat audit berdasarkan pengguna, tindakan, atau data..."
      />
    </div>
  );
}
