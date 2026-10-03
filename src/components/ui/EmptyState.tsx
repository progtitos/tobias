import type { ComponentType } from "react";
import { Button } from "@/components/ui/Button";

/**
 * "Capa" padrão pra quando uma lista ainda não tem nenhum item — pedido do
 * Thiago (03/10/2026, mostrando um print de referência: "as telas que
 * tiverem assim sem nada, é indicado ter tipo uma capa... para cadastrar o
 * primeiro produto"). Segue a anatomia já documentada em
 * claude/design-system-tobias.md §19 "Estados vazios": ícone decorativo
 * (lucide, 32-40px, `text-onbrand/30`) + frase curta explicando o que vai
 * aparecer ali + uma ação primária quando fizer sentido criar o primeiro
 * item dali mesmo. Tom calmo (princípio 3 do design system) — nunca
 * ilustração de banco de imagens, nunca "Ops! 😅".
 *
 * Substitui o `<p className="text-sm text-onbrand/55 py-N text-center">...`
 * cru que cada tela repetia por conta própria (Investimentos, Patrimônio,
 * Conta) por um componente único, pra manter a mesma anatomia em todo lugar
 * em vez de cada tela inventar o próprio texto solto.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  /** Frase curta dizendo o que vai aparecer ali (não só "Nada encontrado") — ex.: "Nenhum investimento ainda". */
  title: string;
  /** Uma frase explicando o porquê/benefício de cadastrar, opcional. */
  description?: string;
  /** Ação primária pra criar o primeiro item, quando fizer sentido (ex.: abrir o formulário de criação). Omitir quando o estado vazio é só informativo (ex.: "nenhuma dívida em aberto" não precisa de CTA pra criar uma dívida). */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <Icon className="h-9 w-9 text-onbrand/30 mb-3" />
      <p className="text-sm text-onbrand/70 max-w-xs">{title}</p>
      {description && <p className="text-xs text-onbrand/45 mt-1 max-w-xs">{description}</p>}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
