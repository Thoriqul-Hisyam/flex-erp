"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  MoreVertical,
  ChevronRight,
  Truck,
  AlertCircle,
  Clock,
  Boxes,
  Database,
  ShieldAlert,
  ShoppingCart,
  ShoppingBag,
  Layers,
  RefreshCw,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePermission } from "@/lib/auth/use-permission";
import { fetchDashboardMetricsAction } from "@/app/actions/dashboard-actions";

export default function PRDUVentraDashboardPage() {
  const permission = usePermission("dashboard");
  const displayName = permission.userName || "";
  const firstName = displayName.split(" ")[0];
  const displayCompany = permission.companyName || "";
  const displayBranch = permission.branchName || "";
  const displayTenant = permission.tenantCode || "";

  const [metrics, setMetrics] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeFilter, setTimeFilter] = React.useState<"Bulanan" | "Mingguan" | "Triwulan">("Bulanan");
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(5); // Default Jun

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchDashboardMetricsAction();
    if (res.success && res.data) {
      setMetrics(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const topProds = metrics?.topProducts || [];

  // Interactive Time Filter Datasets
  const monthlyData = metrics?.inventoryBarChart || [
    { month: "Jan", stockIn: 25000000, stockOut: 35000000 },
    { month: "Feb", stockIn: 30000000, stockOut: 38000000 },
    { month: "Mar", stockIn: 28000000, stockOut: 36000000 },
    { month: "Apr", stockIn: 32000000, stockOut: 40000000 },
    { month: "Mei", stockIn: 31000000, stockOut: 37000000 },
    { month: "Jun", stockIn: 65000000, stockOut: 42000000 },
    { month: "Jul", stockIn: 34000000, stockOut: 41000000 },
    { month: "Agu", stockIn: 33000000, stockOut: 39000000 },
    { month: "Sep", stockIn: 35000000, stockOut: 40000000 },
  ];

  const weeklyData = [
    { month: "M1", stockIn: 8000000, stockOut: 12000000, stockValuation: 125000000 },
    { month: "M2", stockIn: 12000000, stockOut: 9000000, stockValuation: 128000000 },
    { month: "M3", stockIn: 15000000, stockOut: 11000000, stockValuation: 132000000 },
    { month: "M4", stockIn: 18000000, stockOut: 14000000, stockValuation: 136000000 },
    { month: "M5", stockIn: 14000000, stockOut: 16000000, stockValuation: 134000000 },
    { month: "M6", stockIn: 22000000, stockOut: 18000000, stockValuation: 138000000 },
    { month: "M7", stockIn: 19000000, stockOut: 15000000, stockValuation: 142000000 },
    { month: "M8", stockIn: 25000000, stockOut: 20000000, stockValuation: 147000000 },
  ];

  const quarterlyData = [
    { month: "Q1", stockIn: 83000000, stockOut: 109000000, stockValuation: 110000000 },
    { month: "Q2", stockIn: 128000000, stockOut: 119000000, stockValuation: 125000000 },
    { month: "Q3", stockIn: 102000000, stockOut: 120000000, stockValuation: 138000000 },
    { month: "Q4", stockIn: 115000000, stockOut: 130000000, stockValuation: 150000000 },
  ];

  const activeBarData =
    timeFilter === "Mingguan"
      ? weeklyData
      : timeFilter === "Triwulan"
      ? quarterlyData
      : monthlyData;

  const maxVal = Math.max(
    ...activeBarData.map((b: any) => Math.max(b.stockIn || 0, b.stockOut || 0)),
    100000
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Row: Multi-Company Context Greeting + 3 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Welcome Greeting Block (4 cols) */}
        <div className="lg:col-span-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f0f7ff] dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#0088ff] dark:text-blue-400 border border-[#0088ff]/20">
              {displayTenant || "FLEX-ERP"}
            </span>
            <span className="text-xs text-[#8a94a6] font-medium">
              Portal Perusahaan
            </span>
            <button
              onClick={load}
              title="Perbarui Data Dashboard"
              className="ml-auto p-1 rounded-full text-[#8a94a6] hover:text-[#0088ff] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#0088ff]" : ""}`} />
            </button>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            Selamat Datang, {firstName || "Pengguna"} !
          </h1>
          <p className="text-xs text-[#8a94a6]">
            {displayCompany} • Ringkasan {displayBranch}
          </p>
        </div>

        {/* 3 KPI Summary Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Products & Master Items */}
          <Link
            href="/master-data/products"
            className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 transition-all border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Total Jenis Barang
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#0088ff] to-cyan-400 flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
                <Boxes className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {isLoading ? "..." : `${metrics?.productsCount || 0} Barang`}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#10b981]">
                  <TrendingUp className="h-3 w-3" /> Aktif
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                Tersebar di {metrics?.warehousesCount || 1} Gudang
              </span>
            </div>
          </Link>

          {/* Card 2: Total Inventory Stock Value */}
          <Link
            href="/inventory/stocks"
            className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 transition-all border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Total Nilai Barang Gudang
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#8a2be2] to-indigo-400 flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
                <Database className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {isLoading ? "..." : formatCurrency(metrics?.totalStockValuation || 0)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#10b981]">
                  <TrendingUp className="h-3 w-3" /> Real-time
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                Akumulasi Nilai Persediaan
              </span>
            </div>
          </Link>

          {/* Card 3: Low Stock Alerts */}
          <Link
            href="/inventory/stocks"
            className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 transition-all border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Stok Menipis / Perlu Diisi
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#00b4d8] to-teal-400 flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
                <ShieldAlert className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {isLoading ? "..." : `${metrics?.lowStockCount || 0} Barang`}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#ef4444]">
                  <AlertCircle className="h-3 w-3" /> Perhatian
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                Stok di bawah batas minimal
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Middle Row: Inventory Statistics Bar Chart & Sales Overview Arc */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inventory Statistics Bar Chart Card (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-6">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                Statistik Persediaan Barang
              </h2>
              <p className="text-xs text-[#8a94a6]">
                Arahkan kursor pada batang grafik untuk melihat rincian barang masuk & keluar
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Barang Masuk
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8a2be2]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Barang Keluar
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0088ff]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Nilai Persediaan
                </span>
              </div>

              {/* Time Selector Dropdown - FULLY INTERACTIVE */}
              <select
                value={timeFilter}
                onChange={(e: any) => {
                  setTimeFilter(e.target.value);
                  setHoveredBarIndex(0);
                }}
                className="bg-[#f8f9fc] dark:bg-slate-800 border border-[#e6e9f0] dark:border-slate-700 rounded-full px-3 py-1.5 text-xs text-[#0088ff] font-bold focus:outline-none cursor-pointer shadow-xs transition-all hover:bg-blue-50 dark:hover:bg-slate-700"
              >
                <option value="Bulanan">Bulanan</option>
                <option value="Mingguan">Mingguan</option>
                <option value="Triwulan">Triwulan</option>
              </select>
            </div>
          </div>

          {/* Bar Chart Graphic Area */}
          <div className="relative h-64 w-full flex flex-col justify-end pt-10">
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-mono text-[#8a94a6] pointer-events-none pb-6">
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                Rp 100 Jt
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                Rp 75 Jt
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                Rp 50 Jt
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                Rp 25 Jt
              </div>
              <div className="pb-1">Rp 0</div>
            </div>

            {/* Bars Data Items - INTERACTIVE HOVER ON EVERY SINGLE ITEM */}
            <div className="relative z-10 flex items-end justify-between pl-12 pr-2 h-48">
              {activeBarData.map((item: any, idx: number) => {
                const isSelected = hoveredBarIndex === idx;
                const inPct = Math.min(Math.round(((item.stockIn || 0) / maxVal) * 80) + 15, 95);
                const outPct = Math.min(Math.round(((item.stockOut || 0) / maxVal) * 80) + 20, 95);

                return (
                  <div
                    key={item.month}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    className="relative flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    {/* Floating Glassmorphism Tooltip Card */}
                    {isSelected && (
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-xs px-3 py-2 rounded-2xl shadow-2xl border border-slate-700/60 text-white text-[10px] space-y-0.5 whitespace-nowrap z-30 animate-in fade-in zoom-in-95">
                        <div className="font-bold text-blue-400 font-mono flex items-center gap-1 border-b border-slate-700/80 pb-0.5 mb-0.5">
                          <span>{item.month} ({timeFilter})</span>
                        </div>
                        <div className="flex justify-between gap-3 text-amber-300">
                          <span>Masuk:</span>
                          <span className="font-mono font-bold">{formatCurrency(item.stockIn || 0)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-purple-300">
                          <span>Keluar:</span>
                          <span className="font-mono font-bold">{formatCurrency(item.stockOut || 0)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-blue-300">
                          <span>Nilai Gudang:</span>
                          <span className="font-mono font-bold">{formatCurrency(item.stockValuation || metrics?.totalStockValuation || 0)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-end gap-1 h-36">
                      <div
                        className={`w-2.5 bg-[#f59e0b] rounded-full transition-all duration-300 ${
                          isSelected ? "scale-y-105 shadow-md shadow-amber-500/40" : "opacity-80"
                        }`}
                        style={{ height: `${inPct}%` }}
                      />
                      <div
                        className={`w-2.5 bg-[#8a2be2] rounded-full transition-all duration-300 ${
                          isSelected ? "scale-y-105 shadow-md shadow-purple-500/40" : "opacity-80"
                        }`}
                        style={{ height: `${outPct}%` }}
                      />
                      <div
                        className={`transition-all duration-300 rounded-md ${
                          isSelected
                            ? "w-6 bg-[#0088ff] h-[95%] shadow-lg shadow-blue-500/40 relative overflow-hidden"
                            : "w-2.5 bg-[#0088ff]/40 h-[50%]"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:10px_10px]" />
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] transition-colors ${
                        isSelected
                          ? "font-bold text-[#0088ff] dark:text-blue-400"
                          : "font-medium text-[#8a94a6] group-hover:text-slate-900 dark:group-hover:text-white"
                      }`}
                    >
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sales & Target Overview Half-Donut Gauge Card (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between group hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Ringkasan Penjualan
            </h2>
            <Link href="/sales/orders" className="text-[#8a94a6] hover:text-[#0088ff]">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Half-Donut Gauge - PERFECT FIT WITH ZERO OVERLAP */}
          <div className="relative flex flex-col items-center justify-center my-4 cursor-pointer">
            <svg className="w-52 h-32 transition-transform group-hover:scale-105" viewBox="0 0 100 60">
              {/* Gray Track Arc */}
              <path
                d="M 10 52 A 40 40 0 0 1 90 52"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                className="text-slate-100 dark:text-slate-800"
              />
              {/* Full 100% Blue Active Arc */}
              <path
                d="M 10 52 A 40 40 0 0 1 90 52"
                fill="none"
                stroke="url(#blue-gradient)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="blue-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0088ff" />
                  <stop offset="100%" stopColor="#00d2ff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute top-9 text-center px-4">
              <div className="text-3xl font-extrabold text-[#0f172a] dark:text-white font-mono-num leading-none">
                100%
              </div>
              <div className="text-[9px] text-[#8a94a6] font-semibold uppercase tracking-wider mt-1 whitespace-nowrap">
                Target Penjualan Tercapai
              </div>
            </div>
          </div>

          {/* Profit Stat Bottom Banner */}
          <div className="bg-[#f8f9fc] dark:bg-slate-800/50 p-3.5 rounded-2xl border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#8a94a6] font-semibold uppercase">
                Total Omset Penjualan
              </div>
              <div className="text-base font-bold text-[#0f172a] dark:text-white font-mono-num">
                {isLoading ? "..." : formatCurrency(metrics?.salesRevenue || 0)}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#10b981] bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
              <TrendingUp className="h-3.5 w-3.5" /> +100% Target
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Operational Action Grid + Priority Alerts + Top Product Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Log Aktivitas Transaksi Terbaru Feed */}
        <div className="lg:col-span-4 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Aktivitas Transaksi Terbaru
            </h2>
            <Link href="/sales/orders" className="text-[#8a94a6] hover:text-[#0088ff]">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-[#8a94a6]">Memuat aktivitas...</div>
            ) : (metrics?.recentSos?.length === 0 && metrics?.recentMovements?.length === 0) ? (
              <div className="p-4 text-center text-xs text-[#8a94a6]">Belum ada aktivitas transaksi.</div>
            ) : (
              <>
                {metrics?.recentSos?.slice(0, 2).map((so: any) => (
                  <Link
                    key={so.id}
                    href="/sales/orders"
                    className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:scale-[1.01] hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#0088ff] flex items-center justify-center font-bold">
                        <ShoppingBag className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                          {so.soNumber}
                        </div>
                        <div className="text-[10px] text-[#8a94a6]">
                          {so.customerName || "Pelanggan Umum"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono-num text-[#0f172a] dark:text-white">
                        {formatCurrency(so.totalAmount || 0)}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        {so.status || "CONFIRMED"}
                      </div>
                    </div>
                  </Link>
                ))}

                {metrics?.recentMovements?.slice(0, 2).map((m: any) => (
                  <Link
                    key={m.id}
                    href="/inventory/stocks"
                    className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:scale-[1.01] hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold">
                        <Boxes className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                          {m.productName || "Mutasi Stok"}
                        </div>
                        <div className="text-[10px] text-[#8a94a6]">
                          {m.warehouseName || "Gudang Utama"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono-num text-purple-600">
                        {m.qty} Pcs
                      </div>
                      <div className="text-[10px] text-[#8a94a6]">
                        {m.type || "MUTASI"}
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Column 2: Priority Notifications */}
        <div className="lg:col-span-4 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Pemberitahuan Penting
            </h2>
            <button className="text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <Link
              href="/inventory/stocks"
              className="flex items-center justify-between bg-[#fff1f1] dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/40 cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#ffd6d6] dark:bg-rose-900/60 text-[#ef4444] dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                  !
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Stok Menipis / Perlu Diisi
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    {metrics?.lowStockCount || 0} barang perlu ditambah stok
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </Link>

            <Link
              href="/sales/orders"
              className="flex items-center justify-between bg-[#e6f9f0] dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#d1fae5] dark:bg-emerald-900/60 text-[#10b981] dark:text-emerald-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Pesanan Penjualan Terbit
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    {metrics?.salesOrdersCount || 0} pesanan berhasil diproses
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </Link>

            <Link
              href="/purchasing/requests"
              className="flex items-center justify-between bg-[#f0f7ff] dark:bg-sky-950/30 p-3.5 rounded-2xl border border-sky-100 dark:border-sky-900/40 cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#dbeafe] dark:bg-sky-900/60 text-[#0088ff] dark:text-sky-400 flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Permintaan Pembelian Barang
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    {metrics?.pendingPrCount || 0} pengajuan menunggu persetujuan
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </Link>
          </div>
        </div>

        {/* Column 3: Top Products List from DB */}
        <div className="lg:col-span-4 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Daftar Produk Unggulan
            </h2>
            <Link href="/master-data/products" className="text-[#8a94a6] hover:text-[#0088ff]">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-[#8a94a6]">Memuat produk...</div>
            ) : topProds.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8a94a6]">Belum ada produk master.</div>
            ) : (
              topProds.map((prod: any) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:scale-[1.01] hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#0088ff] flex items-center justify-center font-bold">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                        {prod.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#8a94a6]">
                        {prod.sku || prod.code}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono-num text-[#0f172a] dark:text-white">
                      {formatCurrency(prod.sellingPrice || 0)}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Aktif Master
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
