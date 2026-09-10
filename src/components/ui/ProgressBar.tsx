import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full rounded-full bg-cream-200 overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full bg-brand-700 transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
