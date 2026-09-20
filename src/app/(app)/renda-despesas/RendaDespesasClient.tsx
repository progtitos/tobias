"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Check, X, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { IncomeExpenseChart } from "./IncomeExpenseChart";
import {
  createIncomeSourceAction,
  updateIncomeSourceAction,
  createFixedExpenseAction,
  updateFixedExpenseAction,
  confirmPendingTransactionAction,
  dismissPendingTransactionAction,
  type RendaDespesasFormState,
} from "./actions";

type IncomeSource = {
  id: string;
  description: string;
  amount: number;
  deductionAmount: number | null;
  category: string;
  categoryId: string | null;
  deductionCategoryId: string | null;
  dayOfMonth: number | null;
  isActive: boolean;
};

type FixedExpense = {
  id: string;
  description: string;
  amount: number;
  categoryId: string | null;
  dayOfMonth: number | null;
  isActive: boolean;
};

type Pending = { id: string; date: string; description: string; amount: number; type: string };

type CategoryOption = { id: string; name: string };

const INCOME_KIND_LABELS: Record<string, string> = {
  SALARY: "Salário (CLT/servidor)",
  FREELANCE: "Trabalho autônomo (ex: Uber, freelance)",
  RENTAL: "Aluguel recebido (ex: Airbnb, imóvel alugado)",
  BUSINESS: "Negócio próprio",
  BENEFIT: "Benefício/auxílio",
  OTHER: "Outra renda",
};

// Fontes onde faz sentido separar bruto de líquido — ver
// INCOME_KINDS_WITH_SECOND_LEG em services/incomeExpenseSources.ts.
const KINDS_WITH_SECOND_LEG = new Set(["SALARY", "FREELANCE", "RENTAL", "BUSINESS"]);

// Fontes cujo valor tipicamente varia mês a mês (corridas do Uber, diárias
// do Airbnb...) — só muda o rótulo/aviso do campo de valor pra deixar claro
// que é uma estimativa de partida, não um valor fixo. O ajuste de verdade
// mês a mês acontece em "Pra confirmar este mês", que já retroalimenta essa
// estimativa (ver confirmPendingTransaction).
const VARIABLE_KINDS = new Set(["FREELANCE", "RENTAL"]);

function secondLegLabel(kind: string) {
  return kind === "SALARY" ? "Descontos (INSS, IR...)" : "Despesas (combustível, limpeza, taxas...)";
}

