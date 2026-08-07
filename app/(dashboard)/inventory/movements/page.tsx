"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  ClipboardList,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchStockMovementsAction } from "@/app/actions/inventory-actions";
import { formatNumber, exportToCsv } from "@/lib/utils";

interface Movement {
  id: string;
  type: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseName?: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  qty: number;
  unitCost: number;
  beforeQty: number;
  afterQty: number;
  batchNo?: string;
  refType?: string;
  refId?: string;
  note?: string;
  createdAt: string;
}

const TYPE_META: Record<string, { label: string; variant: "success" | "destructive" | "default" | "secondary" | "warning"; dir: number }> = {
  STOCK_IN: { label: "Stock In", variant: "success", dir: 1 },
  STOCK_OUT: { label: "Stock Out", variant: "destructive", dir: -1 },
  TRANSFER_IN: { label: "Transfer In", variant: "warning", dir: 1 },
  TRANSFER_OUT: { label: "Transfer Out", variant: "warning", dir: -1 },
  ADJUSTMENT_ADD: { label: "Adj +", variant: "success", dir: 1 },
  ADJUSTMENT_SUBTRACT: { label: "Adj −", variant: "destructive", dir: -1 },
};

export default function StockMovementsPage() {
  const permission = usePermission("inv_movements");
  const [movements, setMovements] = React.useState<Movement[]>([]);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchStockMovementsAction();
    if (res.success && Array.isArray(res.data)) {
      setMovements(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Stock Movements" roleName={permission.roleName} />;
  }

  const filtered = movements.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.productName.toLowerCase().includes(q) ||
      m.productSku.toLowerCase().includes(q) ||
      (m.refId || "").toLowerCase().includes(q);
    const matchesType = typeFilter === "ALL" || m.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Inventory</span>
            <span>/</span>
            <span>Stock Movements</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#0088ff]" />
            Stock Movement Ledger
          </h1>
          <p className="text-xs text-[#8a94a6]">Immutable audit trail of every stock in, stock out, transfer, and adjustment.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() =>
              exportToCsv("stock_movements", filtered, [
                { key: "type", header: "Type" },
                { key: "productName", header: "Product" },
                { key: "productSku", header: "SKU" },
                { key: "warehouseName", header: "Warehouse" },
                { key: "fromWarehouseName", header: "From Warehouse" },
                { key: "toWarehouseName", header: "To Warehouse" },
                { key: "qty", header: "Qty" },
                { key: "beforeQty", header: "Before Qty" },
                { key: "afterQty", header: "After Qty" },
                { key: "batchNo", header: "Batch" },
                { key: "refType", header: "Reference Type" },
                { key: "refId", header: "Reference ID" },
                { key: "note", header: "Note" },
                { key: "createdAt", header: "Timestamp" },
              ])
            }
            className="rounded-full gap-2"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={load} className="rounded-full gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, SKU, or reference..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
        <SearchableSelect
          value={typeFilter}
          onChange={setTypeFilter}
          className="w-48"
          options={[
            { value: "ALL", label: "All Types" },
            ...Object.keys(TYPE_META).map((t) => ({ value: t, label: TYPE_META[t].label })),
          ]}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fc] dark:bg-[#1e293b] text-[#8a94a6]">
              <tr className="border-b border-[#e6e9f0] dark:border-slate-800">
                <th className="py-3 px-5 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-right">Qty</th>
                <th className="py-3 px-4 font-semibold text-right">Before → After</th>
                <th className="py-3 px-4 font-semibold">Batch</th>
                <th className="py-3 px-4 font-semibold">Reference</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center text-[#8a94a6] animate-pulse">Loading movements...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-[#8a94a6]">No movements found.</td></tr>
              ) : (
                filtered.map((m) => {
                  const meta = TYPE_META[m.type] || { label: m.type, variant: "secondary" as const, dir: 0 };
                  return (
                    <tr key={m.id} className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40">
                      <td className="py-3.5 px-5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0f172a] dark:text-slate-200">{m.productName}</div>
                        <div className="text-[10px] text-[#0088ff] font-mono">{m.productSku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {m.type.startsWith("TRANSFER") ? (
                          <div>
                            <div>{m.fromWarehouseName || "-"} → {m.toWarehouseName || "-"}</div>
                          </div>
                        ) : (
                          m.warehouseName || "-"
                        )}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold font-mono-num ${meta.dir < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {meta.dir < 0 ? "−" : "+"}{formatNumber(m.qty)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">{formatNumber(m.beforeQty)} → {formatNumber(m.afterQty)}</td>
                      <td className="py-3.5 px-4 text-[#8a94a6] font-mono">{m.batchNo || "-"}</td>
                      <td className="py-3.5 px-4 text-[#8a94a6]">
                        {m.refType || "-"}
                        {m.note && <div className="text-[10px] text-slate-400">{m.note}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </td>
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
