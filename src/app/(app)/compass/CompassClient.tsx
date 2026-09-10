"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { recalculateCompassAction } from "./actions";

type Dimension = {
  dimension: string;
  label: string;
  score: number;
  status: "Excelente" | "Saudável" | "Em construção" | "Atenção";
  diagnosis: string;
  nextAction: string;
};

const STATUS_TONE: Record<Dimension["status"], "ok" | "gold" | "warn"> = {
  Excelente: "ok",
  Saudável: "ok",
  "Em construção": "gold",
  Atenção: "warn",
};

function scoreColor(score: number) {
  if (score >= 85) return "text-ok-400";
  if (score >= 65) return "text-cream-50";
  if (score >= 40) return "text-gold-400";
  return "text-danger-300";
}

export function CompassClient({ dimensions, overallScore }: { dimensions: Dimension[]; overallScore: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-sans font-bold text-2xl text-cream-50">Sua Bússola Financeira</h1>
          <p className="text-sm text-cream-50/55 mt-1">
            Um raio-x da sua vida financeira em 9 dimensões, calculado a partir dos seus dados reais.
          </p>
        </div>
        <Button variant="outline" size="sm" loading={pending} onClick={() => startTransition(() => recalculateCompassAction())}>
          <RefreshCw className="h-3.5 w-3.5" /> Recalcular
        </Button>
      </div>

      <div className="flex items-baseline gap-2 my-6">
        <span className={`font-sans font-extrabold text-5xl tabular-nums ${scoreColor(overallScore)}`}>{overallScore}</span>
        <span className="text-cream-50/55 text-sm">/ 100 (pontuação geral)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dimensions.map((d) => (
          <Card key={d.dimension}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-medium text-cream-50">{d.label}</h2>
                <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`font-sans font-bold text-2xl tabular-nums ${scoreColor(d.score)}`}>{d.score}</span>
                <ProgressBar value={d.score} className="flex-1" />
              </div>
              <p className="text-sm text-cream-50/70">{d.diagnosis}</p>
              <p className="text-sm text-gold-400 mt-2">
                <span className="font-medium">Próximo passo: </span>
                {d.nextAction}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </div>
  );
}
