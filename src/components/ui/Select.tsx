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
          "w-full h-11 appearance-none rounded-xl border border-transparent bg-brand-900 px-3.5 pr-9 text-[15px] text-onbrand",
          "focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-onbrand/50" />
    </div>
  )
);
Select.displayName = "Select";