export function RendaDespesasClient({
  sources,
  fixedExpenses,
  pending,
  summary,
  incomeCategories,
  expenseCategories,
}: {
  sources: IncomeSource[];
  fixedExpenses: FixedExpense[];
  pending: Pending[];
  summary: {
    income: { id: string; label: string; gross: number; deduction: number; net: number }[];
    fixedExpenses: { id: string; label: string; amount: number }[];
    totalGrossIncome: number;
    totalDeductions: number;
    totalNetIncome: number;
    totalFixedExpenses: number;
  };
  incomeCategories: CategoryOption[];
  expenseCategories: CategoryOption[];
}) {
  const incomeRows = [...summary.income]
    .sort((a, b) => b.net - a.net)
    .map((i) => ({ label: i.label, value: i.net }));
  const expenseRows = [...summary.fixedExpenses]
    .sort((a, b) => b.amount - a.amount)
    .map((e) => ({ label: e.label, value: e.amount }));

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Renda e Despesas</h1>
          <p className="text-sm text-onbrand/55">
            Cadastre sua renda e seus gastos fixos uma vez — todo mês o Tobias já lança sozinho, você só confirma ou
            ajusta.
          </p>
          <p className="text-xs text-onbrand/45 mt-1">
            Procurando sua reserva de emergência? Ela é um cofre de patrimônio, não uma renda ou despesa — acompanhe e
            aporte nela em{" "}
            <Link href="/patrimonio#sonhos" className="text-gold-400 hover:underline">
              Patrimônio → Sonhos
            </Link>
            .
          </p>
        </div>

        {pending.length > 0 && (
          <Card className="border-gold-500/40">
            <CardContent className="py-5">
              <h2 className="font-display font-semibold text-onbrand mb-1">Pra confirmar este mês</h2>
              <p className="text-sm text-onbrand/55 mb-4">
                Gerados a partir do que você cadastrou abaixo — confira o valor e confirme, ou ajuste se veio
                diferente (renda e despesa de uma fonte variável, tipo Uber ou Airbnb, aparecem em linhas separadas
                pra ajustar cada uma). O valor que você confirmar aqui vira a nova expectativa pro mês que vem, então
                não precisa editar o cadastro da fonte toda vez que o valor mudar.
              </p>
              <div className="space-y-3">
                {pending.map((p) => (
                  <PendingRow key={p.id} pending={p} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-5">
            <h2 className="font-display font-semibold text-onbrand mb-4">Renda x gastos fixos</h2>
            <IncomeExpenseChart incomeRows={incomeRows} expenseRows={expenseRows} />
          </CardContent>
        </Card>

        <SourcesSection sources={sources} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />
        <FixedExpensesSection fixedExpenses={fixedExpenses} expenseCategories={expenseCategories} />
      </div>
    </div>
  );
}

function PendingRow({ pending }: { pending: Pending }) {
  const [pendingTx, startTransition] = useTransition();
  const [amount, setAmount] = useState(pending.amount);
  const isIncome = pending.type === "INCOME";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-brand-800 px-3.5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-onbrand truncate">{pending.description}</p>
        <p className="text-xs text-onbrand/50">{new Date(pending.date).toLocaleDateString("pt-BR")}</p>
      </div>
      <Badge tone={isIncome ? "ok" : "gold"}>{isIncome ? "Renda" : "Gasto"}</Badge>
      <CurrencyInput defaultValue={amount} onValueChange={setAmount} className="h-9 w-[140px]" />
      <Button
        size="sm"
        variant="outline"
        loading={pendingTx}
        onClick={() => startTransition(() => confirmPendingTransactionAction(pending.id, amount))}
      >
        <Check className="h-3.5 w-3.5" /> Confirmar
      </Button>
      <button
        className="text-onbrand/40 hover:text-danger-300 shrink-0"
        title="Descartar esse mês"
        onClick={() => startTransition(() => dismissPendingTransactionAction(pending.id))}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SourcesSection({
  sources,
  incomeCategories,
  expenseCategories,
}: {
  sources: IncomeSource[];
  incomeCategories: CategoryOption[];
  expenseCategories: CategoryOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState("SALARY");
  const [state, formAction, pending] = useActionState<RendaDespesasFormState, FormData>(createIncomeSourceAction, undefined);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-onbrand">Fontes de renda</h2>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Nova fonte
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          {sources.length === 0 && <p className="text-sm text-onbrand/45">Nenhuma fonte cadastrada ainda.</p>}
          {sources.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl bg-brand-800 px-3.5 py-3 ${!s.isActive ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-onbrand truncate">{s.description}</p>
                <p className="text-xs text-onbrand/50">
                  {formatBRL(s.amount)}
                  {s.deductionAmount ? ` − ${formatBRL(s.deductionAmount)} = ${formatBRL(s.amount - s.deductionAmount)} líquido` : ""}
                </p>
              </div>
              <button
                className="text-onbrand/40 hover:text-gold-400 shrink-0"
                title={s.isActive ? "Pausar" : "Retomar"}
                onClick={() => startTransition(() => updateIncomeSourceAction(s.id, !s.isActive))}
              >
                {s.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>

        {showForm && (
          <form
            action={formAction}
            className="space-y-3 border-t border-onbrand/10 pt-4"
            onSubmit={() => setTimeout(() => setShowForm(false), 0)}
          >
            <div>
              <Label>Descrição</Label>
              <Input name="description" placeholder="Ex: Salário Empresa X, Uber, Airbnb apto Centro" required />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select name="category" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(INCOME_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  {VARIABLE_KINDS.has(kind) ? "Valor estimado (mês atual)" : `Valor${KINDS_WITH_SECOND_LEG.has(kind) ? " bruto" : ""} mensal`}
                </Label>
                <CurrencyInput name="amount" required />
              </div>
              {KINDS_WITH_SECOND_LEG.has(kind) && (
                <div>
                  <Label>{secondLegLabel(kind)}{VARIABLE_KINDS.has(kind) ? " (estimado)" : ""}</Label>
                  <CurrencyInput name="deductionAmount" />
                </div>
              )}
            </div>
            {VARIABLE_KINDS.has(kind) && (
              <p className="text-xs text-onbrand/45 -mt-1">
                Não precisa ser exato — é só o ponto de partida. Todo mês você confirma ou ajusta o valor real em
                &quot;Pra confirmar este mês&quot;, e o Tobias já usa esse valor como estimativa do mês seguinte.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria da renda</Label>
                <Select name="categoryId" defaultValue="">
                  <option value="">Sem categoria</option>
                  {incomeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {KINDS_WITH_SECOND_LEG.has(kind) && (
                <div>
                  <Label>Categoria do desconto/despesa</Label>
                  <Select name="deductionCategoryId" defaultValue="">
                    <option value="">Sem categoria</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Dia do mês em que costuma cair (opcional)</Label>
              <Input name="dayOfMonth" type="number" min={1} max={28} placeholder="Ex: 5" />
            </div>
            <FieldError>{state?.error}</FieldError>
            <Button type="submit" loading={pending}>
              Salvar fonte
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FixedExpensesSection({
  fixedExpenses,
  expenseCategories,
}: {
  fixedExpenses: FixedExpense[];
  expenseCategories: CategoryOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<RendaDespesasFormState, FormData>(createFixedExpenseAction, undefined);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-onbrand">Gastos fixos obrigatórios</h2>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Novo gasto fixo
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          {fixedExpenses.length === 0 && <p className="text-sm text-onbrand/45">Nenhum gasto fixo cadastrado ainda.</p>}
          {fixedExpenses.map((e) => (
            <div key={e.id} className={`flex items-center gap-3 rounded-xl bg-brand-800 px-3.5 py-3 ${!e.isActive ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-onbrand truncate">{e.description}</p>
                <p className="text-xs text-onbrand/50">{formatBRL(e.amount)}/mês</p>
              </div>
              <button
                className="text-onbrand/40 hover:text-gold-400 shrink-0"
                title={e.isActive ? "Pausar" : "Retomar"}
                onClick={() => startTransition(() => updateFixedExpenseAction(e.id, !e.isActive))}
              >
                {e.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>

        {showForm && (
          <form
            action={formAction}
            className="space-y-3 border-t border-onbrand/10 pt-4"
            onSubmit={() => setTimeout(() => setShowForm(false), 0)}
          >
            <div>
              <Label>Descrição</Label>
              <Input name="description" placeholder="Ex: Aluguel, Pensão" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor mensal</Label>
                <CurrencyInput name="amount" required />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select name="categoryId" defaultValue="">
                  <option value="">Sem categoria</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Dia do mês em que vence (opcional)</Label>
              <Input name="dayOfMonth" type="number" min={1} max={28} placeholder="Ex: 10" />
            </div>
            <FieldError>{state?.error}</FieldError>
            <Button type="submit" loading={pending}>
              Salvar gasto fixo
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
