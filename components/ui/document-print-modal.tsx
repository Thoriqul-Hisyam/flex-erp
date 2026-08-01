"use client";

import * as React from "react";
import { Printer, Eye, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { usePermission } from "@/lib/auth/use-permission";

export interface PrintableDocumentProps {
  isOpen: boolean;
  onClose: () => void;
  type: "PR" | "PO" | "RECEIPT" | "SQ" | "SO" | "DO" | "INVOICE";
  documentNumber: string;
  date: string;
  companyName?: string;
  branchName?: string;
  tenantCode?: string;
  logoUrl?: string;
  partyName: string; // Customer or Supplier
  partyCode?: string;
  warehouseName?: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  status?: string;
  items: Array<{
    productName: string;
    productSku?: string;
    qty: number;
    unitPrice?: number;
    subtotal?: number;
  }>;
  subtotalAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
}

const DOCUMENT_TITLES: Record<string, string> = {
  PR: "PURCHASE REQUEST (PERMINTAAN PEMBELIAN)",
  PO: "PURCHASE ORDER (PESANAN PEMBELIAN)",
  RECEIPT: "SURAT PENERIMAAN BARANG (GOODS RECEIPT)",
  SQ: "SALES QUOTATION (PENAWARAN HARGA)",
  SO: "SALES ORDER (PESANAN PENJUALAN)",
  DO: "SURAT JALAN (DELIVERY ORDER)",
  INVOICE: "FAKTUR PENJUALAN (CUSTOMER INVOICE)",
};

export function DocumentPrintModal({
  isOpen,
  onClose,
  type,
  documentNumber,
  date,
  companyName,
  branchName,
  tenantCode,
  logoUrl,
  partyName,
  partyCode,
  warehouseName,
  driverName,
  vehiclePlate,
  notes,
  status,
  items = [],
  subtotalAmount = 0,
  taxAmount = 0,
  totalAmount = 0,
}: PrintableDocumentProps) {
  const permission = usePermission("dashboard");

  if (!isOpen) return null;

  const displayCompany = companyName || permission.companyName || "FLEX ERP";
  const displayBranch = branchName || permission.branchName || "Kantor Utama";
  const displayTenant = tenantCode || permission.tenantCode || "FLEX-ERP";
  const displayLogo = logoUrl || permission.companyLogoUrl;

  const handlePrint = () => {
    window.print();
  };

  const title = DOCUMENT_TITLES[type] || "DOKUMEN RESMI";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 rounded-[28px] max-w-3xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 my-8 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header Controls (Hidden during print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#0088ff] flex items-center justify-center font-bold">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a] dark:text-white">
                Detail & Cetak Dokumen Resmi
              </h3>
              <p className="text-xs text-[#8a94a6]">
                {documentNumber} • {title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-4 h-9 font-semibold text-xs gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Printer className="h-4 w-4" /> Cetak Dokumen (PDF)
            </Button>
            <button
              onClick={onClose}
              className="p-2 text-[#8a94a6] hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE SHEET CONTAINER */}
        <div className="bg-white text-slate-900 p-8 rounded-2xl border border-slate-200 shadow-xs print:border-none print:p-0 print:shadow-none font-sans space-y-6">
          {/* Header Kop Surat - Tenant DB Logo Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3.5">
              {/* Tenant Logo Image from Database (site_settings.logo_url) */}
              <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0">
                <img
                  src={displayLogo || "/logo/logo.png"}
                  alt={displayCompany}
                  onError={(e) => {
                    // Fallback to logo.png if /logo/logo.png path fails
                    (e.currentTarget as HTMLImageElement).src = "/logo.png";
                  }}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  {displayCompany}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {displayBranch}
                </p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-sm font-extrabold text-[#0088ff] tracking-wide uppercase">
                {title}
              </h2>
              <div className="text-base font-bold font-mono text-slate-900 mt-1">
                {documentNumber}
              </div>
              <div className="text-xs text-slate-500 font-medium">Tanggal: {date}</div>
            </div>
          </div>

          {/* Party & Warehouse Information Grid */}
          <div className="grid grid-cols-2 gap-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {type === "PO" || type === "RECEIPT" ? "Pemasok / Supplier:" : "Kepada / Customer:"}
              </div>
              <div className="font-bold text-sm text-slate-900">{partyName}</div>
              {partyCode && <div className="text-slate-600 font-mono">Kode: {partyCode}</div>}
              {notes && <div className="text-slate-500 mt-1 italic">Catatan: {notes}</div>}
            </div>

            <div className="text-right space-y-1">
              {warehouseName && (
                <div>
                  <span className="text-slate-500 font-medium">Gudang: </span>
                  <span className="font-bold text-slate-900">{warehouseName}</span>
                </div>
              )}
              {driverName && (
                <div>
                  <span className="text-slate-500 font-medium">Supir Pengirim: </span>
                  <span className="font-bold text-slate-900">{driverName}</span>
                </div>
              )}
              {vehiclePlate && (
                <div>
                  <span className="text-slate-500 font-medium">Armada / Plat No: </span>
                  <span className="font-mono font-bold text-slate-900">{vehiclePlate}</span>
                </div>
              )}
              {status && (
                <div className="mt-2">
                  <span className="inline-block bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                    STATUS: {status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">No</th>
                  <th className="p-3">Deskripsi Barang / Produk</th>
                  <th className="p-3 text-center w-24">Jumlah (Qty)</th>
                  {type !== "DO" && type !== "RECEIPT" && (
                    <>
                      <th className="p-3 text-right w-32">Harga Satuan</th>
                      <th className="p-3 text-right w-36">Subtotal</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Tidak ada rincian item.
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-mono font-semibold text-slate-500">
                        {i + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        {item.productSku && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            SKU: {item.productSku}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold font-mono text-slate-900">
                        {formatNumber(item.qty)} Pcs
                      </td>
                      {type !== "DO" && type !== "RECEIPT" && (
                        <>
                          <td className="p-3 text-right font-mono text-slate-700">
                            {formatCurrency(item.unitPrice || 0)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.subtotal || item.qty * (item.unitPrice || 0))}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          {type !== "DO" && type !== "RECEIPT" && (
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                {subtotalAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{formatCurrency(subtotalAmount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>PPN (11%):</span>
                    <span className="font-mono font-semibold">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-1.5 mt-1">
                  <span>Total Akhir:</span>
                  <span className="font-mono text-[#0088ff]">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Official Signatures Grid */}
          <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs text-slate-600 font-medium">
            <div>
              <p>Dibuat Oleh,</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                ( Administrasi )
              </p>
            </div>
            <div>
              <p>Disetujui Oleh,</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                ( Manajer Operasional )
              </p>
            </div>
            <div>
              <p>Diterima Oleh,</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                ( {partyName} )
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
