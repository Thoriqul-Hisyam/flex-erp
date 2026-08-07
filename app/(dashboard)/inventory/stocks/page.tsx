"use client";

import * as React from "react";
import {
  Boxes,
  PackageX,
  AlertTriangle,
  TrendingDown,
  Search,
  RefreshCw,
  Layers,
  Building2,
  Package,
  Warehouse,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/lib/auth/use-permission";
import { UnauthorizedCard } from "@/components/ui/unauthorized-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchWarehouseStocksAction } from "@/app/actions/inventory-actions";
import { fetchRecordsAction } from "@/app/actions/crud-actions";
import { formatCurrency, formatNumber, exportToCsv } from "@/lib/utils";

interface Stock {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseType?: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyIncoming: number;
  qtyAvailable: number;
  avgCost: number;
  stockValue: number;
  reorderLevel: number;
  status: string;
  lastMovementAt?: string;
}

export default function WarehouseStocksPage() {
  const permission = usePermission("inv_stocks");
  const [stocks, setStocks] = React.useState<Stock[]>([]);
  const [warehouses, setWarehouses] = React.useState<{ id: string; name: string }[]>([]);
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("ALL");
  const [typeTab, setTypeTab] = React.useState<"ALL_TYPES" | "COMMERCIAL" | "INTERNAL_OFFICE">("ALL_TYPES");
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async (whId?: string) => {
    setIsLoading(true);
    const res = await fetchWarehouseStocksAction(whId && whId !== "ALL" ? whId : undefined);
    if (res.success && Array.isArray(res.data)) {
      setStocks(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    fetchRecordsAction("Warehouse").then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setWarehouses(
          res.data.map((w: any) => ({ id: w.id, name: w.name || w.code })),
        );
      }
    });
  }, []);

  if (!permission.isSuperAdmin && !permission.canRead && !permission.isLoading) {
    return <UnauthorizedCard pageName="Stok Gudang" roleName={permission.roleName} />;
  }

  const filtered = stocks.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.productName.toLowerCase().includes(q) ||
      s.productSku.toLowerCase().includes(q) ||
      s.warehouseName.toLowerCase().includes(q);

    const matchesType =
      typeTab === "ALL_TYPES" ||
      (typeTab === "COMMERCIAL" && (s.warehouseType === "COMMERCIAL" || !s.warehouseType)) ||
      (typeTab === "INTERNAL_OFFICE" && s.warehouseType === "INTERNAL_OFFICE");

    return matchesSearch && matchesType;
  });

  const totalOnHand = filtered.reduce((a, s) => a + s.qtyOnHand, 0);
  const totalValue = filtered.reduce((a, s) => a + s.stockValue, 0);
  const lowStockCount = filtered.filter((s) => s.qtyOnHand <= s.reorderLevel).length;
  const skuCount = filtered.length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#12161f] p-5 rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8a94a6] text-xs">
            <span className="font-semibold text-[#0088ff]">Inventory</span>
            <span>/</span>
            <span>Warehouse Stocks</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#0088ff]" />
            Warehouse Stocks & Balances
          </h1>
          <p className="text-xs text-[#8a94a6]">Real-time stock-on-hand, reserved, incoming, and stock valuation per warehouse.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() =>
              exportToCsv("stock_balance", filtered, [
                { key: "productName", header: "Product" },
                { key: "productSku", header: "SKU" },
                { key: "warehouseName", header: "Warehouse" },
                { key: "qtyOnHand", header: "On Hand" },
                { key: "qtyReserved", header: "Reserved" },
                { key: "qtyAvailable", header: "Available" },
                { key: "qtyIncoming", header: "Incoming" },
                { key: "avgCost", header: "Avg Cost" },
                { key: "stockValue", header: "Stock Value" },
                { key: "reorderLevel", header: "Reorder Level" },
                { key: "status", header: "Status" },
              ])
            }
            className="rounded-full gap-2"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => load(warehouseFilter)}
            className="rounded-full gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Boxes, label: "Total SKU In Stock", value: formatNumber(skuCount), tone: "text-[#0088ff]" },
          { icon: Layers, label: "Total Qty On Hand", value: formatNumber(totalOnHand), tone: "text-emerald-600" },
          { icon: TrendingDown, label: "Stock Value", value: formatCurrency(totalValue), tone: "text-violet-600" },
          {
            icon: AlertTriangle,
            label: "Low Stock Items",
            value: formatNumber(lowStockCount),
            tone: lowStockCount > 0 ? "text-rose-600" : "text-slate-400",
            extra: <div>{lowStockCount > 0 ? <Badge variant="destructive">Perlu reorder</Badge> : <Badge variant="success">Aman</Badge>}</div>,
          },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <kpi.icon className={`h-5 w-5 ${kpi.tone}`} />
              {kpi.extra}
            </div>
            <div className="mt-2 text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">{kpi.value}</div>
            <div className="text-[11px] text-[#8a94a6] mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
        <button
          onClick={() => setTypeTab("ALL_TYPES")}
          className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            typeTab === "ALL_TYPES"
              ? "bg-white dark:bg-slate-800 text-[#0088ff] shadow-xs"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Layers className="h-4 w-4" />
          Semua Stok Persediaan
        </button>
        <button
          onClick={() => setTypeTab("COMMERCIAL")}
          className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            typeTab === "COMMERCIAL"
              ? "bg-white dark:bg-slate-800 text-[#0088ff] shadow-xs"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Package className="h-4 w-4 text-[#0088ff]" />
          Stok Barang Dagang (Gudang Logistik)
        </button>
        <button
          onClick={() => setTypeTab("INTERNAL_OFFICE")}
          className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            typeTab === "INTERNAL_OFFICE"
              ? "bg-white dark:bg-slate-800 text-purple-500 shadow-xs"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Building2 className="h-4 w-4 text-purple-500" />
          Stok Perlengkapan & Inventaris Kantor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#12161f] p-4 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name, SKU, or warehouse..."
            className="pl-10 rounded-full h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchableSelect
            value={warehouseFilter}
            onChange={(val) => {
              setWarehouseFilter(val);
              load(val);
            }}
            className="w-48"
            options={[
              { value: "ALL", label: "All Warehouses" },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#12161f] rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fc] dark:bg-[#1e293b] text-[#8a94a6]">
              <tr className="border-b border-[#e6e9f0] dark:border-slate-800">
                <th className="py-3 px-5 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-right">On Hand</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved</th>
                <th className="py-3 px-4 font-semibold text-right">Available</th>
                <th className="py-3 px-4 font-semibold text-right">Avg Cost</th>
                <th className="py-3 px-4 font-semibold text-right">Stock Value</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center text-[#8a94a6] animate-pulse">Loading stock balances...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#8a94a6]">
                    <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No stock balances found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isLow = s.qtyOnHand <= s.reorderLevel;
                  return (
                    <tr key={s.id} className="hover:bg-[#f8f9fc]/80 dark:hover:bg-[#1e293b]/40">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#0f172a] dark:text-slate-200">{s.productName}</div>
                        <div className="text-[10px] text-[#0088ff] font-mono">{s.productSku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 font-medium">
                          {s.warehouseType === "INTERNAL_OFFICE" ? (
                            <Building2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          ) : (
                            <Warehouse className="h-3.5 w-3.5 text-[#0088ff] shrink-0" />
                          )}
                          <span>{s.warehouseName}</span>
                        </div>
                        <Badge
                          variant={s.warehouseType === "INTERNAL_OFFICE" ? "secondary" : "default"}
                          className="rounded-full text-[9px] mt-1 gap-1 px-2 py-0.5"
                        >
                          {s.warehouseType === "INTERNAL_OFFICE" ? "Kantor & Cabang" : "Gudang Logistik"}
                        </Badge>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold font-mono-num ${isLow ? "text-rose-600 dark:text-rose-400" : "text-[#0f172a] dark:text-white"}`}>
                        {formatNumber(s.qtyOnHand)} <span className="text-[10px] font-normal text-[#8a94a6]">{s.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#8a94a6] font-mono">{formatNumber(s.qtyReserved)}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">{formatNumber(s.qtyAvailable)}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300">{formatCurrency(s.avgCost)}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(s.stockValue)}</td>
                      <td className="py-3.5 px-4 text-center">
                        {isLow ? (
                          <Badge variant="destructive">{s.qtyOnHand <= 0 ? "Out of Stock" : "Low Stock"}</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
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
    </div>
  );
}
