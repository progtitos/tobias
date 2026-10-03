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
import type { RetirementSimulation, IdealTrajectory, ScenarioPoint, ScenarioGoalOutcome } from "@/services/retirement";
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

// As três linhas projetam o PATRIMÔNIO TOTAL (investido + outros bens, não
// mais soma o saldo em conta desde 03/10/2026 — ver computeNetWorth em
// services/aggregations.ts) sob taxas de retorno hipotéticas diferentes — não são
// uma alocação real nem uma recomendação de quanto investir em renda
// variável. O rótulo do tooltip deixa isso explícito (pedido do Thiago: os
// nomes "agressivo"/"base"/"conservador" sozinhos passavam a impressão de que
// eram opções de investimento, ou de que só dinheiro investido crescia assim).
const SCENARIO_TOOLTIP_LABEL: Record<string, string> = {
  conservador: "Patrimônio · cenário conservador",
  base: "Patrimônio · cenário base",
  agressivo: "Patrimônio · cenário agressivo",
};

// Rótulos do tooltip na variante "hero" (estilo 2 aprovado, 03/10/2026):
// patrimônio projetado, principal investido (sem rendimento) e a curva
// "Aposentadoria Ideal" — três conceitos diferentes dos 3 cenários lado a
// lado da variante "scenarios", por isso um mapa de rótulos à parte.
const HERO_TOOLTIP_LABEL: Record<string, string> = {
  base: "Patrimônio projetado",
  principal: "Principal investido",
  ideal: "Aposentadoria ideal",
};

