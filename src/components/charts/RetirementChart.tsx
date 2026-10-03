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
import { valueAtAge } from "@/services/retirement";
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

// Um emoji por tipo, pra funcionar como ícone de verdade dentro do círculo do
// marcador (redesenho aprovado, 02/10/2026 — "os objetivos podem ser
// substituídos por ícones, com linha ficou estranho"). Emoji em vez de um
// ícone Lucide embutido no shape: texto simples dentro de um <text> do SVG,
// sem risco de desalinhar o path de um ícone vetorial sem preview ao vivo.
const GOAL_TYPE_GLYPH: Record<string, string> = {
  DREAM: "🌟",
  EMERGENCY_FUND: "🛟",
  PROPERTY: "🏠",
  CUSTOM: "🎯",
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

function buildDataset(
  sim: RetirementSimulation,
  targetAge: number,
  maxAgeOverride?: number,
  metaTrajectory?: MetaTrajectory | null
) {
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
  const naturalMaxAge = Math.max(targetAge, lastAge(sim.conservative.series), lastAge(sim.base.series), lastAge(sim.aggressive.series));
  // Na variante "hero" o gráfico não desenha a fase de "viver de renda"
  // (ver abaixo) — ele para exatamente na idade-alvo, ou um pouco depois se
  // algum objetivo vencer depois da aposentadoria planejada. Fora da "hero"
  // mantém o horizonte completo de sempre (ex.: cards compactos).
  const maxAge = maxAgeOverride != null ? Math.min(naturalMaxAge, maxAgeOverride) : naturalMaxAge;
  const ages = Array.from({ length: Math.max(0, maxAge - minAge + 1) }, (_, i) => minAge + i);

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
  /** Legenda abaixo do gráfico — 3 cenários em "scenarios", só "Seu
   * patrimônio" em "hero" (os objetivos e a aposentadoria já se explicam
   * pelo próprio ícone/rótulo no gráfico, sem precisar de uma entrada extra
   * cada). O eixo Y com valores em R$ foi tentado no redesenho de
   * 02/10/2026 mas revertido no mesmo dia: o print de referência do Thiago
   * não tinha essa escala, e ela não ajudava — os cards compactos (Dashboard,
   * reveal do onboarding) continuam sem legenda nem eixo de propósito: pouco
   * espaço pra algo que ali só repetiria o que o texto ao lado já diz. */
  showLegend?: boolean;
  /** "scenarios" (padrão): as 3 linhas de cenário lado a lado, como hoje nos
   * cards compactos do Dashboard/onboarding. "hero": uma curva só (o
   * patrimônio projetado no cenário base), que precisa "ligar os pontos" —
   * sair de hoje, passar pelos ícones de cada objetivo (idade × valor) e
   * terminar na aposentadoria, destacada em vermelho (redesenho aprovado,
   * 02/10/2026: "tudo em curva, não umas linhas soltas pontilhadas" + "os
   * objetivos podem ser substituídos por ícones"). Usada só pela tela
   * /retirement ("Futuro"); os cards compactos continuam em "scenarios". */
  variant?: "scenarios" | "hero";
  /** Série da curva Meta (ver buildMetaTrajectory em services/retirement) —
   * só usada quando variant="hero". `null` quando a meta já está coberta
   * pelo patrimônio de hoje, ou quando nem um retorno de 50%/ano chegaria
   * lá — nos dois casos a curva Meta simplesmente não aparece (o marcador
   * fixo da Aposentadoria continua mostrando o destino de qualquer jeito). */
  metaTrajectory?: MetaTrajectory | null;
}) {
  const isHero = variant === "hero";
  // Objetivos sem valor-alvo não têm onde ser plotados no eixo Y (que agora
  // é o valor em R$, não mais y=0) — ficam de fora do "liga os pontos". Com
  // a "Data para conquista" virando obrigatória na criação (02/10/2026),
  // isso só deve acontecer pra objetivos criados antes dessa mudança.
  const plottableGoals = goalMarkers.filter((g): g is ChartGoalMarker & { targetAmount: number } => (g.targetAmount ?? 0) > 0);
  const heroMaxAge = isHero ? Math.max(targetAge, ...plottableGoals.map((g) => g.age)) : undefined;
  const data = buildDataset(simulation, targetAge, heroMaxAge, isHero ? metaTrajectory : null);

  // Normally 0 already sits at the bottom of the axis (it's the domain's
  // minimum whenever there's any positive net worth in the series). But for
  // a scenario that's negative the whole way through, 0 becomes the domain's
  // MAXIMUM instead — which recharts places at the top by default, leaving
  // "0k" stranded above a big block of negative numbers. Flipping the axis
  // (reversed) only in that specific case keeps 0 anchored to the bottom
  // like every other chart, while a normal (partly-positive) scenario keeps
  // its usual orientation.
  const curveValues = isHero
    ? data.map((d) => d.base).filter((v): v is number => v !== null)
    : data.flatMap((d) => [d.conservador, d.base, d.agressivo]).filter((v): v is number => v !== null);
  // Em "hero" o eixo também precisa caber o valor de cada objetivo e o
  // patrimônio necessário pra aposentadoria — senão um ícone fica pendurado
  // acima do topo do gráfico sempre que a meta é mais alta que a curva
  // chegou a ficar (exatamente o caso que esse gráfico existe pra mostrar).
  const heroTargets = isHero ? [simulation.requiredNetWorth, ...plottableGoals.map((g) => g.targetAmount)] : [];
  const allValues = [...curveValues, ...heroTargets];
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
        ok: "#5ecbb8",
        warn: "#e0b64f",
        // Vermelho de destaque da aposentadoria (redesenho aprovado,
        // 02/10/2026: "a linha de aposentadoria tem que ficar destacada em
        // vermelho") — mais vívido que o danger-600 do design system porque
        // precisa saltar aos olhos sobre o fundo escuro.
        aposentadoria: "#e5584a",
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
        ok: "#1f8f74",
        warn: "#a8791f",
        aposentadoria: "#c14a3a",
      };

  const gradientId = dark ? "retirementBaseFillDark" : "retirementBaseFillLight";
  const glowFilterId = "futureGlow";

  // Só plota marcador dentro do intervalo de idade que a curva realmente
  // desenha — um Sonho com data-alvo fora desse intervalo (ex.: muito além
  // do horizonte simulado) ficaria "pendurado" fora do gráfico.
  const minAge = data[0]?.age;
  const maxAge = data[data.length - 1]?.age;
  const visibleGoalMarkers =
    minAge != null && maxAge != null
      ? plottableGoals.filter((g) => g.age >= minAge && g.age <= maxAge)
      : [];

  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.base} stopOpacity={isHero ? 0.32 : 0.28} />
            <stop offset="100%" stopColor={palette.base} stopOpacity={0} />
          </linearGradient>
          {isHero && (
            <filter id={glowFilterId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
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
            Dashboard/onboarding) — na "hero" (tela "Futuro") os dois viraram
            o próprio traço da curva (que fica vermelho perto do fim) mais o
            marcador de destino na ponta, abaixo. */}
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
        {/* Curva da Aposentadoria: uma segunda curva de verdade, sólida (não
            pontilhada) e vermelha, separada da curva "Seu patrimônio" —
            mostra o ritmo necessário pra chegar na aposentadoria no prazo
            (ver buildMetaTrajectory). Só existe até a idade-alvo (não
            continua pra fase de "viver de renda", diferente da "base"), e só
            aparece quando há mesmo uma meta a perseguir: `null` quando ela
            já está coberta pelo patrimônio de hoje, ou quando nem um retorno
            de 50%/ano chegaria lá — nos dois casos o marcador fixo da
            Aposentadoria abaixo já mostra o destino de qualquer jeito
            (correção pedida pelo Thiago, 03/10/2026: "são duas curvas
            distintas... no gráfico parece uma só" — a versão anterior
            pintava a MESMA curva com um gradiente de cor em vez de desenhar
            duas curvas separadas). */}
        {isHero && metaTrajectory && (
          <Line
            type="monotone"
            dataKey="meta"
            stroke={palette.aposentadoria}
            strokeWidth={3}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
            filter={`url(#${glowFilterId})`}
          />
        )}
        {/* Ícone de cada objetivo plotado em (idade do prazo, valor que
            custa) — não mais uma curva própria por objetivo (ver comentário
            de GoalMarkerShape). A pergunta visual é só "nessa idade, meu
            patrimônio projetado já cobre isso?": daí o aro ficar ok/alerta
            conforme a curva, naquela idade, já alcança o valor ou não. */}
        {isHero &&
          visibleGoalMarkers.map((marker) => {
            const curveValueThere = valueAtAge(simulation.base.series, marker.age);
            const onTrack = marker.achieved || (curveValueThere != null && curveValueThere >= marker.targetAmount);
            return (
              <ReferenceDot
                key={marker.id}
                x={marker.age}
                y={marker.targetAmount}
                shape={(props: { cx?: number; cy?: number }) => (
                  <GoalMarkerShape cx={props.cx} cy={props.cy} marker={marker} onTrack={onTrack} palette={palette} />
                )}
              />
            );
          })}
        {/* Destino final: a aposentadoria, sempre na mesma posição fixa
            (idade-alvo × patrimônio necessário, calculados a partir das
            finanças da pessoa — não é algo que o traço "decide" sozinho) e
            sempre em destaque vermelho, com brilho, esteja a curva
            alcançando ou não (pedido do Thiago, 02/10/2026). */}
        {isHero && (
          <ReferenceDot
            x={targetAge}
            y={simulation.requiredNetWorth}
            shape={(props: { cx?: number; cy?: number }) => (
              <AposentadoriaMarkerShape
                cx={props.cx}
                cy={props.cy}
                requiredNetWorth={simulation.requiredNetWorth}
                color={palette.aposentadoria}
                ringColor={palette.tooltipBg}
                glowFilterId={glowFilterId}
              />
            )}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {showLegend && isHero && (
      <div className="flex items-center justify-center gap-4 mt-2.5 flex-wrap">
        <ChartLegendEntry color={palette.base} label="Seu patrimônio" />
        <ChartLegendEntry color={palette.aposentadoria} label="Aposentadoria" />
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
 * Um marcador de Sonho/Objetivo plotado em (idade do prazo, valor que
 * custa) — redesenho aprovado 02/10/2026: ícone de verdade (emoji por tipo,
 * ver GOAL_TYPE_GLYPH) em vez de uma curva própria ou de uma letra solta, e
 * em vez de uma linha pontilhada separada — o aro do círculo é que diz se o
 * patrimônio projetado, naquela idade, já cobre o objetivo (ok-400) ou não
 * (warn-400), reaproveitando o mesmo veredito de "no caminho certo" / "requer
 * ajuste" que o selo de texto abaixo do gráfico já usa pra aposentadoria.
 * Emoji em vez de um ícone Lucide embutido no shape: texto simples dentro de
 * um <text> do SVG, sem risco de desalinhar o path de um ícone vetorial sem
 * preview ao vivo.
 */
function GoalMarkerShape({
  cx,
  cy,
  marker,
  onTrack,
  palette,
}: {
  cx?: number;
  cy?: number;
  marker: ChartGoalMarker;
  onTrack: boolean;
  palette: { tooltipBg: string; ok: string; warn: string };
}) {
  if (cx == null || cy == null) return null;
  const glyph = marker.achieved ? "✓" : (GOAL_TYPE_GLYPH[marker.type] ?? "🎯");
  const ringColor = marker.achieved || onTrack ? palette.ok : palette.warn;
  const tooltip = [
    marker.title,
    GOAL_TYPE_LABEL[marker.type] ?? marker.type,
    marker.targetAmount ? formatBRL(marker.targetAmount) : null,
    marker.achieved ? "alcançado" : `previsto aos ${Math.round(marker.age)} anos`,
    marker.achieved ? null : onTrack ? "no caminho certo" : "requer ajuste",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <g>
      <title>{tooltip}</title>
      <circle cx={cx} cy={cy} r={12} fill={palette.tooltipBg} stroke={ringColor} strokeWidth={2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {glyph}
      </text>
    </g>
  );
}

/**
 * O destino final da curva: aposentadoria, sempre destacada em vermelho e
 * com um brilho sutil (pedido do Thiago, 02/10/2026), numa posição fixa —
 * calculada a partir da renda desejada, da renda garantida (INSS) e da
 * idade-alvo que a pessoa preencheu, nunca de onde a curva "decidiu" parar.
 * Fica no mesmo lugar esteja a curva passando por cima (no caminho certo) ou
 * por baixo (precisa ajustar aporte/retorno) desse marcador.
 */
function AposentadoriaMarkerShape({
  cx,
  cy,
  requiredNetWorth,
  color,
  ringColor,
  glowFilterId,
}: {
  cx?: number;
  cy?: number;
  requiredNetWorth: number;
  color: string;
  ringColor: string;
  glowFilterId: string;
}) {
  if (cx == null || cy == null) return null;
  return (
    <g filter={`url(#${glowFilterId})`}>
      <title>{`Aposentadoria · ${formatBRL(requiredNetWorth)}`}</title>
      <circle cx={cx} cy={cy} r={13} fill={color} stroke={ringColor} strokeWidth={2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12}>
        🏁
      </text>
      <text x={cx - 18} y={cy - 16} textAnchor="end" fontSize={11.5} fontWeight={700} fill={color}>
        {`Aposentadoria · ${formatCompactBRL(requiredNetWorth)}`}
      </text>
    </g>
  );
}
