"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Theme } from "@/lib/theme";
import { setThemeAction } from "@/app/(app)/settings/actions";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

export function ThemeToggle({ current }: { current: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(theme: Theme) {
    if (theme === current || pending) return;
    startTransition(async () => {
      await setThemeAction(theme);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex rounded-xl border border-black/20 bg-brand-900 p-1 gap-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            disabled={pending}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
              active ? "bg-gold-500 text-ink-900" : "text-onbrand/60 hover:text-onbrand hover:bg-white/5"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
