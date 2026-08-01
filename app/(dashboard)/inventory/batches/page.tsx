"use client";

import * as React from "react";
import {
  Layers,
  Search,
  RefreshCw,
  PackageX,
  CalendarClock,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { fetchBatchesAction } from "@/app/actions/inventory-actions";
import { formatNumber } from "@/lib/utils";

interface Batch {
  id: string;
  warehouseName: string;
  productName: string;
  productSku: string;
  batchNo: string;
  expiryDate?: string;
  qtyIn: number;
  qtyOut: number;
  qtyRemaining: number;
  costPrice: number;
  status: string;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export default function InventoryBatchesPage() {
  const permission = usePermission("inv_batches");
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchBatchesAction();
    if (res.success && Array.isArray(res.data)) {
      setBatches(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (
    !permission.isSuperAdmin &&
    !permission.canRead &&
    !permission.isLoading
  ) {
    return <UnauthorizedCard pageName="Batch & Expiry" roleName={permission.roleName} />;
  }

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      b.productName.toLowerCase().includes(q) ||
      b.batchNo.toLowerCase().includes(q) ||
      b.productSku.toLowerCase().includes(q);
    let matchesStatus = true;
    if (statusFilter === "EXPIRED") matchesStatus = b.isExpired;
    else if (statusFilter === "EXPIRING") matchesStatus = b.isExpiringSoon;
    else if (statusFilter === "OPEN")
      matchesStatus = !b.isExpired && !b.isExpiringSoon;
    return matchesSearch && matchesStatus;
  });

  const expiredCount = batches.filter((b) => b.isExpired).length;
  const expiringSoonCount = batches.filter((b) => b.isExpiringSoon).length;
  const openCount = batches.filter(
    (b) => !b.isExpired && !b.isExpiringSoon,
  ).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Inventory</span>
            <span>/</span>
            <span>Batch & Expiry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#0088ff]" />
            Batch & Expiry Tracking
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Monitor product batches, expiry dates, and expiring-soon alerts.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={load}
          className="rounded-full gap-2 shrink-0"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            icon: Layers,
            label: "Total Batches",
            value: formatNumber(batches.length),
            tone: "text-[#0088ff]",
          },
          {
            icon: CheckCircle2,
            label: "Open / Valid",
            value: formatNumber(openCount),
            tone: "text-emerald-600",
          },
          {
            icon: CalendarClock,
            label: "Expiring Soon (30d)",
            value: formatNumber(expiringSoonCount),
            tone: "text-amber-600",
          },
          {
            icon: AlertOctagon,
            label: "Expired",
            value: formatNumber(expiredCount),
            tone: "text-rose-600",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs"
          >
            <kpi.icon className={`h-5 w-5 ${kpi.tone}`} />
            <div className="mt-2 text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">
              {kpi.value}
            </div>
            <div className="text-[11px] text-[#8a94a6] mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch number, product, or SKU..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-full border border-[#e6e9f0] dark:border-slate-800 px-4 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">All Status</option>
          <option value="OPEN">Open / Valid</option>
          <option value="EXPIRING">Expiring Soon</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fc] dark:bg-[#1e293b] text-[#8a94a6]">
              <tr className="border-b border-[#e6e9f0] dark:border-slate-800">
                <th className="py-3 px-5 font-semibold">Batch No</th>
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-right">In</th>
                <th className="py-3 px-4 font-semibold text-right">Out</th>
                <th className="py-3 px-4 font-semibold text-right">
                  Remaining
                </th>
                <th className="py-3 px-4 font-semibold">Expiry</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-16 text-center text-[#8a94a6] animate-pulse"
                  >
                    Loading batches...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#8a94a6]">
                    <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" /> No
                    batches found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const statusBadge = b.isExpired ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : b.isExpiringSoon ? (
                    <Badge variant="warning">Expiring Soon</Badge>
                  ) : (
                    <Badge variant="success">Open</Badge>
                  );
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40"
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-bold font-mono text-[#0f172a] dark:text-slate-200">
                          {b.batchNo}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0f172a] dark:text-slate-200">
                          {b.productName}
                        </div>
                        <div className="text-[10px] text-[#0088ff] font-mono">
                          {b.productSku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {b.warehouseName}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {formatNumber(b.qtyIn)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {formatNumber(b.qtyOut)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold font-mono-num text-[#0f172a] dark:text-white">
                        {formatNumber(b.qtyRemaining)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {b.expiryDate
                          ? new Date(b.expiryDate).toLocaleDateString("id-ID", {
                              dateStyle: "medium",
                            })
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center">{statusBadge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
