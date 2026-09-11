"use client";

import { useActionState } from "react";
import { ShoppingBag, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { checkAffordabilityAction, type AffordabilityState } from "./actions";

const RECOMMENDATION_META = {
  YES: { label: "Pode comprar", tone: "ok" as const, icon: CheckCircle2 },
  YES_WITH_CAUTION: { label: "Pode, com atenção", tone: "gold" as const, icon: AlertTriangle },
  NO_NOT_NOW: { label: "Não agora", tone: "warn" as const, icon: AlertTriangle },
  NO: { label: "Não recomendo", tone: "danger" as const, icon: XCircle },
};

export function DecideClient() {
  const [state, formAction, pending] = useActionState<AffordabilityState, FormData>(checkAffordabilityAction, undefined);

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="font-sans font-bold text-2xl text-onbrand flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-gold-400" /> Posso comprar isso?
        </h1>
        <p className="text-sm text-onbrand/55 mt-1">
          Conte o que você está pensando em comprar. O Tobias olha sua renda, reserva, dívidas e objetivos de verdade antes de responder.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="description">O que você quer comprar?</Label>
              <Input id="description" name="description" placeholder="Ex: Uma TV nova de 55 polegadas" required />
            </div>
            <div>
              <Label htmlFor="amount">Quanto custa?</Label>
              <Input id="amount" name="amount" type="number" step="0.01" placeholder="0,00" required />
            </div>
            <FieldError>{state?.error}</FieldError>
            <Button type="submit" loading={pending} className="w-full">
              Perguntar ao Tobias
            </Button>
          </form>
        </CardContent>
      </Card>

      {state?.result && (
        <ResultCard result={state.result} description={state.description} amount={state.amount} />
      )}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  description,
  amount,
}: {
  result: NonNullable<AffordabilityState>["result"];
  description?: string;
  amount?: number;
}) {
  if (!result) return null;
  const meta = RECOMMENDATION_META[result.recommendation];
  const Icon = meta.icon;

  return (
    <Card className="mt-4">
      <CardContent className="py-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-onbrand/55">
            {description}: {amount !== undefined ? formatBRL(amount) : ""}
          </p>
          <Badge tone={meta.tone}>
            <Icon className="h-3.5 w-3.5" /> {meta.label}
          </Badge>
        </div>
        <p className="text-onbrand/85">{result.explanation}</p>
        <p className="text-sm text-gold-400 border-t border-white/10 pt-3">
          <span className="font-medium">Impacto: </span>
          {result.impactSummary}
        </p>
      </CardContent>
    </Card>
  );
}