// Tooltip em card (redesenho aprovado, 02/10/2026 — "legenda, eixo Y
// visível, tooltip em card"; estendido no redesenho "estilo 2", 03/10/2026,
// pra também servir a variante "hero" com seus próprios rótulos): cabeçalho
// com a idade + uma linha por série (bolinha colorida igual à linha do
// gráfico, nome e valor alinhados), em vez do tooltip padrão do Recharts
// (DefaultTooltipContent, uma lista crua). A <Area> usada só pra pintar o
// gradiente sob a linha "base" tem o mesmo dataKey da <Line> "base" (mesmo
// dado, dois elementos gráficos) — sem essa dedupe, o tooltip mostraria a
// mesma linha duas vezes seguidas.
function ChartTooltipContent(
  props: TooltipContentProps<ValueType, NameType> & {
    palette: { tooltipBg: string; tooltipBorder: string; tooltipText: string };
    labels: Record<string, string>;
  }
) {
  const { active, label, palette, labels } = props;
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
              {labels[p.dataKey as string] ?? p.name}
            </span>
            <span className="font-medium tabular-nums">{typeof p.value === "number" ? formatBRL(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDataset(
  sim: RetirementSimulation,
  targetAge: number,
  maxAgeOverride?: number,
  idealTrajectory?: IdealTrajectory | null,
  principalSeries?: ScenarioPoint[] | null
) {
  const byAge = (series: RetirementSimulation["base"]["series"] | ScenarioPoint[]) => {
    const map = new Map<number, number>();
    for (const p of series) map.set(Math.round(p.age), p.value);
    return map;
  };
  const cons = byAge(sim.conservative.series);
  const base = byAge(sim.base.series);
  const agg = byAge(sim.aggressive.series);
  const ideal = idealTrajectory ? byAge(idealTrajectory.series) : null;
  const principal = principalSeries ? byAge(principalSeries) : null;

  const minAge = Math.round(sim.conservative.series[0]?.age ?? 0);
  const lastAge = (series: RetirementSimulation["base"]["series"]) => Math.round(series.at(-1)?.age ?? minAge);
  const naturalMaxAge = Math.max(targetAge, lastAge(sim.conservative.series), lastAge(sim.base.series), lastAge(sim.aggressive.series));
  // Na variante "hero" o gráfico desenha até a expectativa de vida (ver
  // `lifeExpectancyAge` em RetirementChart — redesenho "estilo 2" aprovado,
  // 03/10/2026, corrigindo a versão anterior que parava exatamente na
  // aposentadoria: "não ta tendo a perspectiva de vida também igual na
  // amostra que mostrou"). Fora da "hero" mantém o horizonte completo de
  // sempre (ex.: cards compactos).
  const maxAge = maxAgeOverride != null ? Math.min(naturalMaxAge, maxAgeOverride) : naturalMaxAge;
  const ages = Array.from({ length: Math.max(0, maxAge - minAge + 1) }, (_, i) => minAge + i);

  return ages.map((age) => ({
    age,
    conservador: cons.get(age) ?? null,
    base: base.get(age) ?? null,
    agressivo: agg.get(age) ?? null,
    ideal: ideal?.get(age) ?? null,
    principal: principal?.get(age) ?? null,
  }));
}

export function RetirementChart({
  simulation,
  targetAge,
  lifeExpectancyAge,
  height = 260,
  dark = false,
  goalMarkers = [],
  goalOutcomes = [],
  showLegend = false,
  variant = "scenarios",
  idealTrajectory = null,
  principalSeries = null,
}: {
  simulation: RetirementSimulation;
  targetAge: number;
  /** Idade até onde a variante "hero" desenha a fase de "viver de renda" —
   * ver `estimateLifeExpectancyAge` em services/inss.ts. Ignorado fora da
   * "hero" (os cards compactos continuam parando no fim do cenário). */
  lifeExpectancyAge?: number;
  height?: number;
  /** Use the light-on-dark-green palette for cards on the redesigned dashboard. */
  dark?: boolean;
  /** Sonhos/Objetivos com data-alvo, plotados como marcadores na timeline do patrimônio (ver ChartGoalMarker acima). */
  goalMarkers?: ChartGoalMarker[];
  /** O que de fato aconteceu com cada objetivo no cenário base (ver
   * `ScenarioGoalOutcome`/`goalWithdrawals` em services/retirement —
   * pedido do Thiago, 03/10/2026: "objetivos, sonhos não estão entrando no
   * cálculo da curva"). Usado pra colorir o aro do ícone (ok/alerta) com o
   * MESMO veredito do saque simulado, em vez de recalcular por fora com
   * `valueAtAge` (que não bate mais depois que a curva passou a descontar
   * objetivos). Um objetivo sem outcome aqui (achieved, ou prazo já vencido)
   * cai no fallback por `valueAtAge`, mesmo cálculo de antes dessa mudança. */
  goalOutcomes?: ScenarioGoalOutcome[];
  /** Legenda abaixo do gráfico — 3 cenários em "scenarios", "Seu patrimônio"
   * + "Principal investido" + "Aposentadoria ideal" em "hero". */
  showLegend?: boolean;
  /** "scenarios" (padrão): as 3 linhas de cenário lado a lado, como hoje nos
   * cards compactos do Dashboard/onboarding. "hero": o patrimônio projetado
   * no cenário base ligando os objetivos até a aposentadoria e seguindo pela
   * fase de retirada até a expectativa de vida, ao lado da curva tracejada
   * "Aposentadoria Ideal" (redesenho "estilo 2" aprovado, 03/10/2026, sobre o
   * visual de referência que o Thiago mandou). Usada só pela tela /retirement
   * ("Futuro"); os cards compactos continuam em "scenarios". */
  variant?: "scenarios" | "hero";
  /** Curva "Aposentadoria Ideal" (ver buildIdealTrajectory em
   * services/retirement) — só usada quando variant="hero". `null` quando a
   * meta já está coberta pelo patrimônio de hoje, ou quando nem um retorno de
   * 50%/ano chegaria lá — nos dois casos a curva simplesmente não aparece (o
   * marcador fixo da Aposentadoria continua mostrando o destino). */
  idealTrajectory?: IdealTrajectory | null;
  /** Curva "Principal Investido" (ver buildPrincipalSeries em
   * services/retirement) — só usada quando variant="hero". */
  principalSeries?: ScenarioPoint[] | null;
}) {
  const isHero = variant === "hero";
  // Objetivos sem valor-alvo não têm onde ser plotados no eixo Y (que agora
  // é o valor em R$, não mais y=0) — ficam de fora do "liga os pontos". Com
  // a "Data para conquista" virando obrigatória na criação (02/10/2026),
  // isso só deve acontecer pra objetivos criados antes dessa mudança.
  const plottableGoals = goalMarkers.filter((g): g is ChartGoalMarker & { targetAmount: number } => (g.targetAmount ?? 0) > 0);
  const heroMaxAge = isHero
    ? Math.max(lifeExpectancyAge ?? targetAge, targetAge, ...plottableGoals.map((g) => g.age))
    : undefined;
  const data = buildDataset(simulation, targetAge, heroMaxAge, isHero ? idealTrajectory : null, isHero ? principalSeries : null);

  // Normally 0 already sits at the bottom of the axis (it's the domain's
  // minimum whenever there's any positive net worth in the series). But for
  // a scenario that's negative the whole way through, 0 becomes the domain's
  // MAXIMUM instead — which recharts places at the top by default, leaving
  // "0k" stranded above a big block of negative numbers. Flipping the axis
  // (reversed) only in that specific case keeps 0 anchored to the bottom
  // like every other chart, while a normal (partly-positive) scenario keeps
  // its usual orientation.
  const curveValues = isHero
    ? data.flatMap((d) => [d.base, d.principal]).filter((v): v is number => v !== null)
    : data.flatMap((d) => [d.conservador, d.base, d.agressivo]).filter((v): v is number => v !== null);
  // Em "hero" o eixo também precisa caber o valor de cada objetivo, o
  // patrimônio necessário pra aposentadoria e a curva "Aposentadoria Ideal"
  // inteira — senão um ícone ou a própria curva tracejada fica pendurado
  // acima do topo do gráfico sempre que a meta é mais alta que a curva real
  // chegou a ficar (exatamente o caso que esse gráfico existe pra mostrar).
  const idealValues = idealTrajectory ? idealTrajectory.series.map((p) => p.value) : [];
  const heroTargets = isHero ? [simulation.requiredNetWorth, ...plottableGoals.map((g) => g.targetAmount), ...idealValues] : [];
  const allValues = [...curveValues, ...heroTargets];
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const yDomainMaxRaw = Math.max(0, rawMax);
  const yDomainMin = Math.min(0, rawMin);
  const yReversed = yDomainMaxRaw === 0;
  // Dá uma folga de 12% acima do maior valor plotado só na "hero" (não
  // revertida) — sem isso, sempre que a Aposentadoria (ou um objetivo, ou a
  // própria curva "Aposentadoria Ideal") é o MAIOR valor do gráfico — o caso
  // mais comum, já que o patrimônio normalmente ainda não alcançou a meta —
  // o marcador cai bem na borda superior do SVG e fica cortado pela margem
  // (bug reportado pelo Thiago, 03/10/2026, print com "Aposentadoria" cortada
  // no canto superior direito).
  const yDomainMax = isHero && !yReversed && yDomainMaxRaw > 0 ? yDomainMaxRaw * 1.12 : yDomainMaxRaw;

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
        // Cinza do "Principal Investido" (estilo 2 aprovado, 03/10/2026) —
        // neutro o bastante pra nunca competir com o verde/vermelho, que são
        // as duas curvas que realmente importam comparar.
        principal: "#8a988f",
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
        principal: "#7c8780",
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
      <ComposedChart
        data={data}
        margin={
          // Na "hero" os marcadores (ícone de objetivo, ponto da
          // aposentadoria) são círculos desenhados em cima dos dados — sem
          // uma margem que caiba o raio deles, um objetivo com prazo bem
          // perto da idade atual (ou bem no fim do horizonte) cai perto do
          // x=0/x=max do SVG e tem metade do círculo cortada fora da área
          // visível (bug reportado pelo Thiago, 03/10/2026: ícone do
          // objetivo "casa" aparecendo pela metade, cortado à esquerda do
          // gráfico). Fora da "hero" não há marcador nenhum, só as 3 linhas
          // de cenário, então a margem apertada de sempre segue valendo.
          isHero ? { top: 20, right: 18, bottom: 4, left: 18 } : { top: 8, right: 12, bottom: 0, left: 0 }
        }
      >
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
        <Tooltip
          content={(props) => (
            <ChartTooltipContent {...props} palette={palette} labels={isHero ? HERO_TOOLTIP_LABEL : SCENARIO_TOOLTIP_LABEL} />
          )}
        />
        <ReferenceLine y={0} stroke={palette.tick} strokeOpacity={0.5} />
        {/* A linha horizontal "Necessário" e a vertical "Aposentadoria" só
            fazem sentido na variante "scenarios" (cards compactos do
            Dashboard/onboarding) — na "hero" (tela "Futuro") os dois viraram
            a própria curva tracejada "Aposentadoria Ideal" mais o marcador de
            destino na idade-alvo, abaixo. */}
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
        {/* Linha vertical sutil na idade de aposentadoria, separando
            visualmente a fase de acumulação da fase de "viver de renda" —
            só faz sentido na "hero", que agora desenha as duas fases
            (redesenho "estilo 2", 03/10/2026). */}
        {isHero && (
          <ReferenceLine x={targetAge} stroke={palette.grid} strokeDasharray="2 4" />
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
        {/* "Principal Investido" (estilo 2 aprovado, 03/10/2026): quanto
            entrou de verdade (patrimônio de hoje + aportes), sem nenhum
            rendimento — a distância dela até "Seu patrimônio" é o retorno
            composto de fato. Desenhada ANTES da linha base pra ficar por
            baixo visualmente quando as duas se cruzam perto do início. */}
        {isHero && principalSeries && (
          <Line
            type="monotone"
            dataKey="principal"
            stroke={palette.principal}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
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
        {/* Curva "Aposentadoria Ideal": o ritmo necessário pra chegar na
            aposentadoria no prazo, continuando pela mesma fase de retirada
            até a expectativa de vida (ver buildIdealTrajectory) — tracejada
            pra se diferenciar como uma referência/meta, não uma projeção real
            (redesenho "estilo 2" aprovado, 03/10/2026, sobre o visual que o
            Thiago mandou). Só aparece quando há mesmo uma meta a perseguir:
            `null` quando ela já está coberta pelo patrimônio de hoje, ou
            quando nem um retorno de 50%/ano chegaria lá — nos dois casos o
            marcador fixo da Aposentadoria abaixo já mostra o destino de
            qualquer jeito. */}
        {isHero && idealTrajectory && (
          <Line
            type="monotone"
            dataKey="ideal"
            stroke={palette.aposentadoria}
            strokeWidth={2.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
            filter={`url(#${glowFilterId})`}
          />
        )}
        {/* Ícone de cada objetivo plotado em (idade do prazo, valor que
            custa) — não mais uma curva própria por objetivo (ver comentário
            de GoalMarkerShape). O aro ok/alerta usa o MESMO veredito do saque
            de verdade simulado em `goalOutcomes` (ver comentário da prop) —
            objetivo achieved ou com prazo já vencido não tem outcome, cai no
            fallback por `valueAtAge` (comportamento de antes do desconto por
            objetivo entrar na curva, 03/10/2026).

            `x` usa a idade ARREDONDADA, não `marker.age` cru — bug reportado
            pelo Thiago, 03/10/2026 ("os ícones dos projeto ainda não aparece
            na curva"): o eixo X é categórico (`XAxis dataKey="age"`, sem
            `type="number"`), com uma categoria por ano inteiro (ver `ages` em
            `buildDataset`, que só gera inteiros). Um objetivo real quase
            nunca cai bem num aniversário (a idade vem de "hoje até a
            data-alvo", um número fracionário), então o Recharts não achava a
            categoria exata e o `ReferenceDot` (que só mapeia valores que
            batem com uma categoria) resolvia pra x=0 — o ícone ia parar
            espremido contra a borda esquerda do gráfico, atrás da margem,
            em vez de na idade certa (mesma causa-raiz do bug anterior do
            ícone "cortado à esquerda", só que pior: agora ficava fora da
            área visível de vez). O marcador fixo da Aposentadoria nunca teve
            esse problema por pura coincidência — `targetAge` já é um número
            inteiro (campo "Idade para se aposentar"). Arredondar aqui casa
            exatamente com a categoria mais próxima que a curva desenha,
            mesmo truque que o tooltip de cada marcador já usa pra exibir a
            idade ("previsto aos {Math.round(marker.age)} anos", abaixo). */}
        {isHero &&
          visibleGoalMarkers.map((marker) => {
            const outcome = goalOutcomes.find((o) => o.id === marker.id);
            const onTrack =
              marker.achieved ||
              outcome?.covered ||
              (outcome == null &&
                (() => {
                  const curveValueThere = valueAtAge(simulation.base.series, marker.age);
                  return curveValueThere != null && curveValueThere >= marker.targetAmount;
                })());
            return (
              <ReferenceDot
                key={marker.id}
                x={Math.round(marker.age)}
                y={marker.targetAmount}
                shape={(props: { cx?: number; cy?: number }) => (
                  <GoalMarkerShape cx={props.cx} cy={props.cy} marker={marker} onTrack={onTrack} palette={palette} />
                )}
              />
            );
          })}
        {/* Destino final: a aposentadoria, sempre na mesma posição fixa
            (idade-alvo × patrimônio necessário, calculados a partir das
            finanças da pessoa — não é algo que o traço "decide" sozinho),
            marcada com um ponto simples sobre a curva tracejada (o nome e o
            valor agora aparecem no tooltip ao passar o mouse, não mais num
            rótulo flutuante fixo — redesenho "estilo 2", 03/10/2026, que de
            quebra resolve o corte do rótulo no topo do gráfico reportado
            pelo Thiago no mesmo dia: sem texto flutuando acima do marcador,
            não tem mais o que cortar). */}
        {isHero && (
          <ReferenceDot
            x={Math.round(targetAge)}
            y={simulation.requiredNetWorth}
            shape={(props: { cx?: number; cy?: number }) => (
              <AposentadoriaMarkerShape
                cx={props.cx}
                cy={props.cy}
                requiredNetWorth={simulation.requiredNetWorth}
                color={palette.aposentadoria}
                ringColor={palette.tooltipBg}
              />
            )}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {showLegend && isHero && (
      <div className="flex items-center justify-center gap-4 mt-2.5 flex-wrap">
        <ChartLegendEntry color={palette.base} label="Seu patrimônio" />
        {principalSeries && <ChartLegendEntry color={palette.principal} label="Principal investido" />}
        <ChartLegendEntry color={palette.aposentadoria} label="Aposentadoria ideal" dashed />
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
 * tooltip ao passar o mouse (pedido do Thiago, 02/10/2026: "legenda").
 * `dashed` desenha um traço tracejado em vez da bolinha, pra séries
 * tracejadas no gráfico (ex.: "Aposentadoria ideal"). */
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
 * O destino final da curva: aposentadoria, numa posição fixa — calculada a
 * partir da renda desejada, da renda garantida (INSS) e da idade-alvo que a
 * pessoa preencheu, nunca de onde a curva "decidiu" parar. Um ponto simples
 * sobre a curva tracejada "Aposentadoria Ideal" (ver comentário no ponto de
 * uso, acima) — nome e valor aparecem no tooltip ao passar o mouse, não mais
 * num rótulo flutuante fixo (redesenho "estilo 2", 03/10/2026).
 */
function AposentadoriaMarkerShape({
  cx,
  cy,
  requiredNetWorth,
  color,
  ringColor,
}: {
  cx?: number;
  cy?: number;
  requiredNetWorth: number;
  color: string;
  ringColor: string;
}) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <title>{`Aposentadoria · ${formatBRL(requiredNetWorth)}`}</title>
      <circle cx={cx} cy={cy} r={5.5} fill={color} stroke={ringColor} strokeWidth={2} />
    </g>
  );
}
