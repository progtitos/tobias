"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBRL } from "@/lib/utils/money";
import { recalculateBudgetAction, updateBudgetLimitAction } from "./actions";

type BudgetRow = {
  id: string;
  categoryId: string | null;
  label: string;
  limitAmount: number;
  isAutoCalculated: boolean;
  actual: number;
  pctUsed: number;
  isOverrun: boolean;
};

export function BudgetClient({
  budgets,
  totalLimit,
  totalActual,
}: {
  budgets: BudgetRow[];
  totalLimit: number;
  totalActual: number;
}) {
  const [pending, startTransition] = useTransition();
  const totalPct = totalLimit > 0 ? Math.round((totalActual / totalLimit) * 100) : 0;

  return (
    <div className="flex-1 px-5 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-serif text-2xl text-brand-950">Seu orçamento</h1>
          <p className="text-sm text-ink-500 mt-1">
            Um guia dinâmico com base na sua renda e seus objetivos — ajuste qualquer limite quando quiser.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() => startTransition(() => recalculateBudgetAction())}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recalcular automaticamente
        </Button>
      </div>

      <Card className="my-6">
        <CardContent className="py-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink-700">Total do mês</span>
            <span className="font-medium text-ink-900">
              {formatBRL(totalActual)} de {formatBRL(totalLimit)} ({totalPct}%)
            </span>
          </div>
          <ProgressBar value={Math.min(100, totalPct)} barClassName={totalPct > 100 ? "bg-danger-600" : undefined} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {budgets.map((b) => (
          <BudgetRowCard key={b.id} budget={b} />
        ))}
      </div>
    </div>
  );
}

function BudgetRowCard({ budget }: { budget: BudgetRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget.limitAmount));
  const [pending, startTransition] = useTransition();
  const pct = Math.round(budget.pctUsed * 100);

  function save() {
    const amount = Number(value);
    if (amount >= 0) {
      startTransition(async () => {
        await updateBudgetLimitAction(budget.id, amount);
        setEditing(false);
      });
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink-900">{budget.label}</p>
            {!budget.isAutoCalculated && <Badge tone="neutral">Ajustado por você</Badge>}
            {budget.isOverrun && <Badge tone="danger">Estourou</Badge>}
          </div>

          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="0.01"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 w-28 text-sm"
              />
              <button className="text-ok-600 disabled:opacity-50" disabled={pending} onClick={save} title="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button
                className="text-ink-400"
                onClick={() => {
                  setEditing(false);
                  setValue(String(budget.limitAmount));
                }}
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              className="text-ink-400 hover:text-brand-800 shrink-0"
              title="Ajustar limite"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex justify-between text-sm mb-1">
          <span className="text-ink-500">
            {formatBRL(budget.actual)} de {formatBRL(budget.limitAmount)}
          </span>
          <span className={budget.isOverrun ? "text-danger-600 font-medium" : "text-ink-700"}>{pct}%</span>
        </div>
        <ProgressBar value={Math.min(100, pct)} barClassName={budget.isOverrun ? "bg-danger-600" : undefined} />
      </CardContent>
    </Card>
  );
}
