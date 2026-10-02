"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, PlusCircle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { createGoalAction, addContributionAction, updateGoalStatusAction, type GoalFormState } from "./actions";

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

const TYPE_LABELS: Record<string, string> = {
  DREAM: "Sonho",
  EMERGENCY_FUND: "Reserva de emergência",
  PROPERTY: "Imóvel",
  RETIREMENT: "Aposentadoria",
  CUSTOM: "Outro",
};

export function GoalsClient({ goals }: { goals: Goal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createGoalAction, undefined);

  const active = goals.filter((g) => g.status === "ACTIVE");
  const others = goals.filter((g) => g.status !== "ACTIVE");

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-sans font-bold text-2xl text-onbrand">Seus sonhos e objetivos</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo objetivo
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
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
                <Select id="type" name="type" defaultValue="DREAM">
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="targetAmount">Quanto custa? (opcional)</Label>
                <Input id="targetAmount" name="targetAmount" type="number" step="0.01" placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="targetDate">Prazo (opcional)</Label>
                <Input id="targetDate" name="targetDate" type="date" />
              </div>
              <div>
                <Label htmlFor="monthlyContribution">Quanto guardar por mês (opcional)</Label>
                <Input id="monthlyContribution" name="monthlyContribution" type="number" step="0.01" placeholder="0,00" />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <Button type="submit" loading={pending}>
                  Salvar objetivo
                </Button>
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
            <GoalCard key={g.id} goal={g} />
          ))}
          {others.length > 0 && (
            <>
              <p className="text-xs font-medium text-onbrand/55 pt-4">Outros</p>
              {others.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const [pending, startTransition] = useTransition();
  const [contribution, setContribution] = useState("");
  return (
    <Card data-testid="goal-card" data-goal-title={goal.title}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-onbrand">{goal.title}</p>
              <Badge tone="brand">{TYPE_LABELS[goal.type]}</Badge>
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

        <GoalMiniChart goal={goal} />

        {goal.status === "ACTIVE" &&
          (goal.type === "EMERGENCY_FUND" ? (
            <p className="text-xs text-onbrand/45 mt-3">
              Esse valor é calculado automaticamente a partir do seu saldo em conta e investimentos de liquidez
              imediata. Não precisa registrar aporte aqui.
            </p>
          ) : (
            <div className="mt-3 flex items-center gap-2">
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
                    startTransition(async () => {
                      await addContributionAction(goal.id, amount);
                    });
                    setContribution("");
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

// ---------------------------------------------------------------------------
// Mini-gráfico por sonho (redesenho aprovado, 02/10/2026 — mesma linguagem
// visual da curva Meta da aposentadoria: curva preenchida em vez de barra
// linear). Substitui a antiga <ProgressBar>.
// ---------------------------------------------------------------------------

// gold-400/ok-400/warn-400 são acentos FIXOS (não flipam com o tema — ver
// globals.css); brand-700 flipa, usado aqui só como neutro pra "Imóvel" (sem
// um acento próprio reservado pra esse tipo).
const GOAL_TYPE_COLOR: Record<string, string> = {
  DREAM: "var(--color-gold-400)",
  EMERGENCY_FUND: "var(--color-ok-400)",
  PROPERTY: "var(--color-brand-700)",
  CUSTOM: "var(--color-warn-400)",
  RETIREMENT: "var(--color-brand-700)",
};

/**
 * De onde (hoje, em fração do valor-alvo) até onde (projeção, mesma fração)
 * a curva vai. `goals` só guarda um `currentAmount` corrente, sem histórico
 * de aportes salvo — então a curva não reconstrói o passado, só projeta daqui
 * pra frente com o aporte mensal informado, do mesmo jeito que a curva Meta
 * da aposentadoria (ver `buildMetaTrajectory` em services/retirement.ts).
 * `null` quando não há valor-alvo (goal ainda não quantificado). Fica
 * achatada no nível atual quando a meta já foi atingida, ou quando falta
 * prazo/aporte pra projetar — sem inventar um prazo que ninguém informou.
 */
function goalProjection(goal: Goal): { from: number; to: number } | null {
  if (!goal.targetAmount || goal.targetAmount <= 0) return null;
  const pctNow = Math.min(1, goal.currentAmount / goal.targetAmount);
  if (pctNow >= 1 || !goal.targetDate || !goal.monthlyContribution || goal.monthlyContribution <= 0) {
    return { from: pctNow, to: pctNow };
  }
  const monthsRemaining = Math.max(
    1,
    Math.round((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  const projected = (goal.currentAmount + goal.monthlyContribution * monthsRemaining) / goal.targetAmount;
  return { from: pctNow, to: Math.max(pctNow, Math.min(1, projected)) };
}

function GoalMiniChart({ goal }: { goal: Goal }) {
  const projection = goalProjection(goal);
  if (!projection) return null;

  const color = GOAL_TYPE_COLOR[goal.type] ?? GOAL_TYPE_COLOR.CUSTOM;
  const gradientId = `goal-fill-${goal.id}`;
  const width = 240;
  const height = 56;
  const top = 6;
  const bottom = height - 4;
  const toY = (v: number) => bottom - v * (bottom - top);
  const y0 = toY(projection.from);
  const y1 = toY(projection.to);
  // Só 2 pontos reais (hoje, projeção) — uma única curva suave entre eles em
  // vez de reta, pra conversar visualmente com a curva Meta da aposentadoria.
  const line = `M0,${y0} C${width * 0.35},${y0 - (y0 - y1) * 0.15} ${width * 0.65},${y1 + (y0 - y1) * 0.3} ${width},${y1}`;
  const area = `${line} L${width},${bottom} L0,${bottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="mt-3">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
