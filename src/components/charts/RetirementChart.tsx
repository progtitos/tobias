"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { RetirementSimulation } from "@/services/retirement";
import { formatBRL } from "@/lib/utils/money";

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
}: {
  simulation: RetirementSimulation;
  targetAge: number;
  height?: number;
  /** Use the light-on-dark-green palette for cards on the redesigned dashboard. */
  dark?: boolean;
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
          formatter={(value, name) => [typeof value === "number" ? formatBRL(value) : value, name]}
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
      </ComposedChart>
    </ResponsiveContainer>
  );
}
