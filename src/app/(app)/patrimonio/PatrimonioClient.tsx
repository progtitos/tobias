"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  createInvestmentAction,
  updateInvestmentValueAction,
  addInvestmentContributionAction,
  deleteInvestmentAction,
  type PatrimonioFormState,
} from "./actions";

type Investment = {
  id: string;
  name: string;
  type: string;
  investedAmount: number;
  currentAmount: number;
  liquidity: string | null;
  institution: string | null;
  goalId: string | null;
  goalTitle: string | null;
};

type Goal = { id: string; title: string };

type NetWorth = {
  liquidAssets: number;
  investedAssets: number;
  otherAssets: number;
  totalDebt: number;
  netWorth: number;
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

export function PatrimonioClient({
  investments,
  goals,
  netWorth,
}: {
  investments: Investment[];
  goals: Goal[];
  netWorth: NetWorth;
}) {
  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Seu patrimônio</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Seus investimentos e o patrimônio líquido que eles formam junto com suas contas. Esses números alimentam a
          curva de aposentadoria e o Ponteiro — para editar suas contas bancárias, vá em Conta.
        </p>

        <NetWorthSummary netWorth={netWorth} />

        <h2 className="font-sans font-medium text-lg text-onbrand mt-8 mb-4">Investimentos</h2>

        <InvestmentsSection investments={investments} goals={goals} />
      </div>
    </div>
  );
}

function NetWorthSummary({ netWorth }: { netWorth: NetWorth }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-0.5">Patrimônio líquido</p>
            <p
              className={cn(
                "font-sans font-medium text-3xl tracking-tight tabular-nums",
                netWorth.netWorth >= 0 ? "text-onbrand" : "text-danger-300"
              )}
            >
              {formatBRL(netWorth.netWorth)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
          <SummaryFigure label="Em contas" value={netWorth.liquidAssets} />
          <SummaryFigure label="Investido" value={netWorth.investedAssets} />
          <SummaryFigure label="Outros bens" value={netWorth.otherAssets} />
          <SummaryFigure label="Dívidas" value={netWorth.totalDebt} negative />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryFigure({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-onbrand/50 mb-0.5">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums", negative && value > 0 ? "text-danger-300" : "text-onbrand/85")}>
        {negative && value > 0 ? "−" : ""}
        {formatBRL(value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investimentos
// ---------------------------------------------------------------------------

function InvestmentsSection({ investments, goals }: { investments: Investment[]; goals: Goal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<PatrimonioFormState, FormData>(createInvestmentAction, undefined);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
          {investments.length} investimento{investments.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo investimento
        </Button>
      </div>

      {showForm && (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <form
              action={async (fd) => {
                await formAction(fd);
                setShowForm(false);
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="col-span-2">
                <Label htmlFor="inv-name">Nome</Label>
                <Input id="inv-name" name="name" placeholder="Ex: Tesouro Selic 2029" required />
              </div>
              <div>
                <Label htmlFor="inv-type">Tipo</Label>
                <Select id="inv-type" name="type" defaultValue="FIXED_INCOME">
                  {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="institution">Instituição (opcional)</Label>
                <Input id="institution" name="institution" placeholder="Ex: XP, Nubank..." />
              </div>
              <div>
                <Label htmlFor="investedAmount">Valor investido (R$)</Label>
                <Input id="investedAmount" name="investedAmount" type="number" step="0.01" placeholder="0,00" required />
              </div>
              <div>
                <Label htmlFor="currentAmount">Valor atual (opcional)</Label>
                <Input
                  id="currentAmount"
                  name="currentAmount"
                  type="number"
                  step="0.01"
                  placeholder="Igual ao investido, se vazio"
                />
              </div>
              <div>
                <Label htmlFor="liquidity">Liquidez (opcional)</Label>
                <Input id="liquidity" name="liquidity" placeholder="Ex: D+0, D+1, no vencimento..." />
              </div>
              <div>
                <Label htmlFor="inv-goalId">Ligar a um objetivo (opcional)</Label>
                <Select id="inv-goalId" name="goalId" defaultValue="">
                  <option value="">Não ligar a um objetivo</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar investimento
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {investments.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-12 text-center">
          Você ainda não cadastrou investimentos. Adicione os seus para o patrimônio, a curva de aposentadoria e o
          Ponteiro considerarem o que você já tem guardado.
        </p>
      ) : (
        <div className="space-y-2">
          {investments.map((inv) => (
            <InvestmentRow key={inv.id} investment={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvestmentRow({ investment }: { investment: Investment }) {
  const [pending, startTransition] = useTransition();
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(String(investment.currentAmount));
  const [contribution, setContribution] = useState("");

  const gain = investment.currentAmount - investment.investedAmount;
  const gainPct = investment.investedAmount > 0 ? (gain / investment.investedAmount) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-onbrand">{investment.name}</p>
              <Badge tone="brand">{INVESTMENT_TYPE_LABELS[investment.type]}</Badge>
              {investment.goalTitle && <Badge tone="gold">→ {investment.goalTitle}</Badge>}
            </div>
            <p className="text-xs text-onbrand/55 mt-0.5">
              {investment.institution ? `${investment.institution} · ` : ""}
              Aportado: {formatBRL(investment.investedAmount)}
              {investment.liquidity ? ` · Liquidez: ${investment.liquidity}` : ""}
            </p>
          </div>

          {editingValue ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                step="0.01"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                className="h-9 w-28"
                autoFocus
              />
              <button
                className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                disabled={pending}
                onClick={() => {
                  const value = Number(valueInput);
                  if (!Number.isNaN(value)) {
                    startTransition(() => updateInvestmentValueAction(investment.id, value));
                  }
                  setEditingValue(false);
                }}
              >
                <Check className="h-4 w-4" />
              </button>
              <button className="text-onbrand/40 hover:text-onbrand/70" onClick={() => setEditingValue(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <button
                className="flex items-center gap-1.5 group justify-end"
                onClick={() => {
                  setValueInput(String(investment.currentAmount));
                  setEditingValue(true);
                }}
                title="Atualizar valor atual"
              >
                <span className="font-medium tabular-nums text-onbrand">{formatBRL(investment.currentAmount)}</span>
                <Pencil className="h-3.5 w-3.5 text-onbrand/30 group-hover:text-gold-400" />
              </button>
              {gain !== 0 && (
                <p className={cn("text-xs tabular-nums", gain > 0 ? "text-ok-400" : "text-danger-300")}>
                  {gain > 0 ? "+" : ""}
                  {formatBRL(gain)} ({gainPct > 0 ? "+" : ""}
                  {gainPct.toFixed(1)}%)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Registrar aporte (R$)"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className="h-9 max-w-[180px]"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!contribution || pending}
              onClick={() => {
                const amount = Number(contribution);
                if (amount > 0) {
                  startTransition(() => addInvestmentContributionAction(investment.id, amount));
                  setContribution("");
                }
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Aportar
            </Button>
          </div>
          <button
            aria-label="Excluir"
            className="text-onbrand/35 hover:text-danger-300 transition-colors"
            disabled={pending}
            onClick={() => startTransition(() => deleteInvestmentAction(investment.id))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
