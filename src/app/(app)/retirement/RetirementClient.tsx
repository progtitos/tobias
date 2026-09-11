"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { formatBRL } from "@/lib/utils/money";
import { simulateRetirementCurve, requiredMonthlyContribution, type RetirementInputs } from "@/services/retirement";
import { saveRetirementPlanAction } from "./actions";

type Defaults = Omit<RetirementInputs, "currentNetWorth">;

export function RetirementClient({
  defaults,
  currentNetWorth,
  hasPlan,
}: {
  defaults: Defaults;
  currentNetWorth: number;
  hasPlan: boolean;
}) {
  const [inputs, setInputs] = useState<Defaults>(defaults);
  const [saved, setSaved] = useState(hasPlan);
  const [pending, startTransition] = useTransition();

  const fullInputs: RetirementInputs = { ...inputs, currentNetWorth };

  const simulation = useMemo(() => simulateRetirementCurve(fullInputs), [JSON.stringify(fullInputs)]);
  const suggestedContribution = useMemo(
    () => requiredMonthlyContribution(fullInputs, "base"),
    [JSON.stringify(fullInputs)]
  );

  function set<K extends keyof Defaults>(key: K, value: number) {
    setSaved(false);
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      await saveRetirementPlanAction(inputs);
      setSaved(true);
    });
  }

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-sans font-bold text-2xl text-onbrand">Curva de aposentadoria</h1>
          <p className="text-sm text-onbrand/55 mt-1">
            Simule cenários conservador, base e agressivo. Os números usam seu patrimônio real de hoje ({formatBRL(currentNetWorth)}).
          </p>
        </div>
        <Button size="sm" loading={pending} onClick={save}>
          <Save className="h-3.5 w-3.5" /> {saved ? "Salvo" : "Salvar plano"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 mt-6">
        <Card>
          <CardContent className="py-5">
            <RetirementChart simulation={simulation} targetAge={inputs.targetRetirementAge} height={300} dark />
            <div className="flex flex-wrap gap-1.5 mt-3">
              <ScenarioBadge label="Conservador" onTrack={simulation.conservative.onTrack} />
              <ScenarioBadge label="Base" onTrack={simulation.base.onTrack} />
              <ScenarioBadge label="Agressivo" onTrack={simulation.aggressive.onTrack} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="text-onbrand/70">
                Patrimônio necessário para viver de renda: <span className="font-medium text-onbrand">{formatBRL(simulation.requiredNetWorth)}</span>
              </p>
              <p className="text-onbrand/70">
                Projeção no cenário base aos {inputs.targetRetirementAge} anos:{" "}
                <span className="font-medium text-onbrand">{formatBRL(simulation.base.finalValueAtTargetAge)}</span>
              </p>
              {!simulation.base.onTrack && (
                <p className="text-gold-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Para chegar lá no cenário base, o aporte mensal precisaria ser de aproximadamente{" "}
                  <span className="font-medium">{formatBRL(suggestedContribution)}</span>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="py-5 space-y-4">
            <NumberField label="Sua idade" value={inputs.currentAge} onChange={(v) => set("currentAge", v)} step={1} />
            <NumberField
              label="Idade para se aposentar"
              value={inputs.targetRetirementAge}
              onChange={(v) => set("targetRetirementAge", v)}
              step={1}
            />
            <NumberField
              label="Renda mensal desejada"
              value={inputs.desiredMonthlyIncome}
              onChange={(v) => set("desiredMonthlyIncome", v)}
              prefix="R$"
            />
            <NumberField
              label="Aporte mensal atual"
              value={inputs.monthlyContribution}
              onChange={(v) => set("monthlyContribution", v)}
              prefix="R$"
            />
            <div>
              <Label>Retorno anual esperado (%)</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <MiniPctField
                  label="Cons."
                  value={inputs.expectedReturnConservative}
                  onChange={(v) => set("expectedReturnConservative", v)}
                />
                <MiniPctField label="Base" value={inputs.expectedReturnBase} onChange={(v) => set("expectedReturnBase", v)} />
                <MiniPctField
                  label="Agr."
                  value={inputs.expectedReturnAggressive}
                  onChange={(v) => set("expectedReturnAggressive", v)}
                />
              </div>
            </div>
            <NumberField
              label="Inflação anual esperada (%)"
              value={inputs.expectedInflation * 100}
              onChange={(v) => set("expectedInflation", v / 100)}
              step={0.5}
            />
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function ScenarioBadge({ label, onTrack }: { label: string; onTrack: boolean }) {
  return (
    <Badge tone={onTrack ? "ok" : "warn"}>
      {label}: {onTrack ? "no caminho certo" : "requer ajuste"}
    </Badge>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-onbrand/40">{prefix}</span>}
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={prefix ? "pl-9" : undefined}
        />
      </div>
    </div>
  );
}

function MiniPctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs text-onbrand/40 mb-1">{label}</p>
      <Input
        type="number"
        step={0.5}
        value={Math.round(value * 1000) / 10}
        onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
        className="h-9 text-sm px-2"
      />
    </div>
  );
}
