"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, PlusCircle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
    <div className="flex-1 px-5 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-brand-950">Seus sonhos e objetivos</h1>
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
        <p className="text-sm text-ink-500 py-12 text-center">
          Você ainda não tem objetivos. Conte um sonho seu pro Tobias no chat, ou crie um aqui.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
          {others.length > 0 && (
            <>
              <p className="text-xs font-medium text-ink-500 pt-4">Outros</p>
              {others.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const [pending, startTransition] = useTransition();
  const [contribution, setContribution] = useState("");
  const pct = goal.targetAmount ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : null;

  return (
    <Card data-testid="goal-card" data-goal-title={goal.title}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-ink-900">{goal.title}</p>
              <Badge tone="brand">{TYPE_LABELS[goal.type]}</Badge>
              {goal.status !== "ACTIVE" && <Badge tone="neutral">{goal.status}</Badge>}
            </div>
            {goal.targetAmount ? (
              <p className="text-sm text-ink-500 mt-0.5">
                {formatBRL(goal.currentAmount)} de {formatBRL(goal.targetAmount)}
                {goal.targetDate ? ` · até ${new Date(goal.targetDate).toLocaleDateString("pt-BR")}` : ""}
              </p>
            ) : (
              <p className="text-sm text-ink-500 mt-0.5">Ainda não quantificado — conte mais detalhes ao Tobias.</p>
            )}
          </div>
          <button
            className="text-ink-400 hover:text-brand-800 shrink-0"
            title={goal.status === "ACTIVE" ? "Pausar" : "Retomar"}
            onClick={() =>
              startTransition(() => updateGoalStatusAction(goal.id, goal.status === "ACTIVE" ? "PAUSED" : "ACTIVE"))
            }
          >
            {goal.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>

        {pct !== null && <ProgressBar value={pct} className="mt-3" />}

        {goal.status === "ACTIVE" && (
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
                  startTransition(() => addContributionAction(goal.id, amount));
                  setContribution("");
                }
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Aportar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
