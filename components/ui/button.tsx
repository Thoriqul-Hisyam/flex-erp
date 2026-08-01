import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#0088ff] text-white shadow-md shadow-blue-500/20 hover:bg-[#0077ee]",
        destructive: "bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-600",
        outline: "border border-[#e6e9f0] dark:border-slate-800 bg-[#f8f9fc] dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-[#0f172a] dark:text-white shadow-xs",
        secondary: "bg-[#f8f9fc] dark:bg-slate-800 text-[#0f172a] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white",
        link: "text-[#0088ff] underline-offset-4 hover:underline",
        accent: "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3 text-[11px]",
        lg: "h-11 rounded-full px-6 text-sm",
        icon: "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
