"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  GitBranch,
  Warehouse,
  Users,
  Truck,
  Package,
  Layers,
  FileText,
  DollarSign,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const items = [
    { label: "Executive Overview Dashboard", href: "/", icon: Layers, group: "Navigation" },
    { label: "Companies Management", href: "/master-data/companies", icon: Building2, group: "Master Data" },
    { label: "Branch Offices", href: "/master-data/branches", icon: GitBranch, group: "Master Data" },
    { label: "Warehouses & Logistics", href: "/master-data/warehouses", icon: Warehouse, group: "Master Data" },
    { label: "Customers Catalog", href: "/master-data/customers", icon: Users, group: "Master Data" },
    { label: "Suppliers Directory", href: "/master-data/suppliers", icon: Truck, group: "Master Data" },
    { label: "Product & Services Master", href: "/master-data/products", icon: Package, group: "Master Data" },
    { label: "Taxes & Currencies Config", href: "/master-data/taxes", icon: DollarSign, group: "Finance & Tax" },
  ];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.group.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs" onClick={onClose} />

      {/* Palette Container */}
      <div className="relative z-10 w-full max-w-xl rounded-xl border border-[#282e42] bg-[#11131c] shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Input */}
        <div className="flex items-center border-b border-[#1b1f2e] px-4 py-3">
          <Search className="h-5 w-5 text-gray-400 mr-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, module, or search entity (Cmd+K)..."
            className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <kbd className="rounded border border-[#232838] bg-[#161924] px-2 py-0.5 text-[10px] text-gray-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs text-gray-300 hover:bg-[#1e2333] hover:text-white transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#232838] bg-[#161924] text-gray-400 group-hover:text-white group-hover:border-blue-500/50">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">
                    {item.group}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-gray-500">
              No matching modules or shortcuts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
