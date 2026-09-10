"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
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
  const ages = Array.from({ length: targetAge - minAge + 1 }, (_, i) => minAge + i);

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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
        <XAxis dataKey="age" tick={{ fontSize: 12, fill: palette.tick }} tickFormatter={(v) => `${v}a`} />
        <YAxis
          tick={{ fontSize: 11, fill: palette.tick }}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={46}
        />
        <Tooltip
          formatter={(value, name) => [typeof value === "number" ? formatBRL(value) : value, name]}
          labelFormatter={(age) => `${age} anos`}
          contentStyle={{
            borderRadius: 12,
            borderColor: palette.tooltipBorder,
            background: palette.tooltipBg,
            color: palette.tooltipText,
            fontSize: 13,
          }}
        />
        <ReferenceLine
          y={simulation.requiredNetWorth}
          stroke={palette.reference}
          strokeDasharray="4 4"
          label={{ value: "Necessário", fontSize: 11, fill: palette.referenceLabel, position: "insideTopLeft" }}
        />
        <Line type="monotone" dataKey="conservador" stroke={palette.conservador} strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="base" stroke={palette.base} strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="agressivo" stroke={palette.agressivo} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
