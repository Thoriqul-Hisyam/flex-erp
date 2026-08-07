"use client";

import * as React from "react";
import {
  PackageCheck,
  Plus,
  Search,
  RefreshCw,
  Warehouse,
  Truck,
  CheckCircle2,
  Calendar,
  Printer,
} from "lucide-react";
import { DocumentPrintModal } from "@/components/ui/document-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchGoodsReceiptsAction,
  fetchPurchaseOrdersAction,
  createGoodsReceiptAction,
  cancelGoodsReceiptAction,
} from "@/app/actions/purchasing-actions";
import { formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function GoodsReceiptsPage() {
  const permission = usePermission("pur_receipts");
  const { showToast } = useToast();

  const [receipts, setReceipts] = React.useState<any[]>([]);
  const [issuedOrders, setIssuedOrders] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedPoId, setSelectedPoId] = React.useState("");
  const [selectedPo, setSelectedPo] = React.useState<any | null>(null);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{
      productId: string;
      productName: string;
      productSku: string;
      qtyOrdered: number;
      qtyReceived: number;
      unitCost: number;
      batchNo?: string;
      expiryDate?: string;
    }>
  >([]);
  const [isReceiving, setIsReceiving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchGoodsReceiptsAction();
    if (res.success && Array.isArray(res.data)) {
      setReceipts(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadIssuedOrders = React.useCallback(async () => {
    const r = await fetchPurchaseOrdersAction();
    if (r.success && Array.isArray(r.data)) {
      // Only POs that are ISSUED or PARTIALLY_RECEIVED can receive goods
      setIssuedOrders(
        r.data.filter(
          (po: any) => po.status === "ISSUED" || po.status === "PARTIALLY_RECEIVED"
        )
      );
    }
  }, []);

  React.useEffect(() => {
    loadIssuedOrders();
  }, [loadIssuedOrders]);

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    const po = issuedOrders.find((p) => p.id === poId);
    setSelectedPo(po || null);

    if (po && po.items) {
      setItems(
        po.items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku,
          qtyOrdered: i.qtyOrdered,
          qtyReceived: Math.max(i.qtyOrdered - i.qtyReceived, 0),
          unitCost: i.unitPrice,
          batchNo: "",
          expiryDate: "",
        }))
      );
    } else {
      setItems([]);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      showToast({ type: "error", title: "Pilih PO", message: "Purchase Order wajib dipilih." });
      return;
    }
    const validItems = items.filter((i) => i.qtyReceived > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Isi qty diterima > 0 pada minimal 1 produk." });
      return;
    }

    setIsReceiving(true);
    const res = await createGoodsReceiptAction({
      poId: selectedPoId,
      notes,
      items: validItems,
    });
    setIsReceiving(false);

    if (res.success) {
      showToast({ type: "success", title: "Stok Masuk Berhasil", message: res.message });
      setIsModalOpen(false);
      setSelectedPoId("");
      setSelectedPo(null);
      setNotes("");
      setItems([]);
      load();
      loadIssuedOrders();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Cancel GR State
  const [cancelModal, setCancelModal] = React.useState<{
    isOpen: boolean;
    grId: string;
    grNumber: string;
    isLoading: boolean;
  }>({ isOpen: false, grId: "", grNumber: "", isLoading: false });
  const [cancelReason, setCancelReason] = React.useState("");

  const handleOpenCancelModal = (id: string, num: string) => {
    setCancelReason("");
    setCancelModal({ isOpen: true, grId: id, grNumber: num, isLoading: false });
  };

  const handleCancelGr = async () => {
    setCancelModal((prev) => ({ ...prev, isLoading: true }));
    const res = await cancelGoodsReceiptAction(cancelModal.grId, cancelReason);
    setCancelModal({ isOpen: false, grId: "", grNumber: "", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Berhasil Dibatalkan", message: res.message });
      load();
      loadIssuedOrders();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.grNumber.toLowerCase().includes(q) ||
      r.poNumber.toLowerCase().includes(q) ||
      r.supplierName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q)
    );
  });

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Goods Receipts" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Purchasing</span>
            <span>/</span>
            <span>Goods Receipt</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-[#0088ff]" />
            Goods Receipt / Penerimaan Barang (Stock IN)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Pencatatan barang masuk dari PO ke gudang tujuan (otomatis memicu Stock IN & pembuatan Batch).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-emerald-500/20"
            >
              <Plus className="h-4 w-4" /> Terima Barang (Stock IN)
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
            placeholder="Cari nomor GR, PO, supplier, atau gudang..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr className="border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-4">Nomor GR</th>
                <th className="p-4">Ref PO</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Gudang Tujuan</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Total SKU Received</th>
                <th className="p-4">Diterima Oleh</th>
                <th className="p-4">Tanggal Diterima</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 font-medium text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Penerimaan Barang...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8a94a6]">
                    Belum ada bukti Penerimaan Barang.
                  </td>
                </tr>
              ) : (
                filtered.map((gr) => (
                  <tr
                    key={gr.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="p-4 font-mono font-semibold text-[#0088ff]">{gr.grNumber}</td>
                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{gr.poNumber}</td>
                    <td className="p-4 font-medium flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-[#8a94a6]" />
                      {gr.supplierName}
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Warehouse className="h-3.5 w-3.5 text-[#8a94a6]" />
                        {gr.warehouseName}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Badge
                        variant={gr.status === "CANCELLED" ? "destructive" : "success"}
                        className="rounded-full text-[10px]"
                      >
                        {gr.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center font-mono font-bold">
                      {gr.items ? gr.items.length : 0} SKU
                    </td>
                    <td className="p-4 text-[#8a94a6]">{gr.receivedByName}</td>
                    <td className="p-4 text-[#8a94a6]">
                      {gr.receivedAt ? new Date(gr.receivedAt).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="p-4 text-center flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPrintDoc(gr)}
                        className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                      >
                        <Printer className="h-3 w-3" /> Cetak Tanda Terima
                      </Button>
                      {gr.status === "RECEIVED" && (permission.isSuperAdmin || permission.canDelete) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenCancelModal(gr.id, gr.grNumber)}
                          className="rounded-full h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                        >
                          Batalkan
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Terima Barang Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-3xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-500" />
                Form Penerimaan Barang (Goods Receipt)
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Pilih PO yang diterbitkan dan masukkan jumlah fisik barang yang diterima di gudang.
              </p>
            </div>

            <form onSubmit={handleReceive} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Pilih Purchase Order (PO) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={selectedPoId}
                  onChange={handlePoSelect}
                  placeholder="-- Pilih PO --"
                  options={issuedOrders.map((po) => ({
                    value: po.id,
                    label: `${po.poNumber} — ${po.supplierName} (Gudang: ${po.warehouseName})`,
                  }))}
                />
              </div>

              {selectedPo && (
                <div className="space-y-3 pt-2 border-t border-[#f0f2f7] dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div>
                      Supplier: <span className="font-bold">{selectedPo.supplierName}</span>
                    </div>
                    <div>
                      Gudang: <span className="font-bold">{selectedPo.warehouseName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Rincian Barang Diterima & Batch
                    </label>
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-[#e6e9f0] dark:border-slate-800"
                        >
                          <div className="col-span-4">
                            <div className="font-semibold">{item.productName}</div>
                            <div className="text-[11px] text-[#8a94a6] font-mono">
                              SKU: {item.productSku} | Pesan: {item.qtyOrdered}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] text-[#8a94a6]">Qty Diterima</label>
                            <Input
                              type="number"
                              min="0"
                              value={item.qtyReceived}
                              onChange={(e) =>
                                handleItemChange(idx, "qtyReceived", Number(e.target.value))
                              }
                              className="h-8 text-center font-bold text-xs"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[10px] text-[#8a94a6]">No. Batch (Opsional)</label>
                            <Input
                              value={item.batchNo || ""}
                              onChange={(e) => handleItemChange(idx, "batchNo", e.target.value)}
                              placeholder="e.g. BATCH-202608"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[10px] text-[#8a94a6]">Tgl Expired (Opsional)</label>
                            <DatePicker
                              value={item.expiryDate || ""}
                              onChange={(val) => handleItemChange(idx, "expiryDate", val)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Catatan Penerimaan</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Penerimaan barang kondisi baik dan lengkap"
                  className="rounded-xl h-9"
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
                  disabled={isReceiving || !selectedPoId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 h-9 font-semibold shadow-md shadow-emerald-500/20"
                >
                  {isReceiving ? "Memproses Stock IN..." : "Proses Penerimaan & Stock IN"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cancel GR Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleCancelGr}
        title="Batalkan Goods Receipt"
        description={`Batalkan Goods Receipt ${cancelModal.grNumber}? Stok yang sudah diterima akan dikoreksi (dikeluarkan kembali) dari gudang.`}
        confirmText="Ya, Batalkan GR"
        variant="danger"
        isLoading={cancelModal.isLoading}
        requireReason
        reasonLabel="Alasan Pembatalan"
        reasonValue={cancelReason}
        onReasonChange={setCancelReason}
      />
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="RECEIPT"
          documentNumber={printDoc.grNumber}
          date={printDoc.receivedAt ? new Date(printDoc.receivedAt).toLocaleDateString("id-ID") : "-"}
          partyName={printDoc.supplierName || "Supplier Utama"}
          warehouseName={printDoc.warehouseName}
          notes={printDoc.notes}
          status="RECEIVED"
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName: i.productName || "Produk",
            productSku: i.productSku || "",
            qty: i.qtyReceived || i.qtyOrdered || 1,
          })) : []}
        />
      )}
    </div>
  );
}
