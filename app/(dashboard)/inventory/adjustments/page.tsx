"use client";

import * as React from "react";
import { Plus, Minus, ClipboardPlus, RefreshCw, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import {
  fetchStockMovementsAction,
  postAdjustmentAction,
} from "@/app/actions/inventory-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatNumber } from "@/lib/utils";

interface Adj {
  id: string;
  type: string;
  productName: string;
  productSku: string;
  warehouseName?: string;
  qty: number;
  beforeQty: number;
  afterQty: number;
  note?: string;
  createdAt: string;
}

export default function StockAdjustmentsPage() {
  const permission = usePermission("inv_adjustments");
  const { showToast } = useToast();
  const canEdit = permission.isSuperAdmin || permission.canCreate;

  const [movements, setMovements] = React.useState<Adj[]>([]);
  const [products, setProducts] = React.useState<
    { id: string; name: string; sku: string }[]
  >([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string }[]
  >([]);

  const [productId, setProductId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [direction, setDirection] = React.useState<"add" | "subtract">("add");
  const [isPosting, setIsPosting] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetchStockMovementsAction();
    if (res.success && Array.isArray(res.data)) {
      setMovements(
        res.data.filter(
          (m: any) =>
            m.type === "ADJUSTMENT_ADD" || m.type === "ADJUSTMENT_SUBTRACT",
        ),
      );
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    fetchRecordsAction("Product").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setProducts(
          r.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || p.code,
          })),
        );
      }
    });
    fetchRecordsAction("Warehouse").then((r) => {
      if (r.success && Array.isArray(r.data)) {
        setWarehouses(
          r.data.map((w: any) => ({ id: w.id, name: w.name || w.code })),
        );
      }
    });
  }, []);

  if (
    !permission.isSuperAdmin &&
    !permission.canRead &&
    !permission.isLoading
  ) {
    return <UnauthorizedCard pageName="Stock Adjustments" roleName={permission.roleName} />;
  }

  const handlePost = async () => {
    if (!productId || !warehouseId || !qty || Number(qty) <= 0) {
      showToast({
        type: "error",
        title: "Data Belum Lengkap",
        message: "Pilih produk, gudang, dan isi qty lebih dari 0.",
      });
      return;
    }
    setIsPosting(true);
    const res = await postAdjustmentAction({
      productId,
      warehouseId,
      direction,
      qty: Number(qty),
      reason: reason || undefined,
    });
    setIsPosting(false);
    if (res.success) {
      showToast({
        type: "success",
        title: "Adjustment Diposting",
        message: `Saldo berubah dari ${res.data.beforeQty} → ${res.data.afterQty}.`,
      });
      setQty("");
      setReason("");
      load();
    } else {
      showToast({
        type: "error",
        title: "Gagal",
        message: res.error || "Gagal memposting adjustment.",
      });
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Inventory</span>
            <span>/</span>
            <span>Stock Adjustments</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <ClipboardPlus className="h-6 w-6 text-[#0088ff]" />
            Stock Count Adjustments
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Post manual stock additions/subtractions for stock opname
            corrections.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={load}
          className="rounded-full gap-2 shrink-0"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Adjustment Form */}
        <div className="lg:col-span-1 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs h-fit">
          <h2 className="text-sm font-bold text-[#0f172a] dark:text-white mb-4 flex items-center gap-2">
            {direction === "add" ? (
              <Plus className="h-4 w-4 text-emerald-600" />
            ) : (
              <Minus className="h-4 w-4 text-rose-600" />
            )}
            Post Adjustment
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">-- Select product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Warehouse
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">-- Select warehouse --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Direction
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDirection("add")}
                  className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    direction === "add"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white dark:bg-slate-900 border-[#e6e9f0] dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  onClick={() => setDirection("subtract")}
                  className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    direction === "subtract"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white dark:bg-slate-900 border-[#e6e9f0] dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  − Subtract
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Qty
              </label>
              <Input
                type="number"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Reason / Note (optional)
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Stock opname correction..."
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <Button
              onClick={handlePost}
              disabled={isPosting || !canEdit}
              className="w-full rounded-xl bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold gap-2"
            >
              {direction === "add" ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {isPosting ? "Posting..." : "Post Adjustment"}
            </Button>
            {!canEdit && (
              <p className="text-[10px] text-rose-500 text-center">
                Anda tidak memiliki izin untuk membuat adjustment.
              </p>
            )}
          </div>
        </div>

        {/* Recent Adjustments List */}
        <div className="lg:col-span-2 bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e6e9f0] dark:border-slate-800">
            <h2 className="text-sm font-bold text-[#0f172a] dark:text-white">
              Recent Adjustments
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fc] dark:bg-[#1e293b] text-[#8a94a6]">
                <tr className="border-b border-[#e6e9f0] dark:border-slate-800">
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Warehouse</th>
                  <th className="py-3 px-4 font-semibold text-right">Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Before → After
                  </th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60">
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-14 text-center text-[#8a94a6]"
                    >
                      <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />{" "}
                      Belum ada adjustment.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40"
                    >
                      <td className="py-3.5 px-4">
                        {m.type === "ADJUSTMENT_ADD" ? (
                          <Badge variant="success">Adj +</Badge>
                        ) : (
                          <Badge variant="destructive">Adj −</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0f172a] dark:text-slate-200">
                          {m.productName}
                        </div>
                        <div className="text-[10px] text-[#0088ff] font-mono">
                          {m.productSku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {m.warehouseName || "-"}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold font-mono-num ${m.type === "ADJUSTMENT_ADD" ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {m.type === "ADJUSTMENT_ADD" ? "+" : "−"}
                        {formatNumber(m.qty)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {formatNumber(m.beforeQty)} → {formatNumber(m.afterQty)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
