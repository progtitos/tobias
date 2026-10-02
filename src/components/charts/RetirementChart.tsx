"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { RetirementSimulation, MetaTrajectory } from "@/services/retirement";
import { formatBRL } from "@/lib/utils/money";

// Um Sonho/Objetivo (Patrimônio) já convertido pra idade (eixo X do
// gráfico) — ver a conversão de `yearsFromNow` -> `age` em RetirementClient.
// RETIREMENT fica de fora de propósito (ver comentário em retirement/page.tsx
// sobre os "dois conceitos de aposentadoria coexistindo hoje").
export type ChartGoalMarker = {
  id: string;
  title: string;
  type: string;
  targetAmount: number | null;
  achieved: boolean;
  age: number;
};

// Uma letra curta por tipo, pra caber dentro do círculo do marcador — mesmos
// tipos de GoalsClient.tsx (TYPE_LABELS), sem RETIREMENT (nunca chega aqui).
const GOAL_TYPE_GLYPH: Record<string, string> = {
  DREAM: "S", // Sonho
  EMERGENCY_FUND: "R", // Reserva de emergência
  PROPERTY: "I", // Imóvel
  CUSTOM: "O", // Outro
};

const GOAL_TYPE_LABEL: Record<string, string> = {
  DREAM: "Sonho",
  EMERGENCY_FUND: "Reserva de emergência",
  PROPERTY: "Imóvel",
  CUSTOM: "Outro",
};

// As três linhas projetam o PATRIMÔNIO TOTAL (contas + investimentos, não só
// o que está investido) sob taxas de retorno hipotéticas diferentes — não são
// uma alocação real nem uma recomendação de quanto investir em renda
// variável. O rótulo do tooltip deixa isso explícito (pedido do Thiago: os
// nomes "agressivo"/"base"/"conservador" sozinhos passavam a impressão de que
// eram opções de investimento, ou de que só dinheiro investido crescia assim).
const SCENARIO_TOOLTIP_LABEL = {
  conservador: "Patrimônio · cenário conservador",
  base: "Patrimônio · cenário base",
  agressivo: "Patrimônio · cenário agressivo",
};

