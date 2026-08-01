"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: ModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div
        className={cn(
          "relative z-10 w-full rounded-2xl border border-[#e6e9f0] dark:border-slate-700/60 bg-white dark:bg-[#161b26] shadow-2xl dark:shadow-black/40 transition-all animate-in fade-in-0 zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]",
          maxWidthClasses
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f2f7] dark:border-slate-700/50 px-6 py-4 shrink-0 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent">
          <div>
            <h2 className="text-sm font-bold text-[#0f172a] dark:text-white tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[11px] text-[#8a94a6] dark:text-slate-400">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#8a94a6] hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
