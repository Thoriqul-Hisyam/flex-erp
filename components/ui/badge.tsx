import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors focus:outline-none font-sans",
  {
    variants: {
      variant: {
        default: "bg-[#f0f7ff] dark:bg-blue-950/60 text-[#0088ff] dark:text-blue-400 border border-[#0088ff]/20",
        secondary: "bg-[#f8f9fc] dark:bg-slate-800 text-[#8a94a6] dark:text-slate-300 border border-[#e6e9f0] dark:border-slate-700",
        success: "bg-[#e6f9f0] dark:bg-emerald-950/60 text-[#10b981] dark:text-emerald-400 border border-[#10b981]/20",
        warning: "bg-[#fffbea] dark:bg-amber-950/60 text-[#f59e0b] dark:text-amber-400 border border-[#f59e0b]/20",
        destructive: "bg-[#ffeef0] dark:bg-rose-950/60 text-[#ef4444] dark:text-rose-400 border border-[#ef4444]/20",
        outline: "text-[#0f172a] dark:text-slate-200 border border-[#e6e9f0] dark:border-slate-800 bg-white dark:bg-slate-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
