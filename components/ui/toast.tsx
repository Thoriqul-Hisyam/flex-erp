"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Trash2, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "info" | "delete" | "warning" | "error";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastMessage = {
      id,
      duration: 4000,
      ...toast,
    };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, newToast.duration);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container (Top Center) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-5 w-full ${
              t.type === "success"
                ? "bg-[#e6f9f0] dark:bg-emerald-950/90 border-[#10b981]/40 text-emerald-950 dark:text-emerald-100"
                : t.type === "info"
                ? "bg-[#f0f7ff] dark:bg-blue-950/90 border-[#0088ff]/40 text-blue-950 dark:text-blue-100"
                : t.type === "delete" || t.type === "error"
                ? "bg-[#ffeef0] dark:bg-rose-950/90 border-[#ef4444]/40 text-rose-950 dark:text-rose-100"
                : "bg-[#fffbea] dark:bg-amber-950/90 border-[#f59e0b]/40 text-amber-950 dark:text-amber-100"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-[#10b981]" />}
              {t.type === "info" && <CheckCircle2 className="h-5 w-5 text-[#0088ff]" />}
              {(t.type === "delete" || t.type === "error") && <Trash2 className="h-5 w-5 text-[#ef4444]" />}
              {t.type === "warning" && <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold leading-tight">{t.title}</h4>
              {t.message && <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{t.message}</p>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-0.5 rounded-full cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
