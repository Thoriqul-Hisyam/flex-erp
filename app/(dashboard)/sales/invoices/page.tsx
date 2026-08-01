"use client";

import * as React from "react";
import {
  Receipt,
  Plus,
  Search,
  RefreshCw,
  Users,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  DollarSign,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { DocumentPrintModal } from "@/components/ui/document-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { useToast } from "@/components/ui/toast";
import {
  fetchCustomerInvoicesAction,
  fetchSalesOrdersAction,
  createCustomerInvoiceAction,
  recordCustomerPaymentAction,
} from "@/app/actions/sales-actions";
import { formatCurrency } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  UNPAID: { label: "Belum Dibayar", variant: "destructive" },
  PARTIALLY_PAID: { label: "Sebagian Dibayar", variant: "warning" },
  PAID: { label: "Lunas (Paid)", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "secondary" },
};

export default function CustomerInvoicesPage() {
  const permission = usePermission("sal_invoices");
  const { showToast } = useToast();

  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [salesOrders, setSalesOrders] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  // Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = React.useState(false);
  const [selectedSoId, setSelectedSoId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [isCreatingInvoice, setIsCreatingInvoice] = React.useState(false);

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<any | null>(null);
  const [payAmount, setPayAmount] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState("TRANSFER");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [payNotes, setPayNotes] = React.useState("");
  const [isRecordingPayment, setIsRecordingPayment] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchCustomerInvoicesAction();
    if (res.success && Array.isArray(res.data)) {
      setInvoices(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchSalesOrdersAction().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setSalesOrders(r.data.filter((so: any) => so.status !== "CANCELLED" && so.status !== "DRAFT"));
      }
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Customer Invoices" roleName={permission.roleName} />;
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSoId) {
      showToast({ type: "error", title: "Pilih SO", message: "Sales Order (SO) wajib dipilih." });
      return;
    }

    setIsCreatingInvoice(true);
    const res = await createCustomerInvoiceAction({
      soId: selectedSoId,
      dueDate: dueDate || undefined,
    });
    setIsCreatingInvoice(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsInvoiceModalOpen(false);
      setSelectedSoId("");
      setDueDate("");
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const handleOpenPayModal = (inv: any) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.remainingAmount);
    setPaymentMethod("TRANSFER");
    setReferenceNo("");
    setPayNotes("");
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      showToast({ type: "error", title: "Data Belum Valid", message: "Jumlah pembayaran harus > 0." });
      return;
    }

    setIsRecordingPayment(true);
    const res = await recordCustomerPaymentAction({
      invoiceId: selectedInvoice.id,
      amount: payAmount,
      paymentMethod,
      referenceNo: referenceNo || undefined,
      notes: payNotes || undefined,
    });
    setIsRecordingPayment(false);

    if (res.success) {
      showToast({ type: "success", title: "Pembayaran Dicatat", message: res.message });
      setIsPayModalOpen(false);
      setSelectedInvoice(null);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.soNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
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
            <span>Customer Invoices</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#0088ff]" />
            Faktur Penjualan & Pelunasan (Customer Invoices)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Terbitkan faktur tagihan dari SO yang dikirim dan catat riwayat pembayaran dari pelanggan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Terbitkan Faktur Baru
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
            placeholder="Cari nomor faktur, SO, atau pelanggan..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-full border border-[#e6e9f0] dark:border-slate-800 px-4 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">Semua Status Faktur</option>
          <option value="UNPAID">Belum Dibayar (Unpaid)</option>
          <option value="PARTIALLY_PAID">Sebagian Dibayar</option>
          <option value="PAID">Lunas (Paid)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor Faktur</th>
                <th className="p-4">Ref SO</th>
                <th className="p-4">Pelanggan / Customer</th>
                <th className="p-4 text-right">Total Tagihan</th>
                <th className="p-4 text-right">Sudah Dibayar</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Tgl Jatuh Tempo</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Faktur Penjualan...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8a94a6]">
                    Belum ada Faktur Penjualan.
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
                      <td className="p-4 font-mono font-semibold text-[#0088ff]">{inv.invoiceNumber}</td>
                      <td className="p-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {inv.soNumber}
                      </td>
                      <td className="p-4 font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {inv.customerName}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCurrency(inv.amountPaid)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-[#8a94a6]">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintDoc(inv)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                        >
                          <Printer className="h-3 w-3" /> Cetak Faktur
                        </Button>

                        {inv.status !== "PAID" && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(inv)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                          >
                            <CreditCard className="h-3 w-3" /> Catat Pembayaran
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

      {/* Modal Terbitkan Faktur */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[#0088ff]" />
                Terbitkan Faktur Penjualan
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih Sales Order (SO) untuk menerbitkan faktur tagihan resmi.
              </p>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Pilih Sales Order (SO) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSoId}
                  onChange={(e) => setSelectedSoId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Sales Order --</option>
                  {salesOrders.map((so) => (
                    <option key={so.id} value={so.id}>
                      {so.soNumber} — {so.customerName} ({formatCurrency(so.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tanggal Jatuh Tempo (Due Date)
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="rounded-full px-4 h-9 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingInvoice}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isCreatingInvoice ? "Memproses..." : "Terbitkan Faktur"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Pembayaran */}
      {isPayModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Catat Pembayaran Customer
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Faktur: <span className="font-mono font-semibold text-[#0088ff]">{selectedInvoice.invoiceNumber}</span> ({selectedInvoice.customerName})
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Tagihan:</span>
                <span className="font-mono font-bold">{formatCurrency(selectedInvoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sudah Dibayar:</span>
                <span className="font-mono text-emerald-600">{formatCurrency(selectedInvoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 font-bold">
                <span className="text-slate-700 dark:text-slate-300">Sisa Tagihan:</span>
                <span className="font-mono text-red-500">{formatCurrency(selectedInvoice.remainingAmount)}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nominal Pembayaran (Rp) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={selectedInvoice.remainingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="rounded-xl h-9 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="TRANSFER">Bank Transfer</option>
                    <option value="CASH">Tunai / Cash</option>
                    <option value="GIRO_CHECK">Giro / Cek</option>
                    <option value="CREDIT_CARD">Kartu Kredit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    No. Referensi / Bank
                  </label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Contoh: BCA Ref #12345"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan Pembayaran
                </label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Keterangan transfer / pelunasan..."
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0f2f7] dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPayModalOpen(false)}
                  className="rounded-full px-4 h-9 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isRecordingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-emerald-500/20"
                >
                  {isRecordingPayment ? "Menyimpan..." : "Simpan Pembayaran"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="INVOICE"
          documentNumber={printDoc.invoiceNumber}
          date={printDoc.issueDate ? new Date(printDoc.issueDate).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.customerName || "Pelanggan Utama"}
          status={printDoc.status}
          subtotalAmount={printDoc.subtotal || printDoc.totalAmount / 1.11}
          taxAmount={printDoc.taxAmount || printDoc.totalAmount - (printDoc.totalAmount / 1.11)}
          totalAmount={printDoc.totalAmount || 0}
          items={[
            {
              productName: `Penjualan Ref ${printDoc.soNumber}`,
              qty: 1,
              unitPrice: printDoc.totalAmount || 0,
              subtotal: printDoc.totalAmount || 0,
            },
          ]}
        />
      )}
    </div>
  );
}
