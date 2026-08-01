"use client";

import * as React from "react";
import {
  Search,
  Settings,
  Bell,
  ChevronDown,
  Building2,
  GitBranch,
  Warehouse,
  Check,
  Layers,
  Square,
  CheckSquare,
} from "lucide-react";
import { useSiteSettings } from "@/components/providers/site-settings-provider";
import { usePermission } from "@/lib/auth/use-permission";
import {
  useModule,
  ModuleCategory,
} from "@/components/providers/module-provider";
import { cn } from "@/lib/utils";

export function Header() {
  const { settings } = useSiteSettings();
  const { selectedModules, toggleModule, availableModules } = useModule();
  const [logoError, setLogoError] = React.useState(false);
  const [isModuleOpen, setIsModuleOpen] = React.useState(false);
  const moduleMenuRef = React.useRef<HTMLDivElement>(null);

  const permission = usePermission("dashboard");

  const displayName = permission.userName || "";
  const displayRole = permission.roleName || "";
  const displayCompany = permission.companyName || "";
  const displayBranch = permission.branchName || "";
  const displayWarehouse = permission.warehouseName || "";

  // Close module menu on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moduleMenuRef.current &&
        !moduleMenuRef.current.contains(event.target as Node)
      ) {
        setIsModuleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute label text for header pill
  const activeLabel = React.useMemo(() => {
    if (selectedModules.includes("ALL")) return "Semua Modul System";
    const selectedOptions = availableModules.filter((m) =>
      selectedModules.includes(m.id),
    );
    if (selectedOptions.length === 0) return "Semua Modul System";
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions[0].shortLabel} (+${selectedOptions.length - 1} Modul)`;
  }, [selectedModules, availableModules]);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-[#eceff4] dark:bg-[#090c10] border-b border-[#e6e9f0] dark:border-slate-800/60 select-none gap-4">
      {/* Left Section: Dynamic Site Settings Branding & Active Module Pill Multi-Select Dropdown */}
      <div className="flex items-center gap-3">
        {/* Brand Logo Pill */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-[#12161f] px-3.5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800">
          {settings.logoUrl && !logoError ? (
            /* eslint-disable-next-html-element-for-img */
            <img
              src={settings.logoUrl}
              alt={settings.siteName}
              onError={() => setLogoError(true)}
              className="h-5 w-auto object-contain dark:brightness-0 dark:invert"
            />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-white font-serif font-bold text-xs shadow-xs transition-colors"
              style={{ backgroundColor: settings.primaryColor || "#0088ff" }}
            >
              {settings.siteName ? settings.siteName[0].toUpperCase() : "μ"}
            </div>
          )}
          <span className="text-xs font-bold tracking-tight text-[#0f172a] dark:text-white">
            {settings.siteName || "Flex ERP"}
          </span>
        </div>

        {/* Multi-Select Module Switcher Pill Dropdown */}
        <div className="relative" ref={moduleMenuRef}>
          <button
            onClick={() => setIsModuleOpen(!isModuleOpen)}
            title="Pilih Modul Aktif untuk Menyaring Navigasi Sidebar"
            className="hidden md:flex items-center gap-2 bg-white dark:bg-[#12161f] px-3.5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 text-xs font-semibold text-[#0f172a] dark:text-slate-200 hover:border-blue-500/50 transition-all cursor-pointer"
          >
            <Layers className="h-4 w-4 text-[#0088ff]" />
            <span>{activeLabel}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[#8a94a6] ml-1 transition-transform",
                isModuleOpen && "rotate-180",
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {isModuleOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#161b26] p-3 shadow-2xl border border-[#e6e9f0] dark:border-slate-800 z-50 animate-in fade-in-50 zoom-in-95">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 flex items-center justify-between">
                <span>Pemilihan Modul ERP</span>
                <span className="text-[10px] text-blue-500 font-mono">
                  Multi-Select Filter
                </span>
              </div>
              <div className="space-y-1">
                {availableModules.map((mod) => {
                  const Icon = mod.icon;
                  const isChecked = selectedModules.includes(mod.id);

                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModule(mod.id as ModuleCategory)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer",
                        isChecked
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isChecked ? "text-[#0088ff]" : "text-slate-400",
                          )}
                        />
                        <div>
                          <div className="font-semibold">{mod.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {mod.description}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 ml-2">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-[#0088ff]" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 px-2 leading-relaxed">
                Centang satu atau beberapa modul untuk menampilkan menunya di
                sidebar. Modul tanpa hak akses tidak ditampilkan.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: PRD Multi-Tenant Scope Switcher Pill */}
      <div className="hidden xl:flex items-center gap-1.5 bg-white dark:bg-[#12161f] px-3 py-1 rounded-full border border-[#e6e9f0] dark:border-slate-800 text-[11px] font-medium shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-1 text-[#0f172a] dark:text-slate-200 font-bold px-2 py-0.5 rounded-full bg-[#f8f9fc] dark:bg-slate-800">
          <Building2 className="h-3 w-3 text-[#0088ff]" />
          <span>{displayCompany}</span>
        </div>
        <span className="text-[#8a94a6]">•</span>
        <div className="flex items-center gap-1 text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white transition-colors cursor-pointer px-2 py-0.5">
          <GitBranch className="h-3 w-3 text-[#10b981]" />
          <span>{displayBranch}</span>
        </div>
        <span className="text-[#8a94a6]">•</span>
        <div className="flex items-center gap-1 text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white transition-colors cursor-pointer px-2 py-0.5">
          <Warehouse className="h-3 w-3 text-[#f59e0b]" />
          <span>{displayWarehouse}</span>
        </div>
      </div>

      {/* Right Utility Group */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search */}
        <button
          className="h-9 w-9 md:w-auto md:px-3.5 rounded-full bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 flex items-center gap-2 text-xs text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-colors cursor-pointer"
          title="Search (Cmd+K)"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline font-medium">
            Search records...
          </span>
          <kbd className="hidden md:inline-block rounded bg-[#f8f9fc] dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono border border-[#e6e9f0] dark:border-slate-700">
            ⌘K
          </kbd>
        </button>

        {/* Settings Gear */}
        <button className="h-9 w-9 rounded-full bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-center text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-colors cursor-pointer">
          <Settings className="h-4 w-4" />
        </button>

        {/* Notification Bell with Red Dot */}
        <button className="relative h-9 w-9 rounded-full bg-white dark:bg-[#12161f] border border-[#e6e9f0] dark:border-slate-800 flex items-center justify-center text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-colors cursor-pointer">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#ef4444] ring-2 ring-white dark:ring-[#12161f]" />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#12161f] pl-1.5 pr-3 py-1 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e6e9f0] dark:border-slate-800 cursor-pointer">
          <div className="h-7 w-7 rounded-full bg-[#0088ff] text-white flex items-center justify-center font-bold text-xs">
            {displayName.split(" ")[0]?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="hidden sm:block text-left text-xs leading-tight">
            <span className="block text-[9px] text-blue-600 dark:text-blue-400 font-extrabold font-mono uppercase tracking-wider">
              {permission.isLoading ? "..." : displayRole}
            </span>
            <span className="font-bold text-[#0f172a] dark:text-white">
              {displayName}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-[#8a94a6] ml-0.5" />
        </div>
      </div>
    </header>
  );
}
