/**
 * Anel de progresso por objetivo — pedido do Thiago (2026-09-20): "tem que
 * ter caixinhas e gráficos para cada tipo de objetivo, sonho, reserva de
 * emergência". Cada `GoalCard` (PatrimonioClient.tsx) já era uma caixinha;
 * faltava o gráfico. Trocamos a barra linear por um anel (mesma técnica de
 * conic-gradient das pizzas de Investimentos), porque aqui a leitura é
 * "quanto falta pra UM alvo", não "como o total se reparte entre fatias" —
 * um anel comunica isso melhor que fatias.
 */
export function GoalProgressRing({ pct }: { pct: number | null }) {
  const clamped = pct === null ? null : Math.max(0, Math.min(100, pct));
  // O trilho neutro usa a variável de brand-700 (não o hex fixo) porque essa
  // cor FLIPA entre tema claro/escuro — diferente do dourado preenchido
  // (gold-400), que é um accent fixo por design (ver globals.css). Hardcoded
  // aqui deixaria o trilho errado no tema claro.
  const gradient =
    clamped === null
      ? "conic-gradient(var(--color-brand-700) 0% 100%)"
      : `conic-gradient(#ffb648 0% ${clamped}%, var(--color-brand-700) ${clamped}% 100%)`;

  return (
    <div className="relative h-14 w-14 shrink-0 rounded-full" style={{ background: gradient }}>
      <div className="absolute inset-[15%] rounded-full bg-brand-800 flex items-center justify-center">
        <span className="text-[11px] font-semibold tabular-nums text-onbrand">
          {clamped === null ? "—" : `${Math.round(clamped)}%`}
        </span>
      </div>
    </div>
  );
}
