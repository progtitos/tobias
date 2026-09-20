import { formatBRL } from "@/lib/utils/money";

/**
 * Duas leituras simples, sem eixo/legenda — cada barra já se identifica pelo
 * próprio rótulo (mesmo padrão de mark direto-com-label usado no resto do
 * produto, ver ProgressBar/GoalsClient), então uma legenda separada só
 * repetiria informação. Renda e gastos fixos usam tons diferentes (ok vs
 * gold) porque são duas ENTIDADES diferentes sendo comparadas lado a lado,
 * não uma sequência de magnitude só — dentro de cada grupo, as barras variam
 * só de tamanho (mesma cor), porque ali sim é uma sequência (fontes do maior
 * pro menor valor).
 */
type BarRow = { label: string; value: number };

function BarList({ rows, tone, emptyLabel }: { rows: BarRow[]; tone: "ok" | "gold"; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-onbrand/45">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  const barTone = tone === "ok" ? "bg-ok-400" : "bg-gold-400";
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-sm text-onbrand/75 truncate">{row.label}</span>
            <span className="text-sm font-medium text-onbrand tabular-nums shrink-0">{formatBRL(row.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-black/25 overflow-hidden">
            <div
              className={`h-full rounded-full ${barTone} transition-all`}
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({
  incomeRows,
  expenseRows,
}: {
  incomeRows: BarRow[];
  expenseRows: BarRow[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-onbrand/50 mb-3">Renda mensal esperada</p>
        <BarList rows={incomeRows} tone="ok" emptyLabel="Nenhuma fonte de renda cadastrada ainda." />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-onbrand/50 mb-3">Gastos fixos esperados</p>
        <BarList rows={expenseRows} tone="gold" emptyLabel="Nenhum gasto fixo cadastrado ainda." />
      </div>
    </div>
  );
}
