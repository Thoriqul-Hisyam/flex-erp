"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "success" | "warning" | "danger";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  variant = "primary",
  isLoading = false,
}: ConfirmModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const variantStyles = {
    primary: {
      bgIcon: "bg-blue-50 dark:bg-blue-950/50 text-[#0088ff]",
      icon: HelpCircle,
      btnClass: "bg-[#0088ff] hover:bg-[#0077e6] text-white shadow-blue-500/20",
    },
    success: {
      bgIcon: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500",
      icon: CheckCircle2,
      btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
    },
    warning: {
      bgIcon: "bg-amber-50 dark:bg-amber-950/50 text-amber-500",
      icon: AlertTriangle,
      btnClass: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20",
    },
    danger: {
      bgIcon: "bg-red-50 dark:bg-red-950/50 text-red-500",
      icon: AlertTriangle,
      btnClass: "bg-red-600 hover:bg-red-700 text-white shadow-red-500/20",
    },
  }[variant];

  const IconComponent = variantStyles.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Dialog Box */}
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-[#12161f] p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${variantStyles.bgIcon}`}>
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 flex-1 pr-2">
            <h3 className="text-base font-bold text-[#0f172a] dark:text-white leading-snug">
              {title}
            </h3>
            <p className="text-xs text-[#8a94a6] leading-relaxed">
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-[#8a94a6] hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-full px-5 h-9 text-xs"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-full px-6 h-9 text-xs font-semibold shadow-md ${variantStyles.btnClass}`}
          >
            {isLoading ? "Memproses..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
