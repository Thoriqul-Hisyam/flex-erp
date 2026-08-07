"use client";

import * as React from "react";
import {
  FileSearch,
  Plus,
  Search,
  RefreshCw,
  Trophy,
  Eye,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import {
  fetchRfqsAction,
  fetchRfqDetailAction,
  createRfqAction,
  recordRfqQuoteAction,
  awardRfqAction,
  cancelRfqAction,
} from "@/app/actions/rfq-actions";
import { fetchPurchaseRequestsAction } from "@/app/actions/purchasing-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SENT: { label: "Terkirim", variant: "default" },
  QUOTED: { label: "Ada Penawaran", variant: "warning" },
  AWARDED: { label: "Sudah Award", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "destructive" },
};

export default function PurchaseRfqPage() {
  const permission = usePermission("pur_rfq");
  const { showToast } = useToast();

  const [rfqs, setRfqs] = React.useState<any[]>([]);
  const [approvedPrs, setApprovedPrs] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedPrId, setSelectedPrId] = React.useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Detail/Comparison Modal State
  const [detailRfqId, setDetailRfqId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [quoteDraft, setQuoteDraft] = React.useState<Record<string, Record<string, number>>>({});
  const [isSavingQuote, setIsSavingQuote] = React.useState<string | null>(null);
  const [isAwarding, setIsAwarding] = React.useState<string | null>(null);
  const [awardWarehouseId, setAwardWarehouseId] = React.useState("");
  const [warehouses, setWarehouses] = React.useState<any[]>([]);

  // Cancel Modal State
  const [cancelModal, setCancelModal] = React.useState<{ isOpen: boolean; rfqId: string; rfqNumber: string; isLoading: boolean }>(
    { isOpen: false, rfqId: "", rfqNumber: "", isLoading: false }
  );
  const [cancelReason, setCancelReason] = React.useState("");

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchRfqsAction();
    if (res.success && Array.isArray(res.data)) {
      setRfqs(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadApprovedPrs = React.useCallback(async () => {
    const r = await fetchPurchaseRequestsAction();
    if (r.success && Array.isArray(r.data)) {
      setApprovedPrs(r.data.filter((pr: any) => pr.status === "APPROVED"));
    }
  }, []);

  React.useEffect(() => {
    loadApprovedPrs();
    fetchRecordsAction("Supplier").then((r) => {
      if (r.success && Array.isArray(r.data)) setSuppliers(r.data);
    });
    fetchRecordsAction("Warehouse").then((r) => {
      if (r.success && Array.isArray(r.data)) setWarehouses(r.data);
    });
  }, [loadApprovedPrs]);

  const openDetail = async (rfqId: string) => {
    setDetailRfqId(rfqId);
    setIsDetailLoading(true);
    const res = await fetchRfqDetailAction(rfqId);
    if (res.success) {
      setDetail(res.data);
      const draft: Record<string, Record<string, number>> = {};
      (res.data as any).quotes.forEach((q: any) => {
        draft[q.supplierId] = {};
        q.items.forEach((it: any) => {
          draft[q.supplierId][it.productId] = it.unitPrice;
        });
      });
      setQuoteDraft(draft);
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
    setIsDetailLoading(false);
  };

  const closeDetail = () => {
    setDetailRfqId(null);
    setDetail(null);
    setQuoteDraft({});
    setAwardWarehouseId("");
  };

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Purchase RFQ" roleName={permission.roleName} />;
  }

  const toggleSupplier = (id: string) => {
    setSelectedSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrId) {
      showToast({ type: "error", title: "Pilih PR", message: "Purchase Request wajib dipilih." });
      return;
    }
    if (selectedSupplierIds.length < 2) {
      showToast({ type: "error", title: "Pilih Supplier", message: "Pilih minimal 2 supplier untuk dibandingkan." });
      return;
    }

    setIsCreating(true);
    const res = await createRfqAction({
      prId: selectedPrId,
      supplierIds: selectedSupplierIds,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
    });
    setIsCreating(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsCreateOpen(false);
      setSelectedPrId("");
      setSelectedSupplierIds([]);
      setDueDate("");
      setNotes("");
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleSaveQuote = async (supplierId: string) => {
    if (!detail) return;
    const prices = quoteDraft[supplierId] || {};
    const items = detail.items.map((it: any) => ({
      productId: it.productId,
      unitPrice: prices[it.productId] || 0,
    }));
    if (items.some((i: any) => !i.unitPrice || i.unitPrice <= 0)) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Isi harga penawaran untuk semua item > 0." });
      return;
    }

    setIsSavingQuote(supplierId);
    const res = await recordRfqQuoteAction({ rfqId: detail.id, supplierId, items });
    setIsSavingQuote(null);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      openDetail(detail.id);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleAward = async (supplierId: string) => {
    if (!detail) return;
    if (detail.requestType === "FOR_RESALE" && !awardWarehouseId) {
      showToast({ type: "error", title: "Pilih Gudang", message: "Gudang tujuan wajib dipilih untuk PO barang dagang." });
      return;
    }

    setIsAwarding(supplierId);
    const res = await awardRfqAction({
      rfqId: detail.id,
      supplierId,
      warehouseId: awardWarehouseId || undefined,
    });
    setIsAwarding(null);

    if (res.success) {
      showToast({ type: "success", title: "RFQ Di-award", message: res.message });
      closeDetail();
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleOpenCancelModal = (rfqId: string, rfqNumber: string) => {
    setCancelReason("");
    setCancelModal({ isOpen: true, rfqId, rfqNumber, isLoading: false });
  };

  const handleCancelRfq = async () => {
    setCancelModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelRfqAction(cancelModal.rfqId, cancelReason);
    setCancelModal({ isOpen: false, rfqId: "", rfqNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Berhasil Dibatalkan", message: res.message });
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = rfqs.filter((r) => {
    const q = search.toLowerCase();
    return r.rfqNumber.toLowerCase().includes(q) || r.prNumber.toLowerCase().includes(q);
  });

  const availablePrsForNewRfq = approvedPrs.filter(
    (pr) => !rfqs.some((r) => r.prId === pr.id && r.status !== "CANCELLED")
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Purchasing</span>
            <span>/</span>
            <span>RFQ &amp; Vendor Comparison</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-[#0088ff]" />
            Request for Quotation (RFQ)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Minta penawaran dari beberapa supplier untuk PR yang sudah disetujui, bandingkan harga, lalu award ke pemenang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Buat RFQ Baru
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor RFQ atau PR..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor RFQ</th>
                <th className="p-4">Ref PR</th>
                <th className="p-4 text-center">Supplier</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#8a94a6]">Memuat data RFQ...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#8a94a6]">Belum ada RFQ.</td>
                </tr>
              ) : (
                filtered.map((rfq) => {
                  const meta = STATUS_META[rfq.status] || { label: rfq.status, variant: "secondary" };
                  return (
                    <tr key={rfq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="p-4 font-mono font-semibold text-[#0088ff]">{rfq.rfqNumber}</td>
                      <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400">{rfq.prNumber}</td>
                      <td className="p-4 text-center font-mono font-bold">{rfq.quotedCount}/{rfq.invitedCount} respon</td>
                      <td className="p-4 text-center">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">{meta.label}</Badge>
                      </td>
                      <td className="p-4 text-[#8a94a6]">{rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString("id-ID") : "-"}</td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(rfq.id)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                        >
                          <Eye className="h-3 w-3" /> Detail / Bandingkan
                        </Button>
                        {(rfq.status === "SENT" || rfq.status === "QUOTED") &&
                          (permission.isSuperAdmin || permission.canDelete) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCancelModal(rfq.id, rfq.rfqNumber)}
                              className="rounded-full h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                            >
                              Batalkan
                            </Button>
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

      {/* Create RFQ Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-[#0088ff]" />
                Buat RFQ Baru
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih Purchase Request yang sudah disetujui, lalu pilih minimal 2 supplier untuk diminta penawaran.
              </p>
            </div>

            <form onSubmit={handleCreateRfq} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Purchase Request (Approved) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={selectedPrId}
                  onChange={setSelectedPrId}
                  options={availablePrsForNewRfq.map((pr) => ({
                    value: pr.id,
                    label: `${pr.prNumber} — ${pr.department} (${pr.totalItems} item)`,
                  }))}
                  placeholder="-- Pilih Purchase Request --"
                  searchPlaceholder="Cari nomor PR atau departemen..."
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Diundang <span className="text-red-500">*</span> (min. 2)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#0088ff] font-medium">
                    <input
                      type="checkbox"
                      checked={suppliers.length > 0 && selectedSupplierIds.length === suppliers.length}
                      onChange={() =>
                        setSelectedSupplierIds((prev) =>
                          prev.length === suppliers.length ? [] : suppliers.map((s) => s.id)
                        )
                      }
                      className="rounded"
                    />
                    Pilih Semua
                  </label>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#e6e9f0] dark:border-slate-800 rounded-xl p-2.5">
                  {suppliers.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.includes(s.id)}
                        onChange={() => toggleSupplier(s.id)}
                        className="rounded"
                      />
                      <span>{s.name} ({s.code || "-"})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Batas Waktu Penawaran</label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pilih tanggal" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl h-9" placeholder="Opsional" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full px-4 h-9 text-xs">
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isCreating ? "Mengirim..." : "Kirim RFQ"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Comparison Modal */}
      {detailRfqId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-4xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            {isDetailLoading || !detail ? (
              <div className="p-8 text-center text-[#8a94a6] text-xs">Memuat detail RFQ...</div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-[#0f172a] dark:text-white">
                      RFQ {detail.rfqNumber}
                    </h3>
                    <p className="text-xs text-[#8a94a6]">Ref PR: {detail.prNumber} · Status: {STATUS_META[detail.status]?.label || detail.status}</p>
                  </div>
                  <button onClick={closeDetail} className="text-[#8a94a6] hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-1">
                    Tutup <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Comparison Grid */}
                <div className="overflow-x-auto border border-[#e6e9f0] dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60">
                      <tr>
                        <th className="p-3">Produk</th>
                        <th className="p-3 text-center">Qty</th>
                        {detail.quotes.map((q: any) => (
                          <th key={q.supplierId} className="p-3 text-center min-w-[140px]">
                            {q.supplierName}
                            <div className="text-[9px] font-normal text-[#8a94a6]">{q.status}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800">
                      {detail.items.map((item: any) => (
                        <tr key={item.productId}>
                          <td className="p-3 font-medium">{item.productName}</td>
                          <td className="p-3 text-center font-mono">{item.qtyRequested}</td>
                          {detail.quotes.map((q: any) => {
                            const editable = q.status === "INVITED" || q.status === "SUBMITTED";
                            const rejectedOrAwarded = q.status === "AWARDED" || q.status === "REJECTED";
                            return (
                              <td key={q.supplierId} className="p-3 text-center">
                                {rejectedOrAwarded ? (
                                  <span className="font-mono">{formatCurrency(q.items.find((i: any) => i.productId === item.productId)?.unitPrice || 0)}</span>
                                ) : editable ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={quoteDraft[q.supplierId]?.[item.productId] || ""}
                                    onChange={(e) =>
                                      setQuoteDraft((prev) => ({
                                        ...prev,
                                        [q.supplierId]: {
                                          ...(prev[q.supplierId] || {}),
                                          [item.productId]: Number(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="h-7 text-xs text-center rounded-lg"
                                  />
                                ) : (
                                  "-"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-900/40 font-bold">
                        <td className="p-3" colSpan={2}>Total Penawaran</td>
                        {detail.quotes.map((q: any) => (
                          <td key={q.supplierId} className="p-3 text-center font-mono text-[#0088ff]">
                            {q.totalAmount > 0 ? formatCurrency(q.totalAmount) : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3" colSpan={2}></td>
                        {detail.quotes.map((q: any) => (
                          <td key={q.supplierId} className="p-3 text-center">
                            {(q.status === "INVITED" || q.status === "SUBMITTED") && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isSavingQuote === q.supplierId}
                                onClick={() => handleSaveQuote(q.supplierId)}
                                className="rounded-full h-7 px-2.5 text-[10px] gap-1 mb-1 w-full"
                              >
                                {isSavingQuote === q.supplierId ? "Menyimpan..." : "Simpan Penawaran"}
                              </Button>
                            )}
                            {q.status === "SUBMITTED" && detail.status !== "AWARDED" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isAwarding === q.supplierId}
                                onClick={() => handleAward(q.supplierId)}
                                className="rounded-full h-7 px-2.5 text-[10px] gap-1 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Trophy className="h-3 w-3" /> {isAwarding === q.supplierId ? "Memproses..." : "Award"}
                              </Button>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {detail.requestType === "FOR_RESALE" && detail.status !== "AWARDED" && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Gudang Tujuan (untuk PO yang akan dibuat saat award)
                    </label>
                    <SearchableSelect
                      value={awardWarehouseId}
                      onChange={setAwardWarehouseId}
                      options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                      placeholder="-- Pilih Gudang --"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel RFQ Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancelRfq}
        title="Batalkan RFQ"
        description={`Batalkan RFQ ${cancelModal.rfqNumber}?`}
        confirmText="Ya, Batalkan RFQ"
        variant="danger"
        isLoading={cancelModal.isLoading}
        requireReason
        reasonLabel="Alasan Pembatalan"
        reasonValue={cancelReason}
        onReasonChange={setCancelReason}
      />
    </div>
  );
}
