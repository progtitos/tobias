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
}: {
  simulation: RetirementSimulation;
  targetAge: number;
  height?: number;
}) {
  const data = buildDataset(simulation, targetAge);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece5d3" />
        <XAxis dataKey="age" tick={{ fontSize: 12, fill: "#6b6f66" }} tickFormatter={(v) => `${v}a`} />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b6f66" }}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={46}
        />
        <Tooltip
          formatter={(value, name) => [typeof value === "number" ? formatBRL(value) : value, name]}
          labelFormatter={(age) => `${age} anos`}
          contentStyle={{ borderRadius: 12, borderColor: "#ece5d3", fontSize: 13 }}
        />
        <ReferenceLine
          y={simulation.requiredNetWorth}
          stroke="#a5822f"
          strokeDasharray="4 4"
          label={{ value: "Necessário", fontSize: 11, fill: "#8a6a24", position: "insideTopLeft" }}
        />
        <Line type="monotone" dataKey="conservador" stroke="#a3a89c" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="base" stroke="#1a6349" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="agressivo" stroke="#bd9a44" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
