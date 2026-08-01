"use client";

import * as React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { AuditLogData } from "@/lib/types/entities";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { ShieldCheck } from "lucide-react";

export default function SystemAuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLogData[]>([]);

  React.useEffect(() => {
    fetchRecordsAction("Audit Log").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data as AuditLogData[]);
      }
    });
  }, []);

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
      accessor: (item) => <span className="font-mono text-xs text-[#8a94a6]">{item.ipAddress || "192.168.1.1"}</span>,
    },
  ];

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

      {/* Audit Logs DataTable */}
      <DataTable
        data={logs}
        columns={columns}
        searchPlaceholder="Cari riwayat audit berdasarkan pengguna, tindakan, atau data..."
      />
    </div>
  );
}
