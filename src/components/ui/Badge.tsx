import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "gold" | "ok" | "warn" | "danger" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-cream-200 text-ink-700",
  gold: "bg-gold-100 text-gold-700",
  ok: "bg-ok-100 text-ok-600",
  warn: "bg-warn-100 text-warn-600",
  danger: "bg-danger-100 text-danger-600",
  brand: "bg-brandchip-100 text-brandchip-900",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