// Tooltip em card (redesenho aprovado, 02/10/2026 — "legenda, eixo Y
// visível, tooltip em card"): cabeçalho com a idade + uma linha por cenário
// (bolinha colorida igual à linha do gráfico, nome e valor alinhados), em
// vez do tooltip padrão do Recharts (DefaultTooltipContent, uma lista crua).
// A <Area> usada só pra pintar o gradiente sob a linha "base" tem o mesmo
// dataKey da <Line> "base" (mesmo dado, dois elementos gráficos) — sem essa
// dedupe, o tooltip mostraria "Patrimônio · cenário base" duas vezes
// seguidas.
function ScenarioTooltipContent(
  props: TooltipContentProps<ValueType, NameType> & {
    palette: { tooltipBg: string; tooltipBorder: string; tooltipText: string };
  }
) {
  const { active, label, palette } = props;
  if (!active) return null;

  const seen = new Set<string>();
  const rows = (props.payload ?? []).filter((p) => {
    const key = String(p.dataKey ?? p.name);
    if (seen.has(key) || p.value == null) return false;
    seen.add(key);
    return true;
  });
  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-xl px-3.5 py-3 text-xs shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]"
      style={{ background: palette.tooltipBg, border: `1px solid ${palette.tooltipBorder}`, color: palette.tooltipText }}
    >
      <p className="font-semibold mb-2">{label} anos</p>
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-4 justify-between">
            <span className="flex items-center gap-1.5 opacity-75">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden />
              {SCENARIO_TOOLTIP_LABEL[p.dataKey as keyof typeof SCENARIO_TOOLTIP_LABEL] ?? p.name}
            </span>
            <span className="font-medium tabular-nums">{typeof p.value === "number" ? formatBRL(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Valor compacto só pro rótulo da curva Meta ("R$ 540 mil", "R$ 1,2 mi") —
 * formatBRL por extenso não cabe num rótulo curto dentro do gráfico. */
function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return formatBRL(value);
}

function buildDataset(sim: RetirementSimulation, targetAge: number, metaTrajectory?: MetaTrajectory | null) {
  const byAge = (series: RetirementSimulation["base"]["series"]) => {
    const map = new Map<number, number>();
    for (const p of series) map.set(Math.round(p.age), p.value);
    return map;
  };
  const cons = byAge(sim.conservative.series);
  const base = byAge(sim.base.series);
  const agg = byAge(sim.aggressive.series);
  const meta = metaTrajectory ? byAge(metaTrajectory.series) : null;

  const minAge = Math.round(sim.conservative.series[0]?.age ?? 0);
  const lastAge = (series: RetirementSimulation["base"]["series"]) => Math.round(series.at(-1)?.age ?? minAge);
  const maxAge = Math.max(targetAge, lastAge(sim.conservative.series), lastAge(sim.base.series), lastAge(sim.aggressive.series));
  const ages = Array.from({ length: maxAge - minAge + 1 }, (_, i) => minAge + i);

  return ages.map((age) => ({
    age,
    conservador: cons.get(age) ?? null,
    base: base.get(age) ?? null,
    agressivo: agg.get(age) ?? null,
    meta: meta?.get(age) ?? null,
  }));
}

export function RetirementChart({
  simulation,
  targetAge,
  height = 260,
  dark = false,
  goalMarkers = [],
  showLegend = false,
  variant = "scenarios",
  metaTrajectory = null,
}: {
  simulation: RetirementSimulation;
  targetAge: number;
  height?: number;
  /** Use the light-on-dark-green palette for cards on the redesigned dashboard. */
  dark?: boolean;
  /** Sonhos/Objetivos com data-alvo, plotados como marcadores na linha do tempo (ver ChartGoalMarker acima). */
  goalMarkers?: ChartGoalMarker[];
  /** Legenda abaixo do gráfico — 3 cenários em "scenarios", Projeção + Meta
   * em "hero". O eixo Y com valores em R$ foi tentado no redesenho de
   * 02/10/2026 mas revertido no mesmo dia: o print de referência do Thiago
   * não tinha essa escala, e ela não ajudava — os cards compactos (Dashboard,
   * reveal do onboarding) continuam sem legenda nem eixo de propósito: pouco
   * espaço pra algo que ali só repetiria o que o texto ao lado já diz. */
  showLegend?: boolean;
  /** "scenarios" (padrão): as 3 linhas de cenário lado a lado, como hoje nos
   * cards compactos do Dashboard/onboarding. "hero": só a projeção do
   * cenário base (preenchida, mais grossa) + a curva Meta tracejada —
   * redesenho aprovado pro card de destaque de /retirement (02/10/2026,
   * pedido do Thiago: "uma curva simulada... pra visualizar como fazer pra
   * fechar nela" em vez da linha vertical "Aposentadoria" + comparação dos 3
   * cenários virou só um selo de status, calculado fora daqui). */
  variant?: "scenarios" | "hero";
  /** Série da curva Meta (ver buildMetaTrajectory em services/retirement) —
   * só usada quando variant="hero". `null` quando a meta já está coberta
   * pelo patrimônio de hoje, ou quando nem um retorno de 50%/ano chegaria
   * lá — nos dois casos a curva simplesmente não aparece. */
  metaTrajectory?: MetaTrajectory | null;
}) {
  const isHero = variant === "hero";
  const data = buildDataset(simulation, targetAge, isHero ? metaTrajectory : null);

  // Normally 0 already sits at the bottom of the axis (it's the domain's
  // minimum whenever there's any positive net worth in the series). But for
  // a scenario that's negative the whole way through, 0 becomes the domain's
  // MAXIMUM instead — which recharts places at the top by default, leaving
  // "0k" stranded above a big block of negative numbers. Flipping the axis
  // (reversed) only in that specific case keeps 0 anchored to the bottom
  // like every other chart, while a normal (partly-positive) scenario keeps
  // its usual orientation.
  const allValues = data.flatMap((d) => [d.conservador, d.base, d.agressivo]).filter((v): v is number => v !== null);
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const yDomainMax = Math.max(0, rawMax);
  const yDomainMin = Math.min(0, rawMin);
  const yReversed = yDomainMax === 0;

  const palette = dark
    ? {
        grid: "rgba(247,244,236,0.1)",
        tick: "#a9c2b3",
        tooltipBg: "#0f3d2e",
        tooltipBorder: "#1d4e3b",
        tooltipText: "#f7f4ec",
        reference: "#d1b567",
        referenceLabel: "#d1b567",
        conservador: "#5c7d6c",
        base: "#7fc79a",
        agressivo: "#d1b567",
        // Cor dedicada da curva Meta (variante "hero") — distinta do dourado
        // de "reference"/agressivo pra não confundir as duas (coral/danger-300
        // do design system, usado aqui só como diferenciador visual, sem
        // significado de "erro").
        metaLine: "#f08a72",
      }
    : {
        grid: "#ece5d3",
        tick: "#6b6f66",
        tooltipBg: "#ffffff",
        tooltipBorder: "#ece5d3",
        tooltipText: "#1b1d1a",
        reference: "#a5822f",
        referenceLabel: "#8a6a24",
        conservador: "#a3a89c",
        base: "#1a6349",
        agressivo: "#bd9a44",
        metaLine: "#c14a3a",
      };

  const gradientId = dark ? "retirementBaseFillDark" : "retirementBaseFillLight";

  const goalColor: Record<string, string> = {
    DREAM: palette.agressivo,
    EMERGENCY_FUND: palette.base,
    PROPERTY: palette.conservador,
    CUSTOM: palette.tick,
  };

  // Só plota marcador dentro do intervalo de idade que a curva realmente
  // desenha — um Sonho com data-alvo fora desse intervalo (ex.: muito além
  // do horizonte simulado) ficaria "pendurado" fora do gráfico.
  const minAge = data[0]?.age;
  const maxAge = data[data.length - 1]?.age;
  const visibleGoalMarkers =
    minAge != null && maxAge != null ? goalMarkers.filter((g) => g.age >= minAge && g.age <= maxAge) : [];

  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.base} stopOpacity={isHero ? 0.32 : 0.28} />
            <stop offset="100%" stopColor={palette.base} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="age"
          tick={{ fontSize: 12, fill: palette.tick }}
          tickFormatter={(v) => `${v}a`}
          axisLine={{ stroke: palette.grid }}
          tickLine={false}
        />
        <YAxis tick={false} width={0} axisLine={false} tickLine={false} domain={[yDomainMin, yDomainMax]} reversed={yReversed} />
        <Tooltip content={(props) => <ScenarioTooltipContent {...props} palette={palette} />} />
        <ReferenceLine y={0} stroke={palette.tick} strokeOpacity={0.5} />
        {/* A linha horizontal "Necessário" e a vertical "Aposentadoria" só
            fazem sentido na variante "scenarios" (cards compactos do
            Dashboard/onboarding) — na "hero" (tela cheia de /retirement) as
            duas foram substituídas pela curva Meta abaixo, que mostra o
            mesmo ritmo necessário de um jeito mais direto (pedido do Thiago,
            02/10/2026: "uma curva simulada... em vez da linha vertical
            'aposentadoria'"). */}
        {!isHero && simulation.requiredNetWorth > 0 && (
          <ReferenceLine
            y={simulation.requiredNetWorth}
            stroke={palette.reference}
            label={{ value: "Necessário", fontSize: 11, fill: palette.referenceLabel, position: "insideTopLeft" }}
          />
        )}
        {!isHero && (
          <ReferenceLine
            x={targetAge}
            stroke={palette.tick}
            strokeOpacity={0.5}
            label={{ value: "Aposentadoria", fontSize: 11, fill: palette.tick, position: "insideTop" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="base"
          baseValue="dataMin"
          stroke="none"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
        {!isHero && (
          <Line
            type="monotone"
            dataKey="conservador"
            stroke={palette.conservador}
            strokeWidth={1.5}
            strokeLinecap="round"
            dot={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="base"
          stroke={palette.base}
          strokeWidth={isHero ? 3 : 2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4 }}
        />
        {!isHero && (
          <Line
            type="monotone"
            dataKey="agressivo"
            stroke={palette.agressivo}
            strokeWidth={1.5}
            strokeLinecap="round"
            dot={false}
          />
        )}
        {/* Curva Meta: só na variante "hero", e só quando há mesmo uma meta a
            perseguir (ver buildMetaTrajectory — null quando já coberta ou
            inatingível só com retorno). Termina na idade-alvo (não continua
            pra fase de "viver da renda", diferente da linha "base"), com um
            marcador + rótulo do valor necessário na ponta. */}
        {isHero && metaTrajectory && (
          <>
            <Line
              type="monotone"
              dataKey="meta"
              stroke={palette.metaLine}
              strokeWidth={2.5}
              strokeDasharray="9 6"
              strokeLinecap="round"
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={targetAge}
              y={simulation.requiredNetWorth}
              r={4}
              fill={palette.metaLine}
              stroke="none"
              label={{
                value: `Meta: ${formatCompactBRL(simulation.requiredNetWorth)}`,
                fontSize: 11,
                fontWeight: 600,
                fill: palette.metaLine,
                position: "top",
              }}
            />
          </>
        )}
        {visibleGoalMarkers.map((marker) => (
          <ReferenceDot
            key={marker.id}
            x={marker.age}
            y={0}
            shape={(props: { cx?: number; cy?: number }) => (
              <GoalMarkerShape cx={props.cx} cy={props.cy} marker={marker} color={goalColor[marker.type] ?? palette.tick} ringColor={palette.tooltipBg} />
            )}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    {showLegend && isHero && (
      <div className="flex items-center justify-center gap-4 mt-2.5 flex-wrap">
        <ChartLegendEntry color={palette.base} label="Projeção (cenário base)" />
        {metaTrajectory && <ChartLegendEntry color={palette.metaLine} label="Meta (ritmo necessário)" dashed />}
      </div>
    )}
    {showLegend && !isHero && (
      <div className="flex items-center justify-center gap-4 mt-2.5 flex-wrap">
        <ChartLegendEntry color={palette.conservador} label="Conservador" />
        <ChartLegendEntry color={palette.base} label="Base" />
        <ChartLegendEntry color={palette.agressivo} label="Agressivo" />
      </div>
    )}
    </div>
  );
}

/** Bolinha colorida + nome do cenário — mesma cor da linha correspondente no
 * gráfico, pra quem olha a curva saber qual é qual sem depender só do
 * tooltip ao passar o mouse (pedido do Thiago, 02/10/2026: "legenda"). */
function ChartLegendEntry({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-onbrand/70">
      {dashed ? (
        <span
          className="w-3.5 shrink-0"
          style={{ borderTop: `2px dashed ${color}` }}
          aria-hidden
        />
      ) : (
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
      )}
      {label}
    </span>
  );
}

/**
 * Um marcador de Sonho/Objetivo na linha do tempo: círculo colorido (por
 * tipo, reaproveitando as cores das 3 linhas de cenário), com uma letra
 * (S/R/I/O) ou "✓" se já alcançado, e um <title> nativo pra tooltip ao
 * passar o mouse — evita embutir um ícone Lucide inteiro dentro de um shape
 * customizado do Recharts, que é mais frágil de acertar sem preview ao vivo.
 */
function GoalMarkerShape({
  cx,
  cy,
  marker,
  color,
  ringColor,
}: {
  cx?: number;
  cy?: number;
  marker: ChartGoalMarker;
  color: string;
  ringColor: string;
}) {
  if (cx == null || cy == null) return null;
  const glyph = marker.achieved ? "✓" : (GOAL_TYPE_GLYPH[marker.type] ?? "?");
  const tooltip = [
    marker.title,
    GOAL_TYPE_LABEL[marker.type] ?? marker.type,
    marker.targetAmount ? formatBRL(marker.targetAmount) : null,
    marker.achieved ? "alcançado" : `previsto aos ${Math.round(marker.age)} anos`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <g>
      <title>{tooltip}</title>
      <circle cx={cx} cy={cy} r={8} fill={color} stroke={ringColor} strokeWidth={1.5} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#ffffff">
        {glyph}
      </text>
    </g>
  );
}
