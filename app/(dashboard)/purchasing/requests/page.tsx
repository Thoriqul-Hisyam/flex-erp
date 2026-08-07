"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  Trash2,
  FileCheck,
  Send,
  XCircle,
  Building2,
  Package,
  Edit3,
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
  fetchPurchaseRequestsAction,
  createPurchaseRequestAction,
  updatePurchaseRequestAction,
  cancelPurchaseRequestAction,
  submitPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
} from "@/app/actions/purchasing-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function PurchaseRequestsPage() {
  const permission = usePermission("pur_requests");
  const { showToast } = useToast();

  const [requests, setRequests] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingPrId, setEditingPrId] = React.useState<string | null>(null);
  const [requestType, setRequestType] = React.useState<"FOR_RESALE" | "INTERNAL_USE">("FOR_RESALE");
  const [branchId, setBranchId] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{ productId: string; qtyRequested: number; unitCost: number; notes?: string }>
  >([{ productId: "", qtyRequested: 1, unitCost: 0, notes: "" }]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [printDoc, setPrintDoc] = React.useState<any | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchPurchaseRequestsAction();
    if (res.success && Array.isArray(res.data)) {
      setRequests(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Product").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setProducts(r.data);
      }
    });
    fetchRecordsAction("Department").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setDepartments(r.data);
      }
    });
    fetchRecordsAction("Branch").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setBranches(r.data);
      }
    });
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: "", qtyRequested: 1, unitCost: 0, notes: "" }]);
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
          const cost = prod ? Number(prod.costPrice || 0) : 0;
          return { ...item, productId: value, unitCost: cost };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleOpenCreateModal = () => {
    setEditingPrId(null);
    setRequestType("FOR_RESALE");
    // Default "Cabang Pemohon" to the requester's own branch. The server
    // action rejects any branchId that doesn't match the session user's
    // assigned branch (see assertCompanyScopedBranch in purchasing-actions.ts),
    // so a branch-assigned user must submit their own branch. Users with no
    // assigned branch (HQ/unassigned) keep free choice across company branches.
    setBranchId(permission.branchId || "");
    setDepartment("");
    setNotes("");
    setItems([{ productId: "", qtyRequested: 1, unitCost: 0, notes: "" }]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pr: any) => {
    setEditingPrId(pr.id);
    setRequestType(pr.requestType || "FOR_RESALE");
    setBranchId(pr.branchId || "");
    setDepartment(pr.department || "");
    setNotes(pr.notes || "");
    if (pr.items && pr.items.length > 0) {
      setItems(
        pr.items.map((i: any) => ({
          productId: i.productId,
          qtyRequested: i.qtyRequested,
          unitCost: i.unitCost || 0,
          notes: i.notes || "",
        }))
      );
    } else {
      setItems([{ productId: "", qtyRequested: 1, unitCost: 0, notes: "" }]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (targetStatus: "DRAFT" | "SUBMITTED") => {
    const validItems = items.filter((i) => i.productId && i.qtyRequested > 0);
    if (validItems.length === 0) {
      showToast({ type: "error", title: "Data Belum Lengkap", message: "Pilih minimal 1 produk & qty > 0." });
      return;
    }

    setIsSaving(true);
    let res;
    if (editingPrId) {
      res = await updatePurchaseRequestAction(editingPrId, {
        requestType,
        branchId: branchId || undefined,
        department,
        notes,
        items: validItems,
      });
      if (res.success && targetStatus === "SUBMITTED") {
        await submitPurchaseRequestAction(editingPrId);
      }
    } else {
      res = await createPurchaseRequestAction({
        requestType,
        branchId: branchId || undefined,
        department,
        notes,
        status: targetStatus,
        items: validItems,
      });
    }
    setIsSaving(false);

    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      setIsModalOpen(false);
      setEditingPrId(null);
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    prId: string;
    prNumber: string;
    actionType: "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL";
    isLoading: boolean;
  }>({ isOpen: false, prId: "", prNumber: "", actionType: "SUBMIT", isLoading: false });
  const [actionReason, setActionReason] = React.useState("");

  const handleOpenActionModal = (id: string, num: string, type: "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL") => {
    setActionReason("");
    setConfirmModal({ isOpen: true, prId: id, prNumber: num, actionType: type, isLoading: false });
  };

  const handleConfirmAction = async () => {
    setConfirmModal((prev) => ({ ...prev, isLoading: true }));
    let res;
    if (confirmModal.actionType === "SUBMIT") {
      res = await submitPurchaseRequestAction(confirmModal.prId);
    } else if (confirmModal.actionType === "APPROVE") {
      res = await approvePurchaseRequestAction(confirmModal.prId);
    } else if (confirmModal.actionType === "REJECT") {
      res = await rejectPurchaseRequestAction(confirmModal.prId, actionReason);
    } else {
      res = await cancelPurchaseRequestAction(confirmModal.prId, actionReason);
    }
    setConfirmModal({ isOpen: false, prId: "", prNumber: "", actionType: "SUBMIT", isLoading: false });
    if (res.success) {
      showToast({ type: "success", title: "Berhasil", message: res.message });
      load();
    } else {
      showToast({ type: "error", title: "Gagal", message: res.message });
    }
  };

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.prNumber.toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Purchase Requests" roleName={permission.roleName} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Purchasing</span>
            <span>/</span>
            <span>Purchase Requests</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#0088ff]" />
            Purchase Requests (PR)
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Pengajuan kebutuhan barang internal dari divisi/gudang sebelum diterbitkan PO.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="rounded-full gap-2 text-xs">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {(permission.isSuperAdmin || permission.canCreate) && (
            <Button
              onClick={handleOpenCreateModal}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full gap-2 text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" /> Buat Pengajuan PR
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
            placeholder="Cari nomor PR, divisi, atau catatan..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>

        <SearchableSelect
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-48"
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] uppercase font-semibold">
              <tr>
                <th className="p-4">Nomor PR</th>
                <th className="p-4">Divisi / Dep</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Total Item</th>
                <th className="p-4">Diajukan Oleh</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Memuat data Purchase Requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8a94a6]">
                    Belum ada pengajuan Purchase Request.
                  </td>
                </tr>
              ) : (
                filtered.map((pr) => {
                  const meta = STATUS_META[pr.status] || { label: pr.status, variant: "secondary" };
                  return (
                    <tr
                      key={pr.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4 font-mono font-semibold text-[#0088ff]">{pr.prNumber}</td>
                      <td className="p-4">
                        <Badge
                          variant={pr.requestType === "INTERNAL_USE" ? "secondary" : "default"}
                          className="rounded-full text-[10px] gap-1 px-2.5 py-0.5 font-medium inline-flex items-center"
                        >
                          {pr.requestType === "INTERNAL_USE" ? (
                            <>
                              <Building2 className="h-3 w-3 text-purple-500" />
                              <span>Internal OPEX</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3 text-[#0088ff]" />
                              <span>Barang Dagang</span>
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="p-4 font-medium">
                        {pr.department}
                        {pr.branchName && pr.branchName !== "-" && (
                          <div className="text-[10px] text-[#8a94a6]">{pr.branchName}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={meta.variant} className="rounded-full text-[10px]">
                          {meta.label}
                        </Badge>
                        {pr.poNumber && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                            PO: {pr.poNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center font-mono font-bold">{pr.totalItems} SKU</td>
                      <td className="p-4 text-[#8a94a6]">{pr.requestedByName}</td>
                      <td className="p-4 text-[#8a94a6]">
                        {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrintDoc(pr)}
                            className="rounded-full h-7 px-2.5 text-xs gap-1 hover:border-[#0088ff] hover:text-[#0088ff]"
                          >
                            <Printer className="h-3 w-3" /> Cetak / Detail
                          </Button>

                          {pr.status === "DRAFT" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleOpenActionModal(pr.id, pr.prNumber, "SUBMIT")}
                                className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                              >
                                <Send className="h-3 w-3" /> Submit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditModal(pr)}
                                className="rounded-full h-7 px-3 text-xs gap-1 border-slate-200 dark:border-slate-800"
                              >
                                <Edit3 className="h-3 w-3" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenActionModal(pr.id, pr.prNumber, "CANCEL")}
                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full h-7 w-7 p-0"
                                title="Batalkan PR"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {pr.status === "SUBMITTED" && (permission.isSuperAdmin || permission.canApprove) && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleOpenActionModal(pr.id, pr.prNumber, "APPROVE")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-7 px-3 text-xs gap-1 shadow-xs"
                              >
                                <FileCheck className="h-3 w-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenActionModal(pr.id, pr.prNumber, "REJECT")}
                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full h-7 px-3 text-xs gap-1 border-red-200 dark:border-red-900"
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </Button>
                            </>
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

      {/* Modal Buat PR Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0088ff]" />
                {editingPrId ? "Edit Purchase Request" : "Buat Purchase Request Baru"}
              </h3>
              <p className="text-xs text-[#8a94a6]">
                Isi rincian pengajuan barang yang dibutuhkan oleh divisi Anda.
              </p>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-xs">
              {/* Jenis Pengadaan Segmented Control */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Jenis Pengadaan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRequestType("FOR_RESALE")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      requestType === "FOR_RESALE"
                        ? "bg-white dark:bg-slate-800 text-[#0088ff] shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Barang Dagang (Stok Gudang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType("INTERNAL_USE")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      requestType === "INTERNAL_USE"
                        ? "bg-white dark:bg-slate-800 text-purple-500 shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Penggunaan Internal (OPEX Cabang)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cabang Pemohon
                  </label>
                  <SearchableSelect
                    value={branchId}
                    onChange={setBranchId}
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder="-- Pilih Cabang (Opsional) --"
                    disabled={!editingPrId && !!permission.branchId}
                  />
                  {!editingPrId && !!permission.branchId && (
                    <p className="text-[10px] text-[#8a94a6]">
                      Mengikuti cabang akun Anda saat ini.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Divisi / Department <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={department}
                    onChange={setDepartment}
                    options={departments.map((d) => ({ value: d.name, label: `${d.name} (${d.code})` }))}
                    placeholder="-- Pilih Departemen --"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Daftar Produk Diminta
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
                        value={item.qtyRequested}
                        onChange={(e) =>
                          handleItemChange(idx, "qtyRequested", Number(e.target.value))
                        }
                        placeholder="Qty"
                        className="w-20 h-8 text-center rounded-lg text-xs"
                        required
                      />

                      <Input
                        type="number"
                        value={item.unitCost}
                        onChange={(e) =>
                          handleItemChange(idx, "unitCost", Number(e.target.value))
                        }
                        placeholder="Estimasi Harga"
                        className="w-28 h-8 text-right rounded-lg text-xs"
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
                  className="rounded-full px-4 h-9 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => handleSave("DRAFT")}
                  className="rounded-full px-5 h-9 text-xs font-medium border-[#e6e9f0] dark:border-slate-800"
                >
                  {isSaving ? "Menyimpan..." : editingPrId ? "Simpan Perubahan" : "Simpan Draft"}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSave("SUBMITTED")}
                  className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 h-9 font-semibold text-xs shadow-md shadow-blue-500/20"
                >
                  {isSaving ? "Menyimpan..." : "Simpan & Submit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        title={
          confirmModal.actionType === "SUBMIT"
            ? "Submit Purchase Request"
            : confirmModal.actionType === "APPROVE"
            ? "Setujui Purchase Request"
            : confirmModal.actionType === "REJECT"
            ? "Tolak Purchase Request"
            : "Batalkan Purchase Request"
        }
        description={
          confirmModal.actionType === "SUBMIT"
            ? `Ajukan Purchase Request ${confirmModal.prNumber} ke Manager / Tim Pengadaan untuk ditinjau?`
            : confirmModal.actionType === "APPROVE"
            ? `Setujui Purchase Request ${confirmModal.prNumber} agar dapat diproses menjadi Purchase Order (PO)?`
            : confirmModal.actionType === "REJECT"
            ? `Tolak pengajuan Purchase Request ${confirmModal.prNumber}? Status akan berubah menjadi Rejected.`
            : `Batalkan pengajuan Purchase Request ${confirmModal.prNumber}? Dokumen DRAFT ini akan dibatalkan.`
        }
        confirmText={
          confirmModal.actionType === "SUBMIT"
            ? "Ya, Submit PR"
            : confirmModal.actionType === "APPROVE"
            ? "Ya, Setujui PR"
            : confirmModal.actionType === "REJECT"
            ? "Ya, Tolak PR"
            : "Ya, Batalkan PR"
        }
        variant={
          confirmModal.actionType === "SUBMIT"
            ? "primary"
            : confirmModal.actionType === "APPROVE"
            ? "success"
            : "danger"
        }
        isLoading={confirmModal.isLoading}
        requireReason={confirmModal.actionType === "REJECT" || confirmModal.actionType === "CANCEL"}
        reasonLabel={confirmModal.actionType === "REJECT" ? "Alasan Penolakan" : "Alasan Pembatalan"}
        reasonValue={actionReason}
        onReasonChange={setActionReason}
      />
      {/* Document Print & Detail Modal */}
      {printDoc && (
        <DocumentPrintModal
          isOpen={!!printDoc}
          onClose={() => setPrintDoc(null)}
          type="PR"
          documentNumber={printDoc.prNumber}
          date={printDoc.createdAt ? new Date(printDoc.createdAt).toLocaleDateString("id-ID") : "-"}
          partyName={`Departemen: ${printDoc.department || "Internal"}`}
          notes={printDoc.notes}
          status={printDoc.status}
          items={printDoc.items ? printDoc.items.map((i: any) => ({
            productName: i.productName || "Produk",
            productSku: i.productSku || "",
            qty: i.qtyRequested || 1,
            unitPrice: i.unitCost || 0,
            subtotal: (i.qtyRequested || 1) * (i.unitCost || 0),
          })) : []}
          subtotalAmount={printDoc.estimatedAmount ? printDoc.estimatedAmount / 1.11 : 0}
          taxAmount={printDoc.estimatedAmount ? printDoc.estimatedAmount - (printDoc.estimatedAmount / 1.11) : 0}
          totalAmount={printDoc.estimatedAmount || 0}
        />
      )}
    </div>
  );
}
