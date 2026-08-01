"use client";

import * as React from "react";
import { Lock, ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface UnauthorizedCardProps {
  pageName: string;
  roleName?: string;
}

export function UnauthorizedCard({ pageName, roleName = "Current User" }: UnauthorizedCardProps) {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto my-12 p-8 bg-white dark:bg-[#12161f] rounded-[26px] border border-red-500/20 shadow-xl shadow-red-500/5 space-y-6 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-500 shadow-md">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-500/20 font-mono">
          <Lock className="h-3 w-3" /> 403 AKSES DITOLAK
        </div>
        <h2 className="text-2xl font-bold text-[#0f172a] dark:text-white">
          Akses Terbatas ke Halaman {pageName}
        </h2>
        <p className="text-xs text-[#8a94a6] max-w-lg mx-auto leading-relaxed">
          Peran Anda saat ini <span className="font-semibold text-slate-700 dark:text-slate-200">({roleName})</span> belum memiliki hak akses untuk membuka halaman ini. Silakan hubungi Administrator Sistem jika Anda membutuhkan izin akses.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-4 border-t border-[#f0f2f7] dark:border-slate-800">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="rounded-full px-5 py-2 text-xs gap-1.5 border-slate-300 dark:border-slate-700 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </Button>
        <Button
          onClick={() => router.push("/")}
          className="bg-[#0088ff] hover:bg-[#0077e6] text-white rounded-full px-6 py-2 text-xs gap-1.5 shadow-md shadow-blue-500/20 font-semibold cursor-pointer"
        >
          <Home className="h-3.5 w-3.5" /> Beranda Utama
        </Button>
      </div>
    </div>
  );
}
