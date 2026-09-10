import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-sm font-medium text-cream-50/80 mb-1.5 block", className)} {...props} />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 rounded-xl border border-black/20 bg-brand-900 px-3.5 text-[15px] text-cream-50",
        "placeholder:text-cream-50/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
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
        "w-full rounded-xl border border-black/20 bg-brand-900 px-3.5 py-2.5 text-[15px] text-cream-50",
        "placeholder:text-cream-50/35 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400/60",
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
  return <p className="mt-1.5 text-sm text-danger-300">{children}</p>;
}
