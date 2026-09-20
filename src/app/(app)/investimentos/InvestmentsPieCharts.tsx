import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { formatBRL } from "@/lib/utils/money";

/**
 * Demonstrativo visual da carteira — pedido do Thiago (2026-09-20): "a aba
 * investimentos tem que ser gráficos em pizza para cada tipo de investimento
 * como demonstrativo ao cliente, e para onde ele quer aportar aqui para cada
 * objetivo sonho". Dois cortes complementares sobre o mesmo total investido
 * (soma de currentAmount):
 *
 *  - Por tipo (renda fixa, ações, fundos...) — a composição da carteira em
 *    si, o que um consultor mostraria pra explicar diversificação.
 *  - Por objetivo (sonho) — quanto já está alocado pra cada meta vs. sem
 *    destino nenhum. O campo "Ligar a um objetivo" já existe no cadastro de
 *    investimento (InvestimentsSection); isso só dá visibilidade ao que já
 *    foi escolhido lá.
 *
 * Cores fixas (gold/ok/danger/warn — ver globals.css) em vez dos tons brand-*
 * que flipam com o tema: um gráfico não pode mudar de cor conforme o tema
 * claro/escuro do usuário, senão a legenda perde a correspondência visual.
 */

type Investment = {
  type: string;
  currentAmount: number;
  goalId: string | null;
  goalTitle: string | null;
};

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  FUNDS: "Fundos",
  STOCKS: "Ações",
  ETF: "ETF",
  REIT: "Fundos imobiliários",
  PENSION: "Previdência",
  TREASURY: "Tesouro Direto",
  OTHER: "Outro",
};

// Sequência fixa o bastante pra reaproveitar em qualquer corte (tipo ou
// objetivo) sem repetir cor entre fatias vizinhas na maioria dos casos reais
// (poucos tipos/objetivos por pessoa).
const SLICE_COLORS = [
  "#ffb648", // gold-400
  "#5ecbb8", // ok-400
  "#f08a72", // danger-300
  "#a8631a", // gold-700
  "#1f8f74", // ok-600
  "#a8791f", // warn-600
  "#c14a3a", // danger-600
  "#7a828a", // neutral (brand-500-ish, fixo pra "Outro"/"Sem objetivo")
];

type Slice = { key: string; label: string; value: number; color: string };

function buildSlices(groups: Map<string, { label: string; value: number }>): Slice[] {
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, value: g.value }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

function DonutChart({ slices, total }: { slices: Slice[]; total: number }) {
  let acc = 0;
  const stops =
    total > 0
      ? slices.map((s) => {
          const start = (acc / total) * 100;
          acc += s.value;
          const end = (acc / total) * 100;
          return `${s.color} ${start}% ${end}%`;
        })
      : ["#2c3339 0% 100%"]; // brand-700, carteira vazia

  return (
    <div
      className="relative h-36 w-36 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
    >
      <div className="absolute inset-[16%] rounded-full bg-brand-800 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-[9px] uppercase tracking-wide text-onbrand/45">Total</span>
        <span className="text-xs font-semibold tabular-nums text-onbrand leading-tight">{formatBRL(total)}</span>
      </div>
    </div>
  );
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      {slices.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          <span className="text-onbrand/75 truncate flex-1">{s.label}</span>
          <span className="tabular-nums text-onbrand/55 shrink-0">
            {total > 0 ? Math.round((s.value / total) * 100) : 0}%
          </span>
          <span className="tabular-nums font-medium text-onbrand shrink-0 w-24 text-right">{formatBRL(s.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieCard({
  title,
  caption,
  slices,
  total,
}: {
  title: string;
  caption?: React.ReactNode;
  slices: Slice[];
  total: number;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <h3 className="font-display font-semibold text-onbrand mb-1">{title}</h3>
        {caption && <p className="text-xs text-onbrand/45 mb-4">{caption}</p>}
        {slices.length === 0 ? (
          <p className="text-sm text-onbrand/45">Nada por aqui ainda.</p>
        ) : (
          <div className="flex items-center gap-5 flex-wrap">
            <DonutChart slices={slices} total={total} />
            <Legend slices={slices} total={total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InvestmentsPieCharts({ investments }: { investments: Investment[] }) {
  if (investments.length === 0) return null;

  const total = investments.reduce((s, i) => s + i.currentAmount, 0);

  const byType = new Map<string, { label: string; value: number }>();
  for (const inv of investments) {
    const label = INVESTMENT_TYPE_LABELS[inv.type] ?? inv.type;
    const prev = byType.get(inv.type)?.value ?? 0;
    byType.set(inv.type, { label, value: prev + inv.currentAmount });
  }

  const byGoal = new Map<string, { label: string; value: number }>();
  for (const inv of investments) {
    const key = inv.goalId ?? "__none__";
    const label = inv.goalId ? inv.goalTitle ?? "Objetivo removido" : "Sem objetivo definido";
    const prev = byGoal.get(key)?.value ?? 0;
    byGoal.set(key, { label, value: prev + inv.currentAmount });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <PieCard
        title="Por tipo de investimento"
        caption="Como o total investido se divide entre renda fixa, ações, fundos..."
        slices={buildSlices(byType)}
        total={total}
      />
      <PieCard
        title="Por objetivo (sonho)"
        caption={
          <>
            Quanto do investido já está reservado pra cada objetivo. Pra ver o progresso de cada um (quanto falta,
            não só a fatia), veja em{" "}
            <Link href="/patrimonio#sonhos" className="text-gold-400 hover:underline">
              Patrimônio → Sonhos
            </Link>
            .
          </>
        }
        slices={buildSlices(byGoal)}
        total={total}
      />
    </div>
  );
}
