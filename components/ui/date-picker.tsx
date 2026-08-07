"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value: string; // "yyyy-MM-dd", matches native <input type="date"> value shape
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const PANEL_WIDTH = 256; // w-64

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Drop-in replacement for a native <input type="date"> with a calendar
 * popup styled to match this app's design system, instead of the browser's
 * inconsistent native date picker chrome.
 *
 * The calendar panel renders into a portal on document.body and is
 * positioned from the trigger button's viewport rect (see SearchableSelect
 * for the same pattern) - required because this control routinely lives
 * inside scrollable containers (modal item lists), which would otherwise
 * clip an in-flow `absolute` panel.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  disabled = false,
  min,
  max,
  className,
  id,
}: DatePickerProps) {
  const selected = parseDateOnly(value);
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(() => selected || new Date());
  const [rect, setRect] = React.useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const minDate = parseDateOnly(min || "");
  const maxDate = parseDateOnly(max || "");

  const updateRect = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight || 340;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < panelHeight && r.top > spaceBelow;
    const left = Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8);
    setRect({
      top: openUpward ? r.top : r.bottom,
      left: Math.max(8, left),
      openUpward,
    });
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setViewDate(selected || new Date());
      updateRect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen, updateRect]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ date: new Date(year, month, i - startWeekday + 1), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isDisabledDate = (d: Date): boolean => Boolean((minDate && d < minDate) || (maxDate && d > maxDate));

  const selectDate = (d: Date) => {
    if (isDisabledDate(d)) return;
    onChange(toDateOnly(d));
    setIsOpen(false);
  };

  const displayLabel = selected
    ? selected.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : placeholder;

  const panel =
    isOpen && !disabled && rect ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: PANEL_WIDTH,
          transform: rect.openUpward ? "translateY(-100%)" : undefined,
        }}
        className="z-9999 mt-1 rounded-xl border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-[#12161f] shadow-lg overflow-hidden p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#8a94a6]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-[#0f172a] dark:text-white">
            {viewDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#8a94a6]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-[#8a94a6] py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map(({ date, inMonth }, idx) => {
            const isSelected = selected && isSameDay(date, selected);
            const isToday = isSameDay(date, new Date());
            const disabledDay = isDisabledDate(date);
            return (
              <button
                type="button"
                key={idx}
                disabled={disabledDay}
                onClick={() => selectDate(date)}
                className={cn(
                  "h-7 w-7 mx-auto flex items-center justify-center rounded-lg text-[11px] transition-colors",
                  !inMonth && "text-[#c3c9d4] dark:text-slate-700",
                  inMonth && !isSelected && "text-[#0f172a] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                  isSelected && "bg-[#0088ff] text-white font-semibold",
                  !isSelected && isToday && "border border-[#0088ff]/50",
                  disabledDay && "opacity-30 cursor-not-allowed hover:bg-transparent",
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => selectDate(new Date())}
          className="w-full mt-2 pt-2 border-t border-[#f0f2f7] dark:border-slate-800 text-[11px] font-medium text-[#0088ff] hover:underline"
        >
          Hari Ini
        </button>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "w-full h-9 rounded-xl border border-[#e6e9f0] dark:border-slate-800 px-3 bg-white dark:bg-slate-950 text-xs focus:outline-none flex items-center justify-between gap-2 text-left",
          disabled && "opacity-50 cursor-not-allowed",
          !selected && "text-[#8a94a6]",
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <X
              className="h-3.5 w-3.5 text-[#8a94a6] hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
          <Calendar className="h-3.5 w-3.5 text-[#8a94a6]" />
        </span>
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
