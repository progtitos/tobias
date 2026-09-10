import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-sm font-medium text-ink-700 mb-1.5 block", className)} {...props} />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 rounded-xl border border-ink-300/60 bg-cream-50 px-3.5 text-[15px] text-ink-900",
        "placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-700/30 focus:border-brand-700",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-ink-300/60 bg-cream-50 px-3.5 py-2.5 text-[15px] text-ink-900",
        "placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-700/30 focus:border-brand-700",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-shadow resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-danger-600">{children}</p>;
}
