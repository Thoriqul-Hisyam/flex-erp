"use client";

import * as React from "react";
import { ArrowLeftRight, RefreshCw, Truck, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchStockMovementsAction,
  postTransferAction,
} from "@/app/actions/inventory-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatNumber } from "@/lib/utils";

interface Transfer {
  id: string;
  productName: string;
  productSku: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  qty: number;
  beforeQty: number;
  afterQty: number;
  createdAt: string;
}

export default function StockTransfersPage() {
  const permission = usePermission("inv_transfers");
  const { showToast } = useToast();
  const canEdit = permission.isSuperAdmin || permission.canCreate;

  const [movements, setMovements] = React.useState<Transfer[]>([]);
  const [products, setProducts] = React.useState<
    { id: string; name: string; sku: string }[]
  >([]);
  const [warehouses, setWarehouses] = React.useState<
    { id: string; name: string }[]
  >([]);

  const [productId, setProductId] = React.useState("");
  const [fromWarehouseId, setFromWarehouseId] = React.useState("");
  const [toWarehouseId, setToWarehouseId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [isPosting, setIsPosting] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetchStockMovementsAction();
    if (res.success && Array.isArray(res.data)) {
      setMovements(
        res.data
          .filter((m: any) => m.type === "TRANSFER_OUT")
          .map((m: any) => ({
            id: m.id,
            productName: m.productName,
            productSku: m.productSku,
            fromWarehouseName: m.fromWarehouseName,
            toWarehouseName: m.toWarehouseName,
            qty: m.qty,
            beforeQty: m.beforeQty,
            afterQty: m.afterQty,
            createdAt: m.createdAt,
          })),
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
    return <UnauthorizedCard pageName="Stock Transfers" roleName={permission.roleName} />;
  }

  const handleTransfer = async () => {
    if (
      !productId ||
      !fromWarehouseId ||
      !toWarehouseId ||
      !qty ||
      Number(qty) <= 0
    ) {
      showToast({
        type: "error",
        title: "Data Belum Lengkap",
        message:
          "Pilih produk, gudang asal, gudang tujuan, dan qty lebih dari 0.",
      });
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      showToast({
        type: "error",
        title: "Gudang Sama",
        message: "Gudang asal dan tujuan tidak boleh sama.",
      });
      return;
    }
    setIsPosting(true);
    const res = await postTransferAction({
      productId,
      fromWarehouseId,
      toWarehouseId,
      qty: Number(qty),
    });
    setIsPosting(false);
    if (res.success) {
      showToast({
        type: "success",
        title: "Transfer Berhasil",
        message: `Stock dipindahkan (${formatNumber(res.data.out.qty)} unit).`,
      });
      setQty("");
      load();
    } else {
      showToast({
        type: "error",
        title: "Gagal",
        message: res.error || "Gagal melakukan transfer.",
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
            <span>Stock Transfers</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-[#0088ff]" />
            Inter-Warehouse Stock Transfer
          </h1>
          <p className="text-xs text-[#8a94a6]">
            Move stock between warehouses in a single atomic ledger transaction.
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
        {/* Transfer Form */}
        <div className="lg:col-span-1 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs h-fit">
          <h2 className="text-sm font-bold text-[#0f172a] dark:text-white mb-4 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-[#0088ff]" />
            New Transfer Request
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                Product
              </label>
              <SearchableSelect
                value={productId}
                onChange={setProductId}
                options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                placeholder="-- Select product --"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                From Warehouse
              </label>
              <SearchableSelect
                value={fromWarehouseId}
                onChange={setFromWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="-- Select source --"
              />
            </div>
            <div className="flex items-center justify-center text-[#8a94a6]">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8a94a6]">
                To Warehouse
              </label>
              <SearchableSelect
                value={toWarehouseId}
                onChange={setToWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="-- Select destination --"
              />
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
            <Button
              onClick={handleTransfer}
              disabled={isPosting || !canEdit}
              className="w-full rounded-xl bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold gap-2"
            >
              <Truck className="h-4 w-4" />
              {isPosting ? "Transferring..." : "Execute Transfer"}
            </Button>
            {!canEdit && (
              <p className="text-[10px] text-rose-500 text-center">
                Anda tidak memiliki izin untuk melakukan transfer.
              </p>
            )}
          </div>
        </div>

        {/* Recent Transfers */}
        <div className="lg:col-span-2 bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e6e9f0] dark:border-slate-800">
            <h2 className="text-sm font-bold text-[#0f172a] dark:text-white">
              Recent Transfers
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fc] dark:bg-[#1e293b] text-[#8a94a6]">
                <tr className="border-b border-[#e6e9f0] dark:border-slate-800">
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Route</th>
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
                      colSpan={5}
                      className="py-14 text-center text-[#8a94a6]"
                    >
                      <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />{" "}
                      Belum ada transfer.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0f172a] dark:text-slate-200">
                          {m.productName}
                        </div>
                        <div className="text-[10px] text-[#0088ff] font-mono">
                          {m.productSku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span>{m.fromWarehouseName || "-"}</span>
                          <ArrowLeftRight className="h-3.5 w-3.5 text-[#0088ff]" />
                          <span>{m.toWarehouseName || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0f172a] dark:text-white font-mono-num">
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
