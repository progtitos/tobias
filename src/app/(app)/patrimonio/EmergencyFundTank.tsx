/**
 * "Reservatório" da reserva de emergência — sugestão do Thiago (2026-09-20,
 * depois de achar o anel genérico pouco intuitivo): "sugiro que reserva de
 * emergência tenha um ícone tipo um reservatório que vai enchendo conforme
 * aporta, colchão de segurança, reserva etc". Em vez do anel de progresso
 * usado pelos demais objetivos (GoalProgressRing — "quanto falta pra um alvo
 * qualquer"), a reserva ganha essa metáfora própria porque ela É literalmente
 * isso: um volume de líquido que sobe conforme o saldo em conta/investimento
 * líquido cresce. Só usado pro tipo EMERGENCY_FUND.
 *
 * A água usa a cor fixa `ok` (teal — mesma família de "positivo/seguro" já
 * usada no resto do produto, ex: ganho de investimento), enquanto o corpo do
 * tanque usa variáveis de brand-* (que flipam com o tema), pra o contêiner
 * continuar parecendo "de vidro" tanto no tema claro quanto no escuro.
 */
export function EmergencyFundTank({ pct }: { pct: number | null }) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  // Área útil do tanque no viewBox: de y=6 (topo) a y=50 (fundo), 44 de altura.
  const fillTop = 50 - (clamped / 100) * 44;
  const showWave = clamped > 2 && clamped < 98;

  return (
    <div className="relative h-14 w-14 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 40 56" className="h-14 w-10" aria-hidden="true">
        <defs>
          <clipPath id="tank-body-clip">
            <rect x="4" y="6" width="32" height="44" rx="9" />
          </clipPath>
        </defs>
        {/* tampa do reservatório */}
        <rect x="13" y="2" width="14" height="5" rx="1.5" fill="var(--color-brand-600)" />
        {/* corpo (contorno "de vidro") */}
        <rect
          x="4"
          y="6"
          width="32"
          height="44"
          rx="9"
          fill="var(--color-brand-900)"
          stroke="var(--color-brand-600)"
          strokeWidth="2"
        />
        {/* nível de água, sobe conforme o percentual */}
        <g clipPath="url(#tank-body-clip)">
          <rect x="4" y={fillTop} width="32" height={50 - fillTop + 6} fill="#5ecbb8" />
          {showWave && (
            <path d={`M4 ${fillTop} q4 -3 8 0 t8 0 t8 0 t8 0`} fill="none" stroke="#1f8f74" strokeWidth="1.6" />
          )}
        </g>
      </svg>
      <span className="absolute bottom-1.5 text-[10px] font-bold tabular-nums text-ink-900 bg-cream-50/90 rounded px-1 leading-tight">
        {pct === null ? "—" : `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
