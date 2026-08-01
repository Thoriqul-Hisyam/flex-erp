"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  Download,
  Filter,
  X,
} from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  accessor: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  actions?: React.ReactNode;
  onRowClick?: (item: T) => void;
  pageSize?: number;
  onExport?: () => void;
}

export function DataTable<T extends { id: string | number; status?: string } >({
  data,
  columns,
  searchPlaceholder = "Cari & filter data...",
  searchKey,
  actions,
  onRowClick,
  pageSize = 10,
  onExport,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);

  const filterRef = React.useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      // 1. Status filter
      if (statusFilter !== "ALL" && item.status) {
        if (item.status !== statusFilter) return false;
      }

      // 2. Search term filter
      if (!searchTerm.trim()) return true;
      if (searchKey) {
        const val = item[searchKey];
        return String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      }
      return Object.values(item).some((val) =>
        String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [data, searchTerm, searchKey, statusFilter]);

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return filteredData;

    const col = columns.find((c) => c.key === sortColumn);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = String(a[sortColumn as keyof T] ?? "");
      const valB = String(b[sortColumn as keyof T] ?? "");

      if (sortDirection === "asc") {
        return valA.localeCompare(valB, undefined, { numeric: true });
      } else {
        return valB.localeCompare(valA, undefined, { numeric: true });
      }
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  return (
    <div className="space-y-4">
      {/* UVentra Toolbar Container */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#12161f] p-3.5 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#8a94a6]" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-10 h-10 rounded-full bg-[#f8f9fc] dark:bg-slate-900 border-[#e6e9f0] dark:border-slate-800 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8a94a6]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Functional Filters Button & Popover */}
          <div className="relative" ref={filterRef}>
            <Button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              variant="outline"
              size="sm"
              className={cn(
                "h-9 rounded-full px-4 text-xs font-semibold gap-2 border-[#e6e9f0] dark:border-slate-800 bg-[#f8f9fc] dark:bg-slate-900 text-[#0f172a] dark:text-white cursor-pointer",
                statusFilter !== "ALL" && "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#8a94a6]" />
              Filters
              {statusFilter !== "ALL" && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {statusFilter}
                </span>
              )}
            </Button>

            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#161b26] p-3 shadow-xl border border-[#e6e9f0] dark:border-slate-800 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Filter Status</div>
                <div className="space-y-1">
                  {[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Active Only", value: "ACTIVE" },
                    { label: "Inactive / Suspended", value: "INACTIVE" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setStatusFilter(opt.value as any);
                        setCurrentPage(1);
                        setIsFilterOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between cursor-pointer",
                        statusFilter === opt.value
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      {opt.label}
                      {statusFilter === opt.value && <Filter className="h-3.5 w-3.5 text-blue-500" />}
                    </button>
                  ))}
                </div>

                {statusFilter !== "ALL" && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setStatusFilter("ALL");
                        setCurrentPage(1);
                        setIsFilterOpen(false);
                      }}
                      className="w-full text-center text-xs font-semibold text-red-500 hover:text-red-600 py-1 cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Button if handler passed */}
          {onExport && (
            <Button
              onClick={onExport}
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4 text-xs font-semibold gap-2 border-[#e6e9f0] dark:border-slate-800 bg-[#f8f9fc] dark:bg-slate-900 text-[#0f172a] dark:text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#8a94a6]" />
              Export
            </Button>
          )}

          {actions}
        </div>
      </div>

      {/* UVentra Table Container */}
      <div className="overflow-hidden rounded-[24px] border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-[#12161f] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fc] dark:bg-slate-800/50 border-b border-[#e6e9f0] dark:border-slate-800 text-[#8a94a6] dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={cn(
                      "px-5 py-3.5",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.sortable && "cursor-pointer select-none hover:text-[#0f172a] dark:hover:text-white"
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        col.align === "right" && "justify-end w-full",
                        col.align === "center" && "justify-center w-full"
                      )}
                    >
                      <span>{col.header}</span>
                      {col.sortable && <ArrowUpDown className="h-3 w-3 text-[#8a94a6]" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f7] dark:divide-slate-800/60 text-[#0f172a] dark:text-slate-200 font-mono-num">
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={cn(
                      "transition-colors hover:bg-[#f8f9fc] dark:hover:bg-slate-800/40",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-5 py-3.5 whitespace-nowrap",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {col.accessor(item)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-12 text-center text-[#8a94a6] font-sans"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between border-t border-[#e6e9f0] dark:border-slate-800 px-5 py-3.5 bg-[#f8f9fc] dark:bg-slate-900/30">
          <div className="text-xs text-[#8a94a6] font-sans">
            Showing <span className="font-bold text-[#0f172a] dark:text-white font-mono-num">{sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{" "}
            <span className="font-bold text-[#0f172a] dark:text-white font-mono-num">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>{" "}
            of <span className="font-bold text-[#0f172a] dark:text-white font-mono-num">{sortedData.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5 font-sans">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-slate-800 text-[#0f172a] dark:text-white shadow-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-slate-800 text-[#0f172a] dark:text-white shadow-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-3 text-xs text-[#8a94a6] font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-slate-800 text-[#0f172a] dark:text-white shadow-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-slate-800 text-[#0f172a] dark:text-white shadow-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
