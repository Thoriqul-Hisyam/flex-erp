"use client";

import * as React from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  Warehouse,
  Users,
  CheckCircle2,
  Send,
  Building2,
  Package,
  Sparkles,
  Printer,
  Eye,
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
  fetchSalesOrdersAction,
  fetchSalesQuotationsAction,
  createSalesOrderAction,
  confirmSalesOrderAction,
} from "@/app/actions/sales-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  CONFIRMED: { label: "Confirmed (Stok Dialokasikan)", variant: "success" },
  PARTIALLY_DELIVERED: { label: "Partially Delivered", variant: "warning" },
  DELIVERED: { label: "Fully Delivered", variant: "default" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function SalesOrdersPage() {
  const permission = usePermission("sal_orders");
  const { showToast } = useToast();

  const [orders, setOrders] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [acceptedSqs, setAcceptedSqs] = React.useState<any[]>([]);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [selectedSqId, setSelectedSqId] = React.useState("");
  const [taxRate, setTaxRate] = React.useState(11);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{ productId: string; qtyOrdered: number; unitPrice: number; discount: number }>
  >([{ productId: "", qtyOrdered: 1, unitPrice: 0, discount: 0 }]);
  const [isCreating, setIsCreating] = React.useState(false);

  // Document Print State
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchSalesOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setOrders(res.data);
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
    fetchRecordsAction("Warehouse").then((r) => {
      if (r.success && Array.isArray(r.data)) setWarehouses(r.data);
    });
    fetchRecordsAction("Branch").then((r) => {
      if (r.success && Array.isArray(r.data)) setBranches(r.data);
    });
    fetchRecordsAction("Product").then((r) => {
      if (r.success && Array.isArray(r.data)) setProducts(r.data);
    });
    fetchSalesQuotationsAction().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setAcceptedSqs(r.data.filter((sq: any) => sq.status === "ACCEPTED"));
      }
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Sales Orders" roleName={permission.roleName} />;
  }

  const handleSqSelect = (sqId: string) => {
    setSelectedSqId(sqId);
    if (!sqId) return;
    const sq = acceptedSqs.find((s) => s.id === sqId);
    if (sq) {
      if (sq.customerId) setCustomerId(sq.customerId);
      if (sq.branchId) setBranchId(sq.branchId);
      if (sq.items && sq.items.length > 0) {
        setItems(
          sq.items.map((i: any) => ({
            productId: i.productId,
            qtyOrdered: i.qtyRequested,
            unitPrice: i.unitPrice || 0,
            discount: i.discount || 0,
          }))
        );
      }
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: "", qtyOrdered: 1, unitPrice: 0, discount: 0 }]);
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
    if (!customerId || !warehouseId) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Customer dan Gudang wajib dipilih." });
      return;
    }
    const validItems = items.filter((i) => i.productId && i.qtyOrdered > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Pilih minimal 1 produk & qty > 0." });
      return;
    }

    setIsCreating(true);
    const res = await createSalesOrderAction({
      customerId,
      warehouseId,
      branchId: branchId || undefined,
      sqId: selectedSqId || undefined,
      taxRate,
      notes,
      items: validItems,
    });
    setIsCreating(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      setCustomerId("");
      setWarehouseId("");
      setSelectedSqId("");
      setNotes("");
      setItems([{ productId: "", qtyOrdered: 1, unitPrice: 0, discount: 0 }]);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Confirm Order State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    soId: string;
    soNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, soId: "", soNumber: "", isLoading: false });

  const handleOpenConfirmModal = (id: string, num: string) => {
    setConfirmModal({ isOpen: true, soId: id, soNumber: num, isLoading: false });
  };

  const handleConfirmOrder = async () => {
    setConfirmModal((prev) => ({ ...prev, isLoading: true }));
    const res = await confirmSalesOrderAction(confirmModal.soId);
    setConfirmModal({ isOpen: false, soId: "", soNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Berhasil Konfirmasi", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const availableAcceptedSqs = acceptedSqs.filter(
    (sq) => !sq.soId && !orders.some((so) => so.sqId === sq.id && so.status !== "CANCELLED")
  );

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      o.soNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.warehouseName.toLowerCase().includes(q) ||
      (o.notes || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
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
            <span>Sales Orders</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-[#0088ff]" />
            Pesanan Penjualan (Sales Orders)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Pesanan penjualan resmi pelanggan. Mengonfirmasi SO mengalokasikan / me-reserve stok gudang.
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
              <Plus className="h-4 w-4" /> Buat SO Baru
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
            placeholder="Cari nomor SO, customer, gudang..."
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
          <option value="CONFIRMED">Confirmed (Stok Dialokasikan)</option>
          <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
          <option value="DELIVERED">Fully Delivered</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor SO</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Gudang Pengiriman</th>
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
                    Memuat data Sales Orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada Sales Order.
                  </td>
                </tr>
              ) : (
                filtered.map((so) => {
                  const meta = STATUS_META[so.status] || { label: so.status, variant: "secondary" };
                  return (
                    <tr
                      key={so.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-mono font-semibold text-[#0088ff]">{so.soNumber}</div>
                        {so.sqNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            Ref SQ: {so.sqNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {so.customerName}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          <Warehouse className="h-3.5 w-3.5 text-[#0088ff]" />
                          {so.warehouseName}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(so.totalAmount)}
                      </td>
                      <td className="p-4 text-[#8a94a6]">
                        {so.createdAt ? new Date(so.createdAt).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintDoc(so)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                        >
                          <Printer className="h-3 w-3" /> Cetak / Detail
                        </Button>

                        {so.status === "DRAFT" && (permission.isSuperAdmin || permission.canApprove) && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenConfirmModal(so.id, so.soNumber)}
                            className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                          >
                            <Send className="h-3 w-3" /> Konfirmasi SO
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

      {/* Modal Buat SO Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#0088ff]" />
                Buat Sales Order Baru
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih pelanggan, gudang pengiriman, dan rincian item pesanan.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Tarik dari SQ Accepted */}
              <div className="bg-[#0088ff]/5 dark:bg-blue-950/30 p-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-1">
                <label className="font-bold text-[#0088ff] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Impor dari Accepted Sales Quotation (SQ)
                </label>
                <select
                  value={selectedSqId}
                  onChange={(e) => handleSqSelect(e.target.value)}
                  className="w-full h-9 rounded-xl border border-blue-200 dark:border-blue-900 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                >
                  <option value="">-- Buat SO Manual (Tanpa SQ) --</option>
                  {availableAcceptedSqs.map((sq) => (
                    <option key={sq.id} value={sq.id}>
                      {sq.sqNumber} — {sq.customerName} ({sq.totalItems} item)
                    </option>
                  ))}
                </select>
              </div>

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
                    Gudang Pengiriman <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none"
                    required
                  >
                    <option value="">-- Pilih Gudang --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Catatan SO
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan pengiriman, alokasi stok..."
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
                  {isCreating ? "Menyimpan..." : "Simpan Sales Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Order Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmOrder}
        title="Konfirmasi Sales Order"
        description={`Konfirmasi Sales Order ${confirmModal.soNumber}? Tindakan ini akan mengalokasikan stok gudang (qtyReserved) dan siap diterbitkan Surat Jalan (DO).`}
        confirmText="Ya, Konfirmasi SO"
        variant="primary"
        isLoading={confirmModal.isLoading}
      />

      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="SO"
          documentNumber={printDoc.soNumber}
          date={printDoc.createdAt ? new Date(printDoc.createdAt).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.customerName || "Pelanggan Umum"}
          warehouseName={printDoc.warehouseName}
          notes={printDoc.notes}
          status={printDoc.status}
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName: i.productName || "Produk",
            productSku: i.productSku || "",
            qty: i.qtyOrdered || 1,
            unitPrice: i.unitPrice || 0,
            subtotal: (i.qtyOrdered || 1) * (i.unitPrice || 0),
          })) : []}
          subtotalAmount={printDoc.totalAmount ? printDoc.totalAmount / 1.11 : 0}
          taxAmount={printDoc.totalAmount ? printDoc.totalAmount - (printDoc.totalAmount / 1.11) : 0}
          totalAmount={printDoc.totalAmount || 0}
        />
      )}
    </div>
  );
}
