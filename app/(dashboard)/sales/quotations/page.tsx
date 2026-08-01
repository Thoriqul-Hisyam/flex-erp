"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  Package,
  Trash2,
  Edit3,
  Send,
  Users,
  Printer,
} from "lucide-react";
import { DocumentPrintModal } from "@/components/ui/document-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import {
  fetchSalesQuotationsAction,
  createSalesQuotationAction,
  acceptSalesQuotationAction,
} from "@/app/actions/sales-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SENT: { label: "Sent (Terkirim)", variant: "warning" },
  ACCEPTED: { label: "Accepted (Disetujui)", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function SalesQuotationsPage() {
  const permission = usePermission("sal_quotations");
  const { showToast } = useToast();

  const [quotations, setQuotations] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [taxRate, setTaxRate] = React.useState(11);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{ productId: string; qtyRequested: number; unitPrice: number; discount: number }>
  >([{ productId: "", qtyRequested: 1, unitPrice: 0, discount: 0 }]);
  const [isCreating, setIsCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchSalesQuotationsAction();
    if (res.success && Array.isArray(res.data)) {
      setQuotations(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Customer").then((r) => {
      if (r.success && Array.isArray(r.data)) setCustomers(r.data);
    });
    fetchRecordsAction("Branch").then((r) => {
      if (r.success && Array.isArray(r.data)) setBranches(r.data);
    });
    fetchRecordsAction("Product").then((r) => {
      if (r.success && Array.isArray(r.data)) setProducts(r.data);
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Sales Quotations" roleName={permission.roleName} />;
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: "", qtyRequested: 1, unitPrice: 0, discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "productId") {
          const prod = products.find((p) => p.id === value);
          if (prod) updated.unitPrice = Number(prod.price || prod.sellingPrice || 0);
        }
        return updated;
      })
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Pelanggan / Customer wajib dipilih." });
      return;
    }
    const validItems = items.filter((i) => i.productId && i.qtyRequested > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Pilih minimal 1 produk & qty > 0." });
      return;
    }

    setIsCreating(true);
    const res = await createSalesQuotationAction({
      customerId,
      branchId: branchId || undefined,
      validUntil: validUntil || undefined,
      taxRate,
      notes,
      items: validItems,
    });
    setIsCreating(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      setCustomerId("");
      setBranchId("");
      setNotes("");
      setItems([{ productId: "", qtyRequested: 1, unitPrice: 0, discount: 0 }]);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    sqId: string;
    sqNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, sqId: "", sqNumber: "", isLoading: false });

  const handleOpenAcceptModal = (id: string, num: string) => {
    setConfirmModal({ isOpen: true, sqId: id, sqNumber: num, isLoading: false });
  };

  const handleConfirmAccept = async () => {
    setConfirmModal((prev) => ({ ...prev, isLoading: true }));
    const res = await acceptSalesQuotationAction(confirmModal.sqId);
    setConfirmModal({ isOpen: false, sqId: "", sqNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Disetujui", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = quotations.filter((q) => {
    const searchLow = search.toLowerCase();
    const matchesSearch =
      q.sqNumber.toLowerCase().includes(searchLow) ||
      q.customerName.toLowerCase().includes(searchLow) ||
      (q.notes || "").toLowerCase().includes(searchLow);
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Sales</span>
            <span>/</span>
            <span>Sales Quotations</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#0088ff]" />
            Penawaran Harga (Sales Quotations)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Kelola penawaran harga resmi kepada pelanggan sebelum diterbitkan menjadi Sales Order (SO).
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
              <Plus className="h-4 w-4" /> Buat Penawaran Baru
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor SQ, pelanggan, atau catatan..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-full border border-[#e6e9f0] dark:border-slate-800 px-4 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent (Terkirim)</option>
          <option value="ACCEPTED">Accepted (Disetujui)</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor SQ</th>
                <th className="p-4">Pelanggan / Customer</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total Nilai</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Penawaran Harga...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada penawaran harga.
                  </td>
                </tr>
              ) : (
                filtered.map((sq) => {
                  const meta = STATUS_META[sq.status] || { label: sq.status, variant: "secondary" };
                  return (
                    <tr
                      key={sq.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-mono font-semibold text-[#0088ff]">{sq.sqNumber}</div>
                        {sq.soNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                            Ref SO: {sq.soNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {sq.customerName}
                      </td>
                      <td className="p-4 font-medium">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-purple-500" />
                          {sq.branchName}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(sq.totalAmount)}
                      </td>
                      <td className="p-4 text-[#8a94a6]">
                        {sq.createdAt ? new Date(sq.createdAt).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintDoc(sq)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                        >
                          <Printer className="h-3 w-3" /> Cetak / Detail
                        </Button>

                        {sq.status === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenAcceptModal(sq.id, sq.sqNumber)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Setujui Penawaran
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

      {/* Modal Buat SQ Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0088ff]" />
                Buat Sales Quotation Baru
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Isi rincian penawaran harga kepada pelanggan.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Pelanggan / Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                    required
                  >
                    <option value="">-- Pilih Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || "-"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cabang Penanggung Jawab
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Item Produk Penawaran
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs rounded-full gap-1 border-slate-200 dark:border-slate-800"
                  >
                    <Plus className="h-3 w-3" /> Tambah Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800"
                    >
                      <div className="col-span-5">
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                          className="w-full h-8 rounded-lg border border-[#e6e9f0] dark:border-slate-800 px-2 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                          required
                        >
                          <option value="">-- Pilih Produk --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku || "-"})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.qtyRequested}
                          onChange={(e) =>
                            handleItemChange(index, "qtyRequested", parseFloat(e.target.value) || 1)
                          }
                          placeholder="Qty"
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-4">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          placeholder="Harga Satuan"
                          className="h-8 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan Penawaran
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ketentuan pembayaran, garansi, estimasi kirim..."
                  className="rounded-xl h-9"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-4 h-9 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isCreating ? "Menyimpan..." : "Simpan Penawaran"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Accept Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAccept}
        title="Setujui Penawaran Harga"
        description={`Setujui Sales Quotation ${confirmModal.sqNumber}? Penawaran ini siap ditarik menjadi Sales Order (SO).`}
        confirmText="Ya, Setujui Penawaran"
        variant="success"
        isLoading={confirmModal.isLoading}
      />
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="SQ"
          documentNumber={printDoc.sqNumber}
          date={printDoc.createdAt ? new Date(printDoc.createdAt).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.customerName || "Pelanggan Utama"}
          notes={printDoc.notes}
          status={printDoc.status}
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName: i.productName || "Produk",
            productSku: i.productSku || "",
            qty: i.qtyRequested || 1,
            unitPrice: i.unitPrice || 0,
            subtotal: (i.qtyRequested || 1) * (i.unitPrice || 0),
          })) : []}
          subtotalAmount={printDoc.totalAmount ? printDoc.totalAmount / 1.11 : 0}
          taxAmount={printDoc.totalAmount ? printDoc.totalAmount - (printDoc.totalAmount / 1.11) : 0}
          totalAmount={printDoc.totalAmount || 0}
        />
      )}
    </div>
  );
}
