import * as React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number; // percentage change e.g. +12.5 or -3.2
  period?: string; // e.g. "vs last month"
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function KPICard({
  title,
  value,
  change,
  period = "vs last period",
  icon: Icon,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#232838] bg-[#11131c] p-5 shadow-xs transition-all hover:border-[#2e354a]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {title}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#232838] bg-[#161924] text-gray-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-bold font-mono-num tracking-tight text-white">
          {value}
        </div>
      </div>

      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <div
            className={cn(
              "inline-flex items-center gap-0.5 font-medium rounded-full px-1.5 py-0.5",
              isPositive && "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40",
              isNegative && "bg-rose-950/60 text-rose-400 border border-rose-800/40",
              !isPositive && !isNegative && "bg-gray-800 text-gray-400"
            )}
          >
            {isPositive && <ArrowUpRight className="h-3 w-3" />}
            {isNegative && <ArrowDownRight className="h-3 w-3" />}
            {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
          <span className="text-gray-500">{period}</span>
        </div>
      )}
    </div>
  );
}
