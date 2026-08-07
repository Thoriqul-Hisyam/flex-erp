"use client";

import * as React from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  Warehouse,
  Truck,
  CheckCircle2,
  Send,
  Trash2,
  Building2,
  Package,
  Sparkles,
  PackageCheck,
  Printer,
} from "lucide-react";
import { DocumentPrintModal } from "@/components/ui/document-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchPurchaseOrdersAction,
  fetchPurchaseRequestsAction,
  createPurchaseOrderAction,
  issuePurchaseOrderAction,
  createGoodsReceiptAction,
  cancelPurchaseOrderAction,
  closePurchaseOrderShortAction,
} from "@/app/actions/purchasing-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ISSUED: { label: "Issued (On Order)", variant: "warning" },
  PARTIALLY_RECEIVED: { label: "Partially Received", variant: "default" },
  RECEIVED: { label: "Fully Received", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function PurchaseOrdersPage() {
  const permission = usePermission("pur_orders");
  const { showToast } = useToast();

  const [orders, setOrders] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [approvedPrs, setApprovedPrs] = React.useState<any[]>([]);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [poType, setPoType] = React.useState<"FOR_RESALE" | "INTERNAL_USE">("FOR_RESALE");
  const [supplierId, setSupplierId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [selectedPrId, setSelectedPrId] = React.useState("");
  const [taxRate, setTaxRate] = React.useState(11);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{ productId: string; qtyOrdered: number; unitPrice: number }>
  >([{ productId: "", qtyOrdered: 1, unitPrice: 0 }]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchPurchaseOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setOrders(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadApprovedPrs = React.useCallback(async () => {
    const r = await fetchPurchaseRequestsAction();
    if (r.success && Array.isArray(r.data)) {
      setApprovedPrs(r.data.filter((pr: any) => pr.status === "APPROVED" && !pr.poId));
    }
  }, []);

  React.useEffect(() => {
    fetchRecordsAction("Supplier").then((r) => {
      if (r.success && Array.isArray(r.data)) setSuppliers(r.data);
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
    loadApprovedPrs();
  }, [loadApprovedPrs]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: "", qtyOrdered: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "productId") {
          const prod = products.find((p) => p.id === value);
          const price = prod ? Number(prod.costPrice || 0) : 0;
          return { ...item, productId: value, unitPrice: price };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handlePrSelect = (prId: string) => {
    setSelectedPrId(prId);
    if (!prId) return;
    const pr = approvedPrs.find((p) => p.id === prId);
    if (pr) {
      if (pr.requestType) setPoType(pr.requestType);
      if (pr.branchId) setBranchId(pr.branchId);
      if (pr.items && pr.items.length > 0) {
        setItems(
          pr.items.map((i: any) => ({
            productId: i.productId,
            qtyOrdered: i.qtyRequested,
            unitPrice: i.unitCost || 0,
          }))
        );
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Supplier wajib dipilih." });
      return;
    }
    if (poType === "FOR_RESALE" && !warehouseId) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Gudang Tujuan wajib dipilih untuk pengadaan barang dagang." });
      return;
    }
    if (poType === "INTERNAL_USE" && !branchId) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Cabang Tujuan wajib dipilih untuk penggunaan internal." });
      return;
    }
    const validItems = items.filter((i) => i.productId && i.qtyOrdered > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Pilih minimal 1 produk & qty > 0." });
      return;
    }

    setIsCreating(true);
    const res = await createPurchaseOrderAction({
      supplierId,
      poType,
      branchId: branchId || undefined,
      warehouseId: warehouseId || undefined,
      prId: selectedPrId || undefined,
      taxRate,
      notes,
      items: validItems,
    });
    setIsCreating(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      setSupplierId("");
      setWarehouseId("");
      setBranchId("");
      setSelectedPrId("");
      setNotes("");
      setItems([{ productId: "", qtyOrdered: 1, unitPrice: 0 }]);
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Confirm Issue State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    poId: string;
    poNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, poId: "", poNumber: "", isLoading: false });

  const handleOpenIssueModal = (id: string, num: string) => {
    setConfirmModal({ isOpen: true, poId: id, poNumber: num, isLoading: false });
  };

  const handleIssue = async () => {
    setConfirmModal((prev) => ({ ...prev, isLoading: true }));
    const res = await issuePurchaseOrderAction(confirmModal.poId);
    setConfirmModal({ isOpen: false, poId: "", poNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Issued", message: res.message });
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Cancel PO State
  const [cancelModal, setCancelModal] = React.useState<{
    isOpen: boolean;
    poId: string;
    poNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, poId: "", poNumber: "", isLoading: false });
  const [cancelReason, setCancelReason] = React.useState("");

  const handleOpenCancelModal = (id: string, num: string) => {
    setCancelReason("");
    setCancelModal({ isOpen: true, poId: id, poNumber: num, isLoading: false });
  };

  const handleCancelPo = async () => {
    setCancelModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelPurchaseOrderAction(cancelModal.poId, cancelReason);
    setCancelModal({ isOpen: false, poId: "", poNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Berhasil Dibatalkan", message: res.message });
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Close Short State
  const [shortCloseModal, setShortCloseModal] = React.useState<{
    isOpen: boolean;
    poId: string;
    poNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, poId: "", poNumber: "", isLoading: false });
  const [shortCloseReason, setShortCloseReason] = React.useState("");

  const handleOpenShortCloseModal = (id: string, num: string) => {
    setShortCloseReason("");
    setShortCloseModal({ isOpen: true, poId: id, poNumber: num, isLoading: false });
  };

  const handleCloseShort = async () => {
    setShortCloseModal((prev) => ({ ...prev, isLoading: true }));
    const res = await closePurchaseOrderShortAction(shortCloseModal.poId, shortCloseReason);
    setShortCloseModal({ isOpen: false, poId: "", poNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "PO Ditutup Short", message: res.message });
      load();
      loadApprovedPrs();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      o.poNumber.toLowerCase().includes(q) ||
      o.supplierName.toLowerCase().includes(q) ||
      o.warehouseName.toLowerCase().includes(q) ||
      (o.notes || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Purchase Orders" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Purchasing</span>
            <span>/</span>
            <span>Purchase Orders</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-[#0088ff]" />
            Purchase Orders (PO)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Pesanan pembelian resmi ke supplier. Menerbitkan PO mencatat stok ekspektasi masuk (qtyIncoming).
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
              <Plus className="h-4 w-4" /> Buat PO Baru
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
            placeholder="Cari nomor PO, supplier, gudang..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <SearchableSelect
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-56"
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "DRAFT", label: "Draft" },
            { value: "ISSUED", label: "Issued (Terbit)" },
            { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
            { value: "RECEIVED", label: "Fully Received" },
          ]}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor PO</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Gudang Tujuan</th>
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
                    Memuat data Purchase Orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada Purchase Order.
                  </td>
                </tr>
              ) : (
                filtered.map((po) => {
                  const isShortClosed =
                    po.status === "RECEIVED" &&
                    (po.items || []).some((i: any) => Number(i.qtyReceived) < Number(i.qtyOrdered));
                  const meta = isShortClosed
                    ? { label: "Received (Short)", variant: "warning" as const }
                    : STATUS_META[po.status] || { label: po.status, variant: "secondary" as const };
                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-mono font-semibold text-[#0088ff]">{po.poNumber}</div>
                        {po.prNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            Ref PR: {po.prNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-[#8a94a6]" />
                          {po.supplierName}
                        </div>
                        <Badge
                          variant={po.poType === "INTERNAL_USE" ? "secondary" : "default"}
                          className="rounded-full text-[9px] mt-1 gap-1 px-2 py-0.5 font-medium inline-flex items-center"
                        >
                          {po.poType === "INTERNAL_USE" ? (
                            <>
                              <Building2 className="h-2.5 w-2.5 text-purple-500" />
                              <span>Internal OPEX</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-2.5 w-2.5 text-[#0088ff]" />
                              <span>Barang Dagang</span>
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {po.poType === "INTERNAL_USE" ? (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-purple-500" />
                            {po.branchName || "Cabang"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Warehouse className="h-3.5 w-3.5 text-[#8a94a6]" />
                            {po.warehouseName}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="p-4 text-[#8a94a6]">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintDoc(po)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                        >
                          <Printer className="h-3 w-3" /> Cetak / Detail PO
                        </Button>

                        {po.status === "DRAFT" && (permission.isSuperAdmin || permission.canApprove) && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenIssueModal(po.id, po.poNumber)}
                            className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full h-7 px-3 text-xs gap-1"
                          >
                            <Send className="h-3 w-3" /> Terbitkan PO
                          </Button>
                        )}
                        {(po.status === "DRAFT" || po.status === "ISSUED") &&
                          (permission.isSuperAdmin || permission.canDelete) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCancelModal(po.id, po.poNumber)}
                              className="rounded-full h-7 px-3 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                            >
                              Batalkan
                            </Button>
                          )}
                        {po.status === "PARTIALLY_RECEIVED" &&
                          (permission.isSuperAdmin || permission.canApprove) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenShortCloseModal(po.id, po.poNumber)}
                              className="rounded-full h-7 px-3 text-xs gap-1 border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:bg-amber-950/30"
                            >
                              Tutup Short
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

      {/* Modal Buat PO Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[#0088ff]" />
                Buat Purchase Order Baru
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih supplier, gudang pengiriman, dan rincian produk pesanan.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Tarik dari PR Approved Selection */}
              <div className="bg-[#0088ff]/5 dark:bg-blue-950/30 p-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-1">
                <label className="font-bold text-[#0088ff] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Impor dari Approved Purchase Request (PR)
                </label>
                <SearchableSelect
                  value={selectedPrId}
                  onChange={handlePrSelect}
                  placeholder="-- Buat PO Manual (Tanpa PR) --"
                  options={approvedPrs
                    .filter(
                      (pr) => !pr.poId && !orders.some((po) => po.prId === pr.id && po.status !== "CANCELLED")
                    )
                    .map((pr) => ({
                      value: pr.id,
                      label: `${pr.prNumber} — ${pr.department} (${pr.totalItems} item - ${pr.requestType === "INTERNAL_USE" ? "Internal OPEX" : "Barang Dagang"})`,
                    }))}
                />
              </div>

              {/* Jenis Pengadaan */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Jenis Pesanan PO <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPoType("FOR_RESALE")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      poType === "FOR_RESALE"
                        ? "bg-white dark:bg-slate-800 text-[#0088ff] shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Barang Dagang (Dikirim ke Gudang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoType("INTERNAL_USE")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      poType === "INTERNAL_USE"
                        ? "bg-white dark:bg-slate-800 text-purple-500 shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Penggunaan Internal (Dikirim ke Cabang)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Supplier / Vendor <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={supplierId}
                    onChange={setSupplierId}
                    options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.code || "-"})` }))}
                    placeholder="-- Pilih Supplier --"
                  />
                </div>

                {poType === "FOR_RESALE" ? (
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Gudang Tujuan <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      value={warehouseId}
                      onChange={setWarehouseId}
                      options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                      placeholder="-- Pilih Gudang --"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Cabang Tujuan <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      value={branchId}
                      onChange={setBranchId}
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                      placeholder="-- Pilih Cabang --"
                    />
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="space-y-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Daftar Item Dipesan
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddItem}
                    className="rounded-full h-7 px-3 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Baris
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-[#e6e9f0] dark:border-slate-800"
                    >
                      <SearchableSelect
                        value={item.productId}
                        onChange={(val) => handleItemChange(idx, "productId", val)}
                        options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku || "-"})` }))}
                        placeholder="-- Pilih Produk --"
                        className="flex-1"
                      />

                      <Input
                        type="number"
                        min="1"
                        value={item.qtyOrdered}
                        onChange={(e) =>
                          handleItemChange(idx, "qtyOrdered", Number(e.target.value))
                        }
                        placeholder="Qty"
                        className="w-20 h-8 text-center rounded-lg text-xs"
                        required
                      />

                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, "unitPrice", Number(e.target.value))
                        }
                        placeholder="Harga Satuan"
                        className="w-28 h-8 text-right rounded-lg text-xs"
                        required
                      />

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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
                  {isCreating ? "Menyimpan..." : "Simpan PO"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Issue Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleIssue}
        title="Terbitkan Purchase Order"
        description={`Terbitkan Purchase Order ${confirmModal.poNumber} ke Supplier? Stok ekspektasi (qtyIncoming) akan otomatis bertambah.`}
        confirmText="Ya, Terbitkan PO"
        variant="primary"
        isLoading={confirmModal.isLoading}
      />

      {/* Cancel PO Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancelPo}
        title="Batalkan Purchase Order"
        description={`Batalkan Purchase Order ${cancelModal.poNumber}? Stok ekspektasi (qtyIncoming) akan dilepas kembali.`}
        confirmText="Ya, Batalkan PO"
        variant="danger"
        isLoading={cancelModal.isLoading}
        requireReason
        reasonLabel="Alasan Pembatalan"
        reasonValue={cancelReason}
        onReasonChange={setCancelReason}
      />

      {/* Close Short Modal */}
      <ConfirmModal
        isOpen={shortCloseModal.isOpen}
        onClose={() => setShortCloseModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCloseShort}
        title="Tutup PO Sebagai Short"
        description={`Tutup sisa qty PO ${shortCloseModal.poNumber} yang belum diterima sebagai final (tidak akan datang lagi)? Stok ekspektasi sisa akan dilepas, dan faktur pembelian (jika ada) disesuaikan ke nilai yang benar-benar diterima.`}
        confirmText="Ya, Tutup Short"
        variant="warning"
        isLoading={shortCloseModal.isLoading}
        requireReason
        reasonLabel="Alasan (misal: supplier stok habis, sisa dibatalkan)"
        reasonValue={shortCloseReason}
        onReasonChange={setShortCloseReason}
      />
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="PO"
          documentNumber={printDoc.poNumber}
          date={printDoc.createdAt ? new Date(printDoc.createdAt).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.supplierName || "Supplier Utama"}
          warehouseName={printDoc.warehouseName}
          notes={printDoc.notes}
          status={
            printDoc.status === "RECEIVED" &&
            (printDoc.items || []).some((i: any) => Number(i.qtyReceived) < Number(i.qtyOrdered))
              ? "RECEIVED (SHORT - lihat catatan)"
              : printDoc.status
          }
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName:
              Number(i.qtyReceived) < Number(i.qtyOrdered)
                ? `${i.productName || "Produk"} (Diterima: ${formatNumber(Number(i.qtyReceived) || 0)}/${formatNumber(Number(i.qtyOrdered) || 0)})`
                : i.productName || "Produk",
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
