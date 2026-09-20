"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, PlusCircle, Pause, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { GoalProgressRing } from "./GoalProgressRing";
import {
  createGoalAction,
  addContributionAction,
  updateGoalStatusAction,
  updateGoalTargetAction,
  type GoalFormState,
} from "../goals/actions";

type Goal = {
  id: string;
  title: string;
  type: string;
  status: string;
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  targetDate: string | null;
  isQuantified: boolean;
};

type EmergencyFundSuggestion = {
  months: number;
  monthlyEssentialExpenses: number;
  suggestedTarget: number;
  reason: string;
} | null;

type NetWorth = {
  liquidAssets: number;
  investedAssets: number;
  otherAssets: number;
  totalDebt: number;
  netWorth: number;
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  DREAM: "Sonho",
  EMERGENCY_FUND: "Reserva de emergência",
  PROPERTY: "Imóvel",
  RETIREMENT: "Aposentadoria",
  CUSTOM: "Outro",
};

export function PatrimonioClient({
  goals,
  netWorth,
  emergencyFundSuggestion,
}: {
  goals: Goal[];
  netWorth: NetWorth;
  emergencyFundSuggestion: EmergencyFundSuggestion;
}) {
  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Patrimônio</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Seu patrimônio líquido e seus objetivos, num lugar só. Para editar investimentos, vá em Investimentos, para
          contas bancárias, vá em Conta.
        </p>

        <NetWorthSummary netWorth={netWorth} />

        <h2 id="sonhos" className="font-sans font-medium text-lg text-onbrand mt-8 mb-4 scroll-mt-6">
          Seus objetivos
        </h2>

        <GoalsSection goals={goals} emergencyFundSuggestion={emergencyFundSuggestion} />
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-onbrand/[0.06]">
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
// Sonhos (saiu do menu principal, mora aqui agora — mesmo conteúdo de sempre)
// ---------------------------------------------------------------------------

function GoalsSection({
  goals,
  emergencyFundSuggestion,
}: {
  goals: Goal[];
  emergencyFundSuggestion: EmergencyFundSuggestion;
}) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("DREAM");
  const [targetAmountKey, setTargetAmountKey] = useState(0);
  const [targetAmountDefault, setTargetAmountDefault] = useState<number | undefined>(undefined);
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createGoalAction, undefined);

  const active = goals.filter((g) => g.status === "ACTIVE");
  const others = goals.filter((g) => g.status !== "ACTIVE");
  const hasEmergencyFundGoal = goals.some((g) => g.type === "EMERGENCY_FUND");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
          {goals.length} objetivo{goals.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo objetivo
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
                <Label htmlFor="title">O que você quer conquistar?</Label>
                <Input id="title" name="title" placeholder="Ex: Viagem para a Europa" required />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="targetAmount">Quanto custa? (opcional)</Label>
                <CurrencyInput key={targetAmountKey} id="targetAmount" name="targetAmount" defaultValue={targetAmountDefault} />
              </div>
              {type === "EMERGENCY_FUND" && !hasEmergencyFundGoal && (
                <div className="col-span-2 -mt-1">
                  <EmergencyFundSuggestionBox
                    suggestion={emergencyFundSuggestion}
                    onUse={(amount) => {
                      setTargetAmountDefault(amount);
                      setTargetAmountKey((k) => k + 1);
                    }}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="targetDate">Prazo (opcional)</Label>
                <Input id="targetDate" name="targetDate" type="date" />
              </div>
              <div>
                <Label htmlFor="monthlyContribution">Quanto guardar por mês (opcional)</Label>
                <CurrencyInput id="monthlyContribution" name="monthlyContribution" />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar objetivo
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

      {goals.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-12 text-center">
          Você ainda não tem objetivos. Conte um sonho seu pro Tobias no chat, ou crie um aqui.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} emergencyFundSuggestion={emergencyFundSuggestion} />
          ))}
          {others.length > 0 && (
            <>
              <p className="text-xs font-medium text-onbrand/55 pt-4">Outros</p>
              {others.map((g) => (
                <GoalCard key={g.id} goal={g} emergencyFundSuggestion={emergencyFundSuggestion} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sugestão de meta de reserva de emergência — resposta direta à pergunta do
// Thiago (2026-09-20) "o Tobias precisa entender o quanto de reserva de
// emergência o cliente tem que ter": aplica a recomendação da Ameriprise (3
// a 6 meses de despesas essenciais, mais para renda única/variável) em cima
// do que a pessoa já cadastrou em Renda e Despesas. Ver
// computeEmergencyFundTarget em services/incomeExpenseSources.ts.
// ---------------------------------------------------------------------------

function EmergencyFundSuggestionBox({
  suggestion,
  onUse,
}: {
  suggestion: EmergencyFundSuggestion;
  onUse: (amount: number) => void;
}) {
  if (!suggestion) {
    return (
      <p className="text-xs text-onbrand/45 rounded-lg bg-brand-900/60 px-3 py-2.5">
        Cadastre seus gastos fixos em Renda e Despesas pra o Tobias sugerir uma meta baseada no que você realmente
        gasta por mês.
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-gold-100/[0.06] border border-gold-500/20 px-3 py-2.5">
      <Sparkles className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-onbrand/75">
          Sugestão: <b className="text-onbrand">{formatBRL(suggestion.suggestedTarget)}</b> ({suggestion.months} meses de
          gastos fixos, {formatBRL(suggestion.monthlyEssentialExpenses)}/mês) — {suggestion.reason}.
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-gold-400 hover:underline mt-1"
          onClick={() => onUse(suggestion.suggestedTarget)}
        >
          Usar esta meta
        </button>
      </div>
    </div>
  );
}

function GoalCard({ goal, emergencyFundSuggestion }: { goal: Goal; emergencyFundSuggestion: EmergencyFundSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [contribution, setContribution] = useState(0);
  // CurrencyInput não aceita `value` controlado (ver componente); mudar essa
  // key força ele a remontar em branco depois de um aporte confirmado.
  const [contributionKey, setContributionKey] = useState(0);
  const pct = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : null;
  const isEmergencyFund = goal.type === "EMERGENCY_FUND";

  return (
    <Card data-testid="goal-card" data-goal-title={goal.title}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <GoalProgressRing pct={pct} />
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-onbrand">{goal.title}</p>
                <Badge tone="brand">{GOAL_TYPE_LABELS[goal.type]}</Badge>
                {goal.status !== "ACTIVE" && <Badge tone="neutral">{goal.status}</Badge>}
              </div>
              {goal.targetAmount ? (
                <p className="text-sm text-onbrand/55 mt-0.5">
                  {formatBRL(goal.currentAmount)} de {formatBRL(goal.targetAmount)}
                  {goal.targetDate ? ` · até ${new Date(goal.targetDate).toLocaleDateString("pt-BR")}` : ""}
                </p>
              ) : (
                <p className="text-sm text-onbrand/55 mt-0.5">Ainda não quantificado. Conte mais detalhes ao Tobias.</p>
              )}
            </div>
          </div>
          <button
            className="text-onbrand/40 hover:text-gold-400 shrink-0"
            title={goal.status === "ACTIVE" ? "Pausar" : "Retomar"}
            onClick={() =>
              startTransition(() => updateGoalStatusAction(goal.id, goal.status === "ACTIVE" ? "PAUSED" : "ACTIVE"))
            }
          >
            {goal.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>

        {goal.status === "ACTIVE" &&
          (isEmergencyFund ? (
            <div className="mt-3 pl-[68px]">
              <p className="text-xs text-onbrand/45">
                Esse valor é calculado automaticamente a partir do seu saldo em conta e investimentos de liquidez
                imediata. Não precisa registrar aporte aqui.
              </p>
              {!goal.targetAmount && (
                <div className="mt-2">
                  <EmergencyFundSuggestionBox
                    suggestion={emergencyFundSuggestion}
                    onUse={(amount) => startTransition(() => updateGoalTargetAction(goal.id, amount))}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 pl-[68px] flex items-center gap-2">
              <CurrencyInput
                key={contributionKey}
                placeholder="Registrar aporte (R$)"
                onValueChange={setContribution}
                className="h-9 max-w-[180px]"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!contribution || pending}
                onClick={() => {
                  if (contribution > 0) {
                    startTransition(() => addContributionAction(goal.id, contribution));
                    setContribution(0);
                    setContributionKey((k) => k + 1);
                  }
                }}
              >
                <PlusCircle className="h-3.5 w-3.5" /> Aportar
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
