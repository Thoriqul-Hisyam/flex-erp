"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Drop-in replacement for a native <select> with a Select2-style searchable
 * dropdown: click to open, type to filter options, click/Enter to choose.
 *
 * The dropdown panel renders into a portal on document.body and is
 * positioned from the trigger button's viewport rect. This is required
 * because instances routinely live inside scrollable containers (modal
 * item lists, table cells, etc.) - an in-flow `absolute` panel gets clipped
 * by any ancestor's `overflow-y-auto`/`overflow-hidden`, while a portaled
 * `fixed` panel is never subject to ancestor overflow or stacking context.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "-- Pilih --",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada hasil.",
  disabled = false,
  className,
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const updateRect = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight || 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < panelHeight && r.top > spaceBelow;
    setRect({
      top: openUpward ? r.top : r.bottom,
      left: r.left,
      width: r.width,
      openUpward,
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    updateRect();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
        setQuery("");
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

  React.useEffect(() => {
    if (isOpen) {
      setHighlightIndex(0);
      requestAnimationFrame(() => {
        updateRect();
        inputRef.current?.focus();
      });
    }
  }, [isOpen, updateRect]);

  const selectOption = (opt: SearchableSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredOptions[highlightIndex];
      if (opt) selectOption(opt);
    }
  };

  const panel =
    isOpen && !disabled && rect ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          transform: rect.openUpward ? "translateY(-100%)" : undefined,
        }}
        className="z-9999 mt-1 rounded-xl border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-[#12161f] shadow-lg overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-[#f0f2f7] dark:border-slate-800 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[#8a94a6] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs text-[#0f172a] dark:text-white placeholder:text-[#8a94a6] focus:outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[#8a94a6]">{emptyText}</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <button
                type="button"
                key={opt.value}
                disabled={opt.disabled}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors",
                  opt.disabled
                    ? "text-[#8a94a6] cursor-not-allowed opacity-60"
                    : "cursor-pointer text-[#0f172a] dark:text-white",
                  !opt.disabled && idx === highlightIndex && "bg-slate-100 dark:bg-slate-800",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check className="h-3.5 w-3.5 text-[#0088ff] shrink-0" />}
              </button>
            ))
          )}
        </div>
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
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#8a94a6] shrink-0" />
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
