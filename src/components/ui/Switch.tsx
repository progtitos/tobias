"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Toggle liga/desliga simples (ex.: ativar/desativar um ciclo de cobrança em
 * Admin › Financeiro). Não existia no design system ainda — ver
 * `claude/design-system-tobias.md` §25, tabela de componentes a criar (que
 * também não listava este, ficou registrado como lacuna nova). Segue o mesmo
 * padrão de alvo de toque de 44px do `IconButton` (§8/21): o hit-area do
 * `<button>` é maior que a trilha visível, centralizada nela.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 focus-visible:outline-offset-2"
      )}
    >
      <span
        className={cn(
          "h-6 w-10 rounded-full transition-colors",
          checked ? "bg-gold-400" : "bg-onbrand/15"
        )}
      >
        <span
          className={cn(
            "block h-5 w-5 rounded-full bg-brand-950 shadow-sm transition-transform mt-0.5",
            checked ? "translate-x-[19px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
