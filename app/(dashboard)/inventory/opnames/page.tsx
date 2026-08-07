"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Plus,
  Search,
  RefreshCw,
  Warehouse,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Ban,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchStockOpnamesAction,
  createStockOpnameAction,
  cancelOpnameAction,
  type StockOpnameRow,
} from "@/app/actions/opname-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  COMPLETED: { label: "Ready to Adjust", variant: "default" },
  ADJUSTED: { label: "Adjusted", variant: "success" },
  CANCELLED: { label: "Batal", variant: "destructive" },
};

export default function StockOpnamesListPage() {
  const permission = usePermission("inv_opnames");
  const { showToast } = useToast();
  const router = useRouter();
  const [opnames, setOpnames] = React.useState<StockOpnameRow[]>([]);
  const [warehouses, setWarehouses] = React.useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = React.useState("");
  const [warehouseFilter, setWarehouseFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchStockOpnamesAction(warehouseFilter);
    if (res.success && Array.isArray(res.data)) {
      setOpnames(res.data);
    }
    setIsLoading(false);
  }, [warehouseFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Warehouse").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setWarehouses(r.data.map((w: any) => ({ id: w.id, name: w.name || w.code })));
      }
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      showToast({ type: "error", title: "Pilih Gudang", message: "Gudang wajib dipilih." });
      return;
    }
    setIsCreating(true);
    const res = await createStockOpnameAction({
      warehouseId: selectedWarehouseId,
      notes,
    });
    setIsCreating(false);

    if (res.success && res.data) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      setSelectedWarehouseId("");
      setNotes("");
      router.push(`/inventory/opnames/${res.data.id}`);
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message || "Gagal membuat opname." });
    }
  };

  // Confirm Cancel State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    opnameId: string;
    opnameNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, opnameId: "", opnameNumber: "", isLoading: false });

  const handleOpenCancelModal = (id: string, number: string) => {
    setConfirmModal({ isOpen: true, opnameId: id, opnameNumber: number, isLoading: false });
  };

  const handleCancel = async () => {
    setConfirmModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelOpnameAction(confirmModal.opnameId);
    setConfirmModal({ isOpen: false, opnameId: "", opnameNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Dibatalkan", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = opnames.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      o.opnameNumber.toLowerCase().includes(q) ||
      o.warehouseName.toLowerCase().includes(q) ||
      (o.notes || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSessions = opnames.length;
  const totalInProgress = opnames.filter((o) => o.status === "IN_PROGRESS" || o.status === "DRAFT").length;
  const totalCompleted = opnames.filter((o) => o.status === "COMPLETED").length;
  const totalAdjusted = opnames.filter((o) => o.status === "ADJUSTED").length;

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Stock Opname" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Inventory</span>
            <span>/</span>
            <span>Stock Opname</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[#0088ff]" />
            Stock Opname (Physical Count)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Sesi audit fisik stok gudang dan rekonsiliasi selisih otomatis ke ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Sesi Opname Baru
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#0088ff]">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-[#8a94a6]">Total Sesi</div>
            <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-white">
              {totalSessions}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-[#8a94a6]">Dalam Proses</div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
              {totalInProgress}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-500">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-[#8a94a6]">Siap Adjust</div>
            <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400">
              {totalCompleted}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-[#8a94a6]">Sudah Adjust</div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalAdjusted}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor opname, gudang, atau catatan..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchableSelect
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            className="w-48"
            options={[
              { value: "ALL", label: "Semua Gudang" },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />

          <SearchableSelect
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-48"
            options={[
              { value: "ALL", label: "Semua Status" },
              { value: "DRAFT", label: "Draft" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Ready to Adjust" },
              { value: "ADJUSTED", label: "Adjusted" },
              { value: "CANCELLED", label: "Batal" },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor Opname</th>
                <th className="p-4">Gudang</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total SKU</th>
                <th className="p-4 text-right">Ada Selisih</th>
                <th className="p-4 text-right">Nilai Selisih</th>
                <th className="p-4">Dibuat Oleh</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Stock Opname...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Belum ada sesi Stock Opname. Klik &quot;Sesi Opname Baru&quot; untuk membuat.
                  </td>
                </tr>
              ) : (
                filtered.map((op) => {
                  const meta = STATUS_META[op.status] || {
                    label: op.status,
                    variant: "secondary",
                  };
                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4 font-mono font-semibold text-[#0088ff]">
                        {op.opnameNumber}
                      </td>
                      <td className="p-4 font-medium flex items-center gap-1.5">
                        <Warehouse className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {op.warehouseName}
                      </td>
                      <td className="p-4">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        {op.totalItems}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        {op.totalDiscrepancies > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full text-[11px]">
                            {op.totalDiscrepancies} SKU
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">0</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold">
                        {op.totalVarianceCost !== 0 ? (
                          <span
                            className={
                              op.totalVarianceCost > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-500"
                            }
                          >
                            {op.totalVarianceCost > 0 ? "+" : ""}
                            {formatCurrency(op.totalVarianceCost)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Rp 0</span>
                        )}
                      </td>
                      <td className="p-4 text-[#8a94a6]">{op.createdByName}</td>
                      <td className="p-4 text-[#8a94a6]">
                        {op.createdAt ? new Date(op.createdAt).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/inventory/opnames/${op.id}`)}
                            className="rounded-full h-7 px-3 text-xs gap-1"
                          >
                            Detail <ArrowRight className="h-3 w-3" />
                          </Button>
                          {op.status !== "ADJUSTED" && op.status !== "CANCELLED" && (permission.isSuperAdmin || permission.canDelete) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCancelModal(op.id, op.opnameNumber)}
                              className="rounded-full h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Batalkan Sesi"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Sesi Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#0088ff]" />
                Buat Sesi Stock Opname Baru
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Sistem akan otomatis mengambil snapshot seluruh produk & stok buku di gudang terpilih.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Gudang Target Opname <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  placeholder="-- Pilih Gudang --"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan / Keterangan Sesi
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Opname Rutin Akhir Bulan Agustus 2026"
                  className="rounded-xl h-10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-5 h-9"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold shadow-md shadow-blue-500/20"
                >
                  {isCreating ? "Membuat..." : "Mulai Opname"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Cancel Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancel}
        title="Batalkan Stock Opname"
        description={`Batalkan sesi Stock Opname ${confirmModal.opnameNumber}? Sesi opname ini tidak akan diproses ke jurnal stok.`}
        confirmText="Ya, Batalkan Sesi"
        variant="danger"
        isLoading={confirmModal.isLoading}
      />
    </div>
  );
}
