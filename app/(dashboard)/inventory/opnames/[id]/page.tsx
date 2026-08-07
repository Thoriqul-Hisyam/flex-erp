"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Warehouse,
  FileCheck,
  CheckSquare,
  Ban,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  fetchStockOpnameDetailAction,
  updatePhysicalCountAction,
  completeOpnameAction,
  adjustOpnameAction,
  cancelOpnameAction,
  type StockOpnameRow,
  type StockOpnameItemRow,
} from "@/app/actions/opname-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress (Inputting)", variant: "warning" },
  COMPLETED: { label: "Completed (Ready to Adjust)", variant: "default" },
  ADJUSTED: { label: "Adjusted to Ledger", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "destructive" },
};

export default function StockOpnameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const permission = usePermission("inv_opnames");
  const { showToast } = useToast();

  const [header, setHeader] = React.useState<StockOpnameRow | null>(null);
  const [items, setItems] = React.useState<StockOpnameItemRow[]>([]);
  const [search, setSearch] = React.useState("");
  const [filterMode, setFilterMode] = React.useState<"ALL" | "DISCREPANCY" | "MATCH">("ALL");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isAdjusting, setIsAdjusting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const res = await fetchStockOpnameDetailAction(id);
    if (res.success && res.data) {
      setHeader(res.data.header);
      setItems(res.data.items);
    } else {
      showToast({ type: "error", title: "Error", message: res.message || "Gagal memuat data." });
    }
    setIsLoading(false);
  }, [id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle local physical count change
  const handlePhysicalChange = (itemId: string, val: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const physical = val === "" ? null : Number(val);
        const varianceQty = physical !== null ? physical - item.systemQty : 0;
        const varianceCost = varianceQty * item.unitCost;
        return {
          ...item,
          physicalQty: physical,
          varianceQty,
          varianceCost,
        };
      })
    );
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, notes } : item))
    );
  };

  const handleSaveCounts = async () => {
    if (!id) return;
    setIsSaving(true);
    const res = await updatePhysicalCountAction({
      opnameId: id,
      items: items.map((i) => ({
        id: i.id,
        physicalQty: i.physicalQty,
        notes: i.notes || undefined,
      })),
    });
    setIsSaving(false);

    if (res.success) {
      showToast({ type: "success", title: "Tersimpan", message: res.message });
      loadData();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleMarkComplete = async () => {
    if (!id) return;
    await handleSaveCounts();
    const res = await completeOpnameAction(id);
    if (res.success) {
      showToast({ type: "success", title: "Selesai", message: res.message });
      loadData();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Confirm Post Adjustment State
  const [isConfirmAdjustOpen, setIsConfirmAdjustOpen] = React.useState(false);

  const handlePostAdjustment = async () => {
    if (!id) return;
    setIsConfirmAdjustOpen(false);
    setIsAdjusting(true);
    const res = await adjustOpnameAction(id);
    setIsAdjusting(false);

    if (res.success) {
      showToast({ type: "success", title: "Stok Berhasil Disesuaikan", message: res.message });
      loadData();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.productName.toLowerCase().includes(q) ||
      item.productSku.toLowerCase().includes(q) ||
      (item.notes || "").toLowerCase().includes(q);

    if (filterMode === "DISCREPANCY") return matchesSearch && item.varianceQty !== 0;
    if (filterMode === "MATCH") return matchesSearch && item.varianceQty === 0;
    return matchesSearch;
  });

  const totalSKU = items.length;
  const countedCount = items.filter((i) => i.physicalQty !== null).length;
  const discrepancyCount = items.filter((i) => i.varianceQty !== 0).length;
  const totalVarianceCost = items.reduce((sum, i) => sum + i.varianceCost, 0);

  const isEditable =
    header && (header.status === "DRAFT" || header.status === "IN_PROGRESS" || header.status === "COMPLETED");
  const isAdjustable = header && (header.status === "COMPLETED" || header.status === "IN_PROGRESS");
  const isAdjusted = header && header.status === "ADJUSTED";

  if (isLoading || !header) {
    return (
      <div className="p-12 text-center text-[#8a94a6] text-xs">
        Memuat detail Stock Opname...
      </div>
    );
  }

  const meta = STATUS_META[header.status] || { label: header.status, variant: "secondary" };

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Detail Stock Opname" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/inventory/opnames")}
              className="p-0 h-auto font-normal hover:bg-transparent text-[#0088ff] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1 inline" /> Stock Opname
            </Button>
            <span>/</span>
            <span>{header.opnameNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white font-mono flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-[#0088ff]" />
              {header.opnameNumber}
            </h1>
            <Badge variant={meta.variant} className="rounded-full text-xs px-3 py-0.5">
              {meta.label}
            </Badge>
          </div>
          <p className="text-xs text-[#8a94a6] flex items-center gap-2">
            <Warehouse className="h-3.5 w-3.5" /> Gudang:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {header.warehouseName}
            </span>
            {header.notes && <span>• {header.notes}</span>}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isEditable && (permission.isSuperAdmin || permission.canUpdate) && (
            <Button
              variant="outline"
              onClick={handleSaveCounts}
              disabled={isSaving}
              className="rounded-full gap-2 text-xs"
            >
              <Save className="h-4 w-4 text-[#0088ff]" />
              {isSaving ? "Menyimpan..." : "Simpan Progress"}
            </Button>
          )}

          {isEditable && header.status !== "COMPLETED" && (permission.isSuperAdmin || permission.canUpdate) && (
            <Button
              variant="outline"
              onClick={handleMarkComplete}
              className="rounded-full gap-2 text-xs border-sky-500/30 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <FileCheck className="h-4 w-4" /> Tandai Selesai Hitung
            </Button>
          )}

          {isAdjustable && !isAdjusted && (permission.isSuperAdmin || permission.canApprove) && (
            <Button
              onClick={() => setIsConfirmAdjustOpen(true)}
              disabled={isAdjusting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-emerald-500/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isAdjusting ? "Posting Adjustment..." : "Post Adjustment ke Stok"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Progress Perhitungan</div>
          <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-white mt-1">
            {countedCount} / {totalSKU} <span className="text-xs font-normal text-slate-400">SKU</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Total SKU Selisih</div>
          <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {discrepancyCount} <span className="text-xs font-normal text-slate-400">SKU</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Total Nilai Selisih Net</div>
          <div
            className={`text-lg font-bold font-mono mt-1 ${
              totalVarianceCost > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : totalVarianceCost < 0
                ? "text-red-500"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {totalVarianceCost > 0 ? "+" : ""}
            {formatCurrency(totalVarianceCost)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Dibuat & Disesuaikan</div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">
            By: {header.createdByName || "System"}
          </div>
          {header.adjustedByName && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Adjusted: {header.adjustedByName}
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU, nama produk, atau catatan item..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-full text-xs">
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              filterMode === "ALL"
                ? "bg-white dark:bg-slate-800 text-[#0088ff] shadow-xs"
                : "text-[#8a94a6] hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            onClick={() => setFilterMode("DISCREPANCY")}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              filterMode === "DISCREPANCY"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-[#8a94a6] hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Ada Selisih ({discrepancyCount})
          </button>
          <button
            onClick={() => setFilterMode("MATCH")}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              filterMode === "MATCH"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-[#8a94a6] hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Sesuai ({items.length - discrepancyCount})
          </button>
        </div>
      </div>

      {/* Input / Count Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Produk & SKU</th>
                <th className="p-4 text-center">Satuan</th>
                <th className="p-4 text-right">Stok Buku</th>
                <th className="p-4 text-center w-36">Stok Fisik (Hitung)</th>
                <th className="p-4 text-right">Selisih (Qty)</th>
                <th className="p-4 text-right">Avg Cost</th>
                <th className="p-4 text-right">Nilai Selisih</th>
                <th className="p-4">Catatan Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Tidak ada produk yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const hasDiscrepancy = item.varianceQty !== 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors ${
                        hasDiscrepancy ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-4 text-center text-[#8a94a6] font-mono">{index + 1}</td>
                      <td className="p-4 font-medium">
                        <div className="font-semibold text-[#0f172a] dark:text-white">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-[#8a94a6] font-mono">{item.productSku}</div>
                      </td>
                      <td className="p-4 text-center text-[#8a94a6]">{item.unit}</td>

                      {/* System Qty */}
                      <td className="p-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {formatNumber(item.systemQty)}
                      </td>

                      {/* Physical Qty Input */}
                      <td className="p-4 text-center">
                        {isEditable ? (
                          <Input
                            type="number"
                            step="any"
                            value={item.physicalQty !== null ? item.physicalQty : ""}
                            onChange={(e) => handlePhysicalChange(item.id, e.target.value)}
                            placeholder="Hitung..."
                            className="h-8 w-28 text-center rounded-xl font-mono font-bold text-xs mx-auto focus:ring-2 focus:ring-[#0088ff]"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.physicalQty !== null ? formatNumber(item.physicalQty) : "-"}
                          </span>
                        )}
                      </td>

                      {/* Variance Qty */}
                      <td className="p-4 text-right font-mono font-bold">
                        {item.physicalQty !== null ? (
                          item.varianceQty > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                              +{formatNumber(item.varianceQty)}
                            </span>
                          ) : item.varianceQty < 0 ? (
                            <span className="text-red-500 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-full">
                              {formatNumber(item.varianceQty)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* Avg Cost */}
                      <td className="p-4 text-right font-mono text-[#8a94a6]">
                        {formatCurrency(item.unitCost)}
                      </td>

                      {/* Variance Cost */}
                      <td className="p-4 text-right font-mono font-bold">
                        {item.varianceCost !== 0 ? (
                          <span
                            className={
                              item.varianceCost > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-500"
                            }
                          >
                            {item.varianceCost > 0 ? "+" : ""}
                            {formatCurrency(item.varianceCost)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Rp 0</span>
                        )}
                      </td>

                      {/* Notes Input */}
                      <td className="p-4">
                        {isEditable ? (
                          <Input
                            value={item.notes || ""}
                            onChange={(e) => handleNotesChange(item.id, e.target.value)}
                            placeholder="Alasan selisih..."
                            className="h-8 text-xs rounded-xl"
                          />
                        ) : (
                          <span className="text-[#8a94a6] text-[11px]">
                            {item.notes || "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Post Adjustment Modal */}
      <ConfirmModal
        isOpen={isConfirmAdjustOpen}
        onClose={() => setIsConfirmAdjustOpen(false)}
        onConfirm={handlePostAdjustment}
        title="Posting Adjustment Stok"
        description={`Konfirmasi: Posting penyesuaian stok untuk Opname ${header?.opnameNumber}? Stok gudang dan ledger akan langsung ter-update secara otomatis.`}
        confirmText="Ya, Posting Adjustment"
        variant="primary"
        isLoading={isAdjusting}
      />
    </div>
  );
}
