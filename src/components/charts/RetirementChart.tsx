"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  DefaultTooltipContent,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { RetirementSimulation } from "@/services/retirement";
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

// A <Area> usada só pra pintar o gradiente sob a linha "base" tem o mesmo
// dataKey da <Line> "base" (mesmo dado, dois elementos gráficos) — sem essa
// dedupe, o tooltip padrão do Recharts mostra "Patrimônio · cenário base"
// duas vezes seguidas, o que looks like um bug bem na hora que a gente tá
// tentando deixar o tooltip mais claro, não mais confuso.
function ScenarioTooltipContent(props: TooltipContentProps<ValueType, NameType>) {
  const seen = new Set<string>();
  const payload = (props.payload ?? []).filter((p) => {
    const key = String(p.dataKey ?? p.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return <DefaultTooltipContent {...props} payload={payload} />;
}

function buildDataset(sim: RetirementSimulation, targetAge: number) {
  const byAge = (series: RetirementSimulation["base"]["series"]) => {
    const map = new Map<number, number>();
    for (const p of series) map.set(Math.round(p.age), p.value);
    return map;
  };
  const cons = byAge(sim.conservative.series);
  const base = byAge(sim.base.series);
  const agg = byAge(sim.aggressive.series);

  const minAge = Math.round(sim.conservative.series[0]?.age ?? 0);
  const lastAge = (series: RetirementSimulation["base"]["series"]) => Math.round(series.at(-1)?.age ?? minAge);
  const maxAge = Math.max(targetAge, lastAge(sim.conservative.series), lastAge(sim.base.series), lastAge(sim.aggressive.series));
  const ages = Array.from({ length: maxAge - minAge + 1 }, (_, i) => minAge + i);

  return ages.map((age) => ({
    age,
    conservador: cons.get(age) ?? null,
    base: base.get(age) ?? null,
    agressivo: agg.get(age) ?? null,
  }));
}

export function RetirementChart({
  simulation,
  targetAge,
  height = 260,
  dark = false,
  goalMarkers = [],
}: {
  simulation: RetirementSimulation;
  targetAge: number;
  height?: number;
  /** Use the light-on-dark-green palette for cards on the redesigned dashboard. */
  dark?: boolean;
  /** Sonhos/Objetivos com data-alvo, plotados como marcadores na linha do tempo (ver ChartGoalMarker acima). */
  goalMarkers?: ChartGoalMarker[];
}) {
  const data = buildDataset(simulation, targetAge);

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
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.base} stopOpacity={0.28} />
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
        <YAxis
          tick={false}
          width={0}
          axisLine={false}
          tickLine={false}
          domain={[yDomainMin, yDomainMax]}
          reversed={yReversed}
        />
        <Tooltip
          content={ScenarioTooltipContent}
          formatter={(value, name) => [
            typeof value === "number" ? formatBRL(value) : value,
            SCENARIO_TOOLTIP_LABEL[name as keyof typeof SCENARIO_TOOLTIP_LABEL] ?? name,
          ]}
          labelFormatter={(age) => `${age} anos`}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${palette.tooltipBorder}`,
            background: palette.tooltipBg,
            color: palette.tooltipText,
            fontSize: 13,
          }}
        />
        <ReferenceLine y={0} stroke={palette.tick} strokeOpacity={0.5} />
        <ReferenceLine
          y={simulation.requiredNetWorth}
          stroke={palette.reference}
          label={{ value: "Necessário", fontSize: 11, fill: palette.referenceLabel, position: "insideTopLeft" }}
        />
        <ReferenceLine
          x={targetAge}
          stroke={palette.tick}
          strokeOpacity={0.5}
          label={{ value: "Aposentadoria", fontSize: 11, fill: palette.tick, position: "insideTop" }}
        />
        <Area
          type="monotone"
          dataKey="base"
          baseValue="dataMin"
          stroke="none"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="conservador"
          stroke={palette.conservador}
          strokeWidth={1.5}
          strokeLinecap="round"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="base"
          stroke={palette.base}
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="agressivo"
          stroke={palette.agressivo}
          strokeWidth={1.5}
          strokeLinecap="round"
          dot={false}
        />
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
