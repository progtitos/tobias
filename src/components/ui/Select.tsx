import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full h-11 appearance-none rounded-xl border border-ink-300/60 bg-cream-50 px-3.5 pr-9 text-[15px] text-ink-900",
          "focus:outline-none focus:ring-2 focus:ring-brand-700/30 focus:border-brand-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
    </div>
  )
);
Select.displayName = "Select";
