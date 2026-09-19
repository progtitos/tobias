import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type IconButtonTone = "default" | "danger";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: todo botão cujo único conteúdo visível é um ícone precisa de um nome acessível. */
  label: string;
  /** `danger` para ações destrutivas (excluir) — muda a cor de hover. */
  tone?: IconButtonTone;
}

const TONE_CLASSES: Record<IconButtonTone, string> = {
  default: "text-onbrand/60 hover:text-gold-400 hover:bg-onbrand/5",
  danger: "text-onbrand/40 hover:text-danger-300 hover:bg-danger-300/10",
};

/**
 * Botão cujo único conteúdo é um ícone. Resolve dois achados recorrentes da
 * auditoria de UX/UI: (1) botões-ícone sem `aria-label` (leitor de tela não
 * anuncia nada útil), e (2) alvo de toque abaixo de 44×44px (o ícone em si
 * fica pequeno — `h-4 w-4` — mas a área clicável do botão é sempre 44×44,
 * via `h-11 w-11`, mesmo dentro de uma linha compacta).
 *
 * Ver `design-system-tobias.md`, seções 8 e 21.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = "default", className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
