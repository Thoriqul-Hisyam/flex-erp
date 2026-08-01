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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import {
  fetchSupplierInvoicesAction,
  recordSupplierPaymentAction,
} from "@/app/actions/purchasing-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

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

  const filtered = invoices.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.poNumber.toLowerCase().includes(q) ||
      i.supplierName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInvoices = invoices.length;
  const totalValue = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalPaid = invoices.reduce((acc, i) => acc + i.amountPaid, 0);
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-full border border-[#e6e9f0] dark:border-slate-800 px-4 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="ALL">Semua Status</option>
          <option value="UNPAID">Belum Lunas (Unpaid)</option>
          <option value="PARTIALLY_PAID">Sebagian (Partially Paid)</option>
          <option value="PAID">Lunas (Paid)</option>
        </select>
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
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
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
                        {inv.status !== "PAID" && (permission.isSuperAdmin || permission.canUpdate) && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayment(inv)}
                            className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                          >
                            <CreditCard className="h-3 w-3" /> Catat Bayar
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
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                  >
                    <option value="TRANSFER">Bank Transfer</option>
                    <option value="CASH">Tunai / Cash</option>
                    <option value="GIRO">Giro / Cek</option>
                  </select>
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
    </div>
  );
}
