"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  MoreVertical,
  ChevronRight,
  Plus,
  Truck,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Clock,
  Boxes,
  Database,
  ShieldAlert,
  Building2,
  ShoppingCart,
  ShoppingBag,
  Landmark,
  UserCheck,
  Layers,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePermission } from "@/lib/auth/use-permission";

export default function PRDUVentraDashboardPage() {
  const permission = usePermission("dashboard");
  const displayName = permission.userName || "";
  const firstName = displayName.split(" ")[0];
  const displayCompany = permission.companyName || "";
  const displayBranch = permission.branchName || "";
  const displayTenant = permission.tenantCode || "";

  return (
    <div className="space-y-6">
      {/* Top Banner Row: Multi-Company Context Greeting + 3 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Welcome Greeting Block (4 cols) */}
        <div className="lg:col-span-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f0f7ff] dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#0088ff] dark:text-blue-400 border border-[#0088ff]/20">
              {displayTenant}
            </span>
            <span className="text-xs text-[#8a94a6] font-medium">
              Sistem ERP Terintegrasi
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            Selamat Datang, {firstName} !
          </h1>
          <p className="text-xs text-[#8a94a6]">
            {displayCompany} • {displayBranch} Overview
          </p>
        </div>

        {/* 3 KPI Summary Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Products & Master Items */}
          <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Total Products & Items
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#0088ff] to-cyan-400 flex items-center justify-center text-white shadow-xs">
                <Boxes className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  2.343 SKUs
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#10b981]">
                  <TrendingUp className="h-3 w-3" /> 35%
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                Across 4 Warehouses
              </span>
            </div>
          </div>

          {/* Card 2: Total Inventory Stock Value (in Rp) */}
          <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Nilai Stok Inventaris
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#8a2be2] to-indigo-400 flex items-center justify-center text-white shadow-xs">
                <Database className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {formatCurrency(20343900000)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#10b981]">
                  <TrendingUp className="h-3 w-3" /> 40%
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                FIFO Valuation Ledger
              </span>
            </div>
          </div>

          {/* Card 3: Low Stock & Expiration Alerts */}
          <div className="bg-white dark:bg-[#12161f] p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8a94a6]">
                Low Stock items
              </span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#00b4d8] to-teal-400 flex items-center justify-center text-white shadow-xs">
                <ShieldAlert className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono-num text-[#0f172a] dark:text-white">
                  103 Items
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#ef4444]">
                  <TrendingDown className="h-3 w-3" /> 50%
                </span>
              </div>
              <span className="text-[10px] text-[#8a94a6] font-medium">
                Reorder threshold reached
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Inventory Statistics Bar Chart & Sales Overview Arc */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inventory Statistics Bar Chart Card (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-6">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
                Inventory Statistics
              </h2>
              <p className="text-xs text-[#8a94a6]">
                Multi-Warehouse physical stock receipts vs dispatch ledgers
              </p>
            </div>

            <div className="flex items-center gap-5 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Stock in
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8a2be2]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Stock Out
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0088ff]" />
                <span className="text-[#0f172a] dark:text-slate-300">
                  Stock Value
                </span>
              </div>

              {/* Time Selector Dropdown */}
              <select className="bg-[#f8f9fc] dark:bg-slate-800 border border-[#e6e9f0] dark:border-slate-700 rounded-full px-3 py-1 text-xs text-[#0f172a] dark:text-slate-200 focus:outline-none cursor-pointer font-medium">
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Quarterly</option>
              </select>
            </div>
          </div>

          {/* Bar Chart Graphic Area */}
          <div className="relative h-64 w-full flex flex-col justify-end pt-10">
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between text-[11px] font-mono text-[#8a94a6] pointer-events-none pb-6">
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                40k
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                30k
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                20k
              </div>
              <div className="border-b border-dashed border-[#e6e9f0] dark:border-slate-800/80 pb-1">
                10k
              </div>
              <div className="pb-1">0k</div>
            </div>

            {/* Bars Data Items */}
            <div className="relative z-10 flex items-end justify-between pl-8 pr-2 h-48">
              {["Jan", "Feb", "Mar", "Apr", "May"].map((m) => (
                <div key={m} className="flex flex-col items-center gap-2 group">
                  <div className="flex items-end gap-1 h-36">
                    <div className="w-2.5 bg-[#f59e0b] rounded-full h-[45%]" />
                    <div className="w-2.5 bg-[#8a2be2] rounded-full h-[60%]" />
                    <div className="w-2.5 bg-[#0088ff]/30 rounded-full h-[50%]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#8a94a6]">
                    {m}
                  </span>
                </div>
              ))}

              {/* Jun - HIGHLIGHTED WITH TOOLTIP */}
              <div className="relative flex flex-col items-center gap-2 group">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl shadow-lg border border-[#e6e9f0] dark:border-slate-700 flex items-center gap-1.5 whitespace-nowrap z-20">
                  <span className="h-2 w-2 rounded-full bg-[#0088ff]" />
                  <div className="text-[10px] leading-tight">
                    <span className="text-[#8a94a6] block font-medium">
                      Stock value
                    </span>
                    <span className="font-bold text-[#0f172a] dark:text-white font-mono">
                      {formatCurrency(375340000)}
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-1 h-36">
                  <div className="w-2.5 bg-[#f59e0b] rounded-full h-[85%]" />
                  <div className="w-2.5 bg-[#8a2be2] rounded-full h-[60%]" />
                  <div className="w-7 bg-[#0088ff]/90 rounded-md h-[95%] shadow-md shadow-blue-500/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:10px_10px]" />
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#0f172a] dark:text-white">
                  Jun
                </span>
              </div>

              {["Jul", "Aug", "Sep"].map((m) => (
                <div key={m} className="flex flex-col items-center gap-2 group">
                  <div className="flex items-end gap-1 h-36">
                    <div className="w-2.5 bg-[#f59e0b] rounded-full h-[50%]" />
                    <div className="w-2.5 bg-[#8a2be2] rounded-full h-[65%]" />
                    <div className="w-2.5 bg-[#0088ff]/30 rounded-full h-[55%]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#8a94a6]">
                    {m}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales & Target Overview Half-Donut Gauge Card (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Sales Overview
            </h2>
            <button className="text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Half-Donut Gauge */}
          <div className="relative flex flex-col items-center justify-center my-4">
            <svg className="w-48 h-32" viewBox="0 0 100 65">
              <path
                d="M 10 55 A 40 40 0 0 1 90 55"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                className="text-slate-100 dark:text-slate-800"
              />
              <path
                d="M 10 55 A 40 40 0 0 1 78 25"
                fill="none"
                stroke="url(#gradient-sales)"
                strokeWidth="12"
                strokeDasharray="6 2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient
                  id="gradient-sales"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#0088ff" />
                  <stop offset="100%" stopColor="#00c4cc" />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute bottom-2 text-center">
              <div className="text-3xl font-extrabold font-mono-num text-[#0f172a] dark:text-white">
                71.3%
              </div>
              <div className="text-xs font-semibold text-[#8a94a6]">
                Sales Goal
              </div>
            </div>
          </div>

          {/* Bottom Split Metrics (in Rp) */}
          <div className="flex items-center justify-between border-t border-[#e6e9f0] dark:border-slate-800 pt-4">
            <div>
              <span className="text-[10px] text-[#8a94a6] font-medium block">
                Number of sales
              </span>
              <span className="text-sm font-bold font-mono-num text-[#0f172a] dark:text-white">
                1,233
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#8a94a6] font-medium block">
                Total Sales
              </span>
              <span className="text-sm font-bold font-mono-num text-[#0f172a] dark:text-white">
                {formatCurrency(152330000)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PRD Core Module Launchpad Grid */}
      <div className="bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Modul Utama Perusahaan
            </h2>
            <p className="text-xs text-[#8a94a6]">
              Navigasi langsung ke Master Data, Penjualan, Pembelian,
              Inventaris, Keuangan & Akuntansi
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-[#f0f7ff] dark:bg-blue-950/60 text-[#0088ff] dark:text-blue-400 px-3 py-1 rounded-full border border-[#0088ff]/20">
            Modul Lengkap
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
          <Link
            href="/master-data/companies"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <Building2 className="h-6 w-6 text-[#0088ff] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              Master Data
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              Perusahaan, Cabang & Produk
            </div>
          </Link>

          <Link
            href="/master-data/products"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <ShoppingCart className="h-6 w-6 text-[#10b981] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              Modul Penjualan
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              Penawaran → SO → Faktur
            </div>
          </Link>

          <Link
            href="/master-data/suppliers"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <ShoppingBag className="h-6 w-6 text-[#f59e0b] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              Pembelian
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              PR → RFQ → PO → Penerimaan
            </div>
          </Link>

          <Link
            href="/master-data/warehouses"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <Boxes className="h-6 w-6 text-[#8a2be2] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              Inventaris
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              Stok Masuk/Keluar & Opname
            </div>
          </Link>

          <Link
            href="/master-data/taxes"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <Landmark className="h-6 w-6 text-[#00b4d8] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              Keuangan & Buku Besar
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              Akun, Jurnal & Laba Rugi
            </div>
          </Link>

          <Link
            href="/master-data/customers"
            className="p-4 rounded-2xl bg-[#f8f9fc] dark:bg-slate-800/40 hover:bg-[#f0f7ff] dark:hover:bg-blue-950/40 border border-[#e6e9f0] dark:border-slate-800 transition-colors group"
          >
            <UserCheck className="h-6 w-6 text-[#ef4444] group-hover:scale-110 transition-transform mb-2" />
            <div className="text-xs font-bold text-[#0f172a] dark:text-white">
              CRM & SDM
            </div>
            <div className="text-[10px] text-[#8a94a6]">
              Pelanggan & Direktori Karyawan
            </div>
          </Link>
        </div>
      </div>

      {/* Bottom Row: 3 Equal Column Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Recent Activities Stream */}
        <div className="bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Aktivitas Terbaru
            </h2>
            <button className="text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#f0e6ff] dark:bg-purple-950/60 text-[#8a2be2] dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                  +
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Stok Ditambahkan
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    200 unit iPhone 15 Pro Max ditambahkan
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#8a94a6]">
                09:25 AM
              </span>
            </div>

            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#fff8e6] dark:bg-amber-950/60 text-[#f59e0b] dark:text-amber-400 flex items-center justify-center">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Pengiriman Diterima
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    Pengiriman dari Techsupplier Inc
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#8a94a6]">
                10:25 PM
              </span>
            </div>

            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#eef6ff] dark:bg-blue-950/60 text-[#0088ff] dark:text-blue-400 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Pesanan Diproses
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    Pesanan #1024 telah diproses
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#8a94a6]">
                12:25 PM
              </span>
            </div>

            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#e6fbfa] dark:bg-teal-950/60 text-[#10b981] dark:text-teal-400 flex items-center justify-center">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Retur Diproses
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    Retur #RMA1023 telah diproses
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-[#8a94a6]">
                02:25 AM
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Alerts & Notifications */}
        <div className="bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Peringatan & Notifikasi
            </h2>
            <button className="text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#ffeef0] dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/40 cursor-pointer hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#ffd6d6] dark:bg-rose-900/60 text-[#ef4444] dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                  !
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Peringatan Stok Habis
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    12 barang kehabisan stok
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </div>

            <div className="flex items-center justify-between bg-[#e6f9f0] dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 cursor-pointer hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#d1fae5] dark:bg-emerald-900/60 text-[#10b981] dark:text-emerald-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Segera Kadaluarsa
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    6 barang akan segera kadaluarsa
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </div>

            <div className="flex items-center justify-between bg-[#fffbea] dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-100 dark:border-amber-900/40 cursor-pointer hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#fef3c7] dark:bg-amber-900/60 text-[#f59e0b] dark:text-amber-400 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Peringatan Stok Menipis
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    48 barang stoknya menipis
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </div>

            <div className="flex items-center justify-between bg-[#f0f7ff] dark:bg-sky-950/30 p-3.5 rounded-2xl border border-sky-100 dark:border-sky-900/40 cursor-pointer hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#dbeafe] dark:bg-sky-900/60 text-[#0088ff] dark:text-sky-400 flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Pesanan Tertunda
                  </div>
                  <div className="text-[11px] text-[#8a94a6]">
                    24 pesanan menunggu diproses
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#8a94a6]" />
            </div>
          </div>
        </div>

        {/* Column 3: Top Product Recommendation */}
        <div className="bg-white dark:bg-[#12161f] p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
              Produk Terlaris
            </h2>
            <button className="text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-xl bg-white overflow-hidden p-1 shadow-xs border border-[#e6e9f0]">
                  <Image
                    src="/images/nordic_armchair.png"
                    alt="Nordic Accent Armchair"
                    fill
                    className="object-contain"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Nordic Accent Armchair
                  </div>
                  <div className="text-[10px] font-mono text-[#8a94a6]">
                    ID:RT15567663
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {formatCurrency(3100000)}
                </div>
                <div className="text-[10px] text-[#8a94a6] font-medium">
                  4 Pesanan
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-xl bg-white overflow-hidden p-1 shadow-xs border border-[#e6e9f0]">
                  <Image
                    src="/images/aeroflex_shoes.png"
                    alt="AeroFlex Running Shoes"
                    fill
                    className="object-contain"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    AeroFlex Running Shoes
                  </div>
                  <div className="text-[10px] font-mono text-[#8a94a6]">
                    ID:RT15266730
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {formatCurrency(3875000)}
                </div>
                <div className="text-[10px] text-[#8a94a6] font-medium">
                  2 Pesanan
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#f8f9fc] dark:bg-slate-800/40 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-xl bg-white overflow-hidden p-1 shadow-xs border border-[#e6e9f0]">
                  <Image
                    src="/images/jogger_pants.png"
                    alt="Rebel Ink Jogger Pants"
                    fill
                    className="object-contain"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a] dark:text-white">
                    Rebel Ink Jogger Pants
                  </div>
                  <div className="text-[10px] font-mono text-[#8a94a6]">
                    ID:RT15247890
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono-num text-[#0f172a] dark:text-white">
                  {formatCurrency(2325000)}
                </div>
                <div className="text-[10px] text-[#8a94a6] font-medium">
                  6 Pesanan
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
