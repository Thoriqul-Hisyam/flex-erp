"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  Plus,
  Search,
  RefreshCw,
  Truck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Lock,
  History,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import {
  fetchSupplierInvoicesAction,
  recordSupplierPaymentAction,
  cancelSupplierPaymentAction,
  cancelSupplierInvoiceAction,
  finalizeSupplierInvoiceAction,
} from "@/app/actions/purchasing-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }
> = {
  UNPAID: { label: "Belum Lunas (Unpaid)", variant: "destructive" },
  PARTIALLY_PAID: { label: "Sebagian (Partially Paid)", variant: "warning" },
  PAID: { label: "Lunas (Paid)", variant: "success" },
  CANCELLED: { label: "Batal", variant: "secondary" },
};

export default function SupplierInvoicesPage() {
  const permission = usePermission("pur_invoices");
  const { showToast } = useToast();

  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedInv, setSelectedInv] = React.useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<number>(0);
  const [paymentMethod, setPaymentMethod] = React.useState("TRANSFER");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);

  // Payment History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [historyInv, setHistoryInv] = React.useState<any | null>(null);

  // Cancel Payment Confirm State
  const [cancelPaymentModal, setCancelPaymentModal] = React.useState<{
    isOpen: boolean;
    paymentId: string;
    paymentNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, paymentId: "", paymentNumber: "", isLoading: false });
  const [cancelPaymentReason, setCancelPaymentReason] = React.useState("");

  // Cancel Invoice Confirm State
  const [cancelInvoiceModal, setCancelInvoiceModal] = React.useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, invoiceId: "", invoiceNumber: "", isLoading: false });
  const [cancelInvoiceReason, setCancelInvoiceReason] = React.useState("");

  // Finalize Invoice Confirm State
  const [finalizeModal, setFinalizeModal] = React.useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, invoiceId: "", invoiceNumber: "", isLoading: false });

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchSupplierInvoicesAction();
    if (res.success && Array.isArray(res.data)) {
      setInvoices(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Supplier Invoices" roleName={permission.roleName} />;
  }

  const handleOpenPayment = (inv: any) => {
    setSelectedInv(inv);
    setPaymentAmount(inv.remainingAmount || 0);
    setIsModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv || paymentAmount <= 0) {
      showToast({ type: "error", title: "Invalid", message: "Isi jumlah pembayaran > 0." });
      return;
    }

    setIsRecording(true);
    const res = await recordSupplierPaymentAction({
      invoiceId: selectedInv.id,
      amount: paymentAmount,
      paymentMethod,
      referenceNo,
      notes,
    });
    setIsRecording(false);

    if (res.success) {
      showToast({ type: "success", title: "Pembayaran Berhasil", message: res.message });
      setIsModalOpen(false);
      setSelectedInv(null);
      setPaymentAmount(0);
      setReferenceNo("");
      setNotes("");
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleOpenHistory = (inv: any) => {
    setHistoryInv(inv);
    setIsHistoryOpen(true);
  };

  const handleOpenCancelPayment = (paymentId: string, paymentNumber: string) => {
    setCancelPaymentReason("");
    setCancelPaymentModal({ isOpen: true, paymentId, paymentNumber, isLoading: false });
  };

  const handleCancelPayment = async () => {
    setCancelPaymentModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelSupplierPaymentAction(cancelPaymentModal.paymentId, cancelPaymentReason);
    setCancelPaymentModal({ isOpen: false, paymentId: "", paymentNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Pembayaran Dibatalkan", message: res.message });
      setIsHistoryOpen(false);
      setHistoryInv(null);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleOpenCancelInvoice = (invoiceId: string, invoiceNumber: string) => {
    setCancelInvoiceReason("");
    setCancelInvoiceModal({ isOpen: true, invoiceId, invoiceNumber, isLoading: false });
  };

  const handleCancelInvoice = async () => {
    setCancelInvoiceModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelSupplierInvoiceAction(cancelInvoiceModal.invoiceId, cancelInvoiceReason);
    setCancelInvoiceModal({ isOpen: false, invoiceId: "", invoiceNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Faktur Dibatalkan", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleOpenFinalize = (invoiceId: string, invoiceNumber: string) => {
    setFinalizeModal({ isOpen: true, invoiceId, invoiceNumber, isLoading: false });
  };

  const handleFinalize = async () => {
    setFinalizeModal((prev) => ({ ...prev, isLoading: true }));
    const res = await finalizeSupplierInvoiceAction(finalizeModal.invoiceId);
    setFinalizeModal({ isOpen: false, invoiceId: "", invoiceNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Faktur Difinalisasi", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = invoices.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.poNumber.toLowerCase().includes(q) ||
      i.supplierName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeInvoices = invoices.filter((i) => i.status !== "CANCELLED");
  const totalInvoices = activeInvoices.length;
  const totalValue = activeInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalPaid = activeInvoices.reduce((acc, i) => acc + i.amountPaid, 0);
  const totalOutstanding = Math.max(totalValue - totalPaid, 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Purchasing</span>
            <span>/</span>
            <span>Supplier Invoices</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[#0088ff]" />
            Supplier Invoices & Payments
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Penagihan faktur pembelian dari supplier & pencatatan transaksi pelunasan pembayaran.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Total Faktur</div>
          <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-white mt-1">
            {totalInvoices} <span className="text-xs font-normal text-slate-400">Faktur</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Total Nilai Pembelian</div>
          <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Total Terbayar</div>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalPaid)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800">
          <div className="text-xs text-[#8a94a6]">Sisa Hutang Dagang</div>
          <div className="text-lg font-bold font-mono text-red-500 mt-1">
            {formatCurrency(totalOutstanding)}
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
            placeholder="Cari nomor faktur, PO, supplier..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <SearchableSelect
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-56"
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "UNPAID", label: "Belum Lunas (Unpaid)" },
            { value: "PARTIALLY_PAID", label: "Sebagian (Partially Paid)" },
            { value: "PAID", label: "Lunas (Paid)" },
          ]}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">No. Faktur</th>
                <th className="p-4">Ref PO</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total Faktur</th>
                <th className="p-4 text-right">Terbayar</th>
                <th className="p-4 text-right">Sisa Tagihan</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Supplier Invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8a94a6]">
                    Belum ada Faktur Pembelian dari Supplier.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const meta = STATUS_META[inv.status] || { label: inv.status, variant: "secondary" };
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4 font-mono font-semibold text-[#0088ff]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300">{inv.poNumber}</td>
                      <td className="p-4 font-medium flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {inv.supplierName}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={meta.variant} className="rounded-full text-[10px]">
                            {meta.label}
                          </Badge>
                          {inv.isFinalized && (
                            <span title="Difinalisasi - terkunci dari perubahan">
                              <Lock className="h-3.5 w-3.5 text-slate-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.amountPaid)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-red-500">
                        {formatCurrency(inv.remainingAmount)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {inv.status !== "PAID" &&
                            inv.status !== "CANCELLED" &&
                            !inv.isFinalized &&
                            (permission.isSuperAdmin || permission.canUpdate) && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenPayment(inv)}
                                className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                              >
                                <CreditCard className="h-3 w-3" /> Catat Bayar
                              </Button>
                            )}

                          {inv.status === "PAID" && !inv.isFinalized && (permission.isSuperAdmin || permission.canUpdate) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenFinalize(inv.id, inv.invoiceNumber)}
                              className="rounded-full h-7 px-3 text-xs gap-1 shadow-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
                              title="Finalisasi Faktur"
                            >
                              <ShieldCheck className="h-3 w-3" /> Finalisasi
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleOpenHistory(inv)}
                            className="rounded-full h-7 w-7 shadow-xs"
                            title="Riwayat Pembayaran"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>

                          {inv.status !== "CANCELLED" &&
                            !inv.isFinalized &&
                            (permission.isSuperAdmin || permission.canDelete) && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleOpenCancelInvoice(inv.id, inv.invoiceNumber)}
                                className="rounded-full h-7 w-7 shadow-xs border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                                title="Batalkan Faktur"
                              >
                                <XCircle className="h-3.5 w-3.5" />
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

      {/* Modal Payment */}
      {isModalOpen && selectedInv && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#0088ff]" />
                Catat Pembayaran Faktur
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Faktur: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedInv.invoiceNumber}</span> ({selectedInv.supplierName})
              </p>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8a94a6]">Total Tagihan:</span>
                  <span className="font-mono font-bold">{formatCurrency(selectedInv.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Sudah Dibayar:</span>
                  <span className="font-mono font-bold">{formatCurrency(selectedInv.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-red-500 font-bold border-t border-slate-200 dark:border-slate-800 pt-1">
                  <span>Sisa Tagihan:</span>
                  <span className="font-mono">{formatCurrency(selectedInv.remainingAmount)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Jumlah Pembayaran (Rp) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  max={selectedInv.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="rounded-xl h-10 font-mono font-bold text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Metode Bayar</label>
                  <SearchableSelect
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    options={[
                      { value: "TRANSFER", label: "Bank Transfer" },
                      { value: "CASH", label: "Tunai / Cash" },
                      { value: "GIRO", label: "Giro / Cek" },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">No. Referensi / Bukti</label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. TRF-889100"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pelunasan via Bank Mandiri..."
                  className="rounded-xl h-9 text-xs"
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
                  disabled={isRecording}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold shadow-md shadow-blue-500/20"
                >
                  {isRecording ? "Menyimpan..." : "Simpan Pembayaran"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Pembayaran */}
      {isHistoryOpen && historyInv && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-[#0088ff]" />
                  Riwayat Pembayaran
                </h3>
                <p className="text-xs text-[#8a94a6]">
                  Faktur:{" "}
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {historyInv.invoiceNumber}
                  </span>{" "}
                  ({historyInv.supplierName})
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setHistoryInv(null);
                }}
                className="rounded-full px-4 h-8 text-xs shrink-0"
              >
                Tutup
              </Button>
            </div>

            {historyInv.isFinalized && (
              <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 border border-[#e6e9f0] dark:border-slate-800 rounded-xl p-3 text-xs text-[#8a94a6]">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Faktur ini sudah difinalisasi - transaksi pembayaran tidak bisa lagi diubah atau
                  dibatalkan.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {historyInv.payments.length === 0 ? (
                <div className="text-center text-xs text-[#8a94a6] py-8">
                  Belum ada transaksi pembayaran untuk faktur ini.
                </div>
              ) : (
                historyInv.payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="border border-[#e6e9f0] dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-mono font-bold text-[#0088ff]">{p.paymentNumber}</div>
                        <div className="text-[#8a94a6]">
                          {p.paymentDate
                            ? new Date(p.paymentDate).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </div>
                      </div>
                      <Badge
                        variant={p.status === "ACTIVE" ? "success" : "destructive"}
                        className="rounded-full text-[10px] shrink-0"
                      >
                        {p.status === "ACTIVE" ? "Aktif" : "Dibatalkan"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[#8a94a6]">Jumlah</div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(p.amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#8a94a6]">Metode</div>
                        <div className="font-medium">{p.paymentMethod || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[#8a94a6]">No. Referensi</div>
                        <div className="font-medium">{p.referenceNo || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[#8a94a6]">Catatan</div>
                        <div className="font-medium">{p.notes || "-"}</div>
                      </div>
                    </div>

                    {p.status === "CANCELLED" && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl p-2.5 text-[11px] text-red-600 dark:text-red-400 space-y-0.5">
                        <div>
                          <span className="font-semibold">Alasan:</span> {p.cancelReason || "-"}
                        </div>
                        <div>
                          <span className="font-semibold">Dibatalkan:</span>{" "}
                          {p.cancelledAt
                            ? new Date(p.cancelledAt).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </div>
                      </div>
                    )}

                    {p.status === "ACTIVE" &&
                      !historyInv.isFinalized &&
                      historyInv.status !== "CANCELLED" && (
                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCancelPayment(p.id, p.paymentNumber)}
                            className="rounded-full h-7 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                          >
                            Batalkan
                          </Button>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancel Payment */}
      <ConfirmModal
        isOpen={cancelPaymentModal.isOpen}
        onClose={() => setCancelPaymentModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancelPayment}
        title={`Batalkan Pembayaran ${cancelPaymentModal.paymentNumber}?`}
        description="Membatalkan pembayaran ini akan mengurangi jumlah terbayar (amountPaid) pada faktur terkait dan dapat mengubah status faktur tersebut. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Batalkan Pembayaran"
        variant="danger"
        isLoading={cancelPaymentModal.isLoading}
        requireReason
        reasonLabel="Alasan Pembatalan"
        reasonValue={cancelPaymentReason}
        onReasonChange={setCancelPaymentReason}
      />

      {/* Confirm Cancel Invoice */}
      <ConfirmModal
        isOpen={cancelInvoiceModal.isOpen}
        onClose={() => setCancelInvoiceModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancelInvoice}
        title={`Batalkan Faktur ${cancelInvoiceModal.invoiceNumber}?`}
        description="Tindakan ini tidak dapat dibatalkan. Jika faktur ini memiliki pembayaran aktif, Anda harus membatalkan pembayaran tersebut terlebih dahulu melalui Riwayat Pembayaran sebelum faktur bisa dibatalkan."
        confirmText="Ya, Batalkan Faktur"
        variant="danger"
        isLoading={cancelInvoiceModal.isLoading}
        requireReason
        reasonLabel="Alasan Pembatalan"
        reasonValue={cancelInvoiceReason}
        onReasonChange={setCancelInvoiceReason}
      />

      {/* Confirm Finalize Invoice */}
      <ConfirmModal
        isOpen={finalizeModal.isOpen}
        onClose={() => setFinalizeModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleFinalize}
        title={`Finalisasi Faktur ${finalizeModal.invoiceNumber}?`}
        description="Tindakan ini akan mengunci faktur ini beserta seluruh transaksi pembayarannya secara permanen dari pembatalan atau perubahan lebih lanjut. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Finalisasi"
        variant="warning"
        isLoading={finalizeModal.isLoading}
      />
    </div>
  );
}
