import { LifeBuoy, Receipt, CreditCard, Shield, TrendingUp, Sunrise, Landmark, Target, Compass, type LucideIcon } from "lucide-react";
import type { CompassDimensionResult } from "@/services/compass";
import { cn } from "@/lib/utils/cn";

// Ícone da própria lucide-react por dimensão (regra do design system —
// "biblioteca de ícones, exclusivamente", mesma que BehavioralProfileIcon já
// segue). O `dimension` aqui é a chave real de services/compass.ts — não
// inventa nem reordena as 9 dimensões que o Ponteiro de fato calcula.
const DIMENSION_ICON: Record<CompassDimensionResult["dimension"], LucideIcon> = {
  EMERGENCY_RESERVE: LifeBuoy,
  SPENDING_CONTROL: Receipt,
  DEBT: CreditCard,
  PROTECTION: Shield,
  INVESTMENTS: TrendingUp,
  RETIREMENT: Sunrise,
  NET_WORTH: Landmark,
  GOALS: Target,
  BEHAVIOR: Compass,
};

/**
 * Lista das 9 dimensões do Ponteiro com "linha pontilhada" (nome — rótulo —
 * pontuação), ao lado do mostrador circular no Dashboard. Substitui os 3
 * chips (melhor + 2 piores) que existiam antes: mostra as 9 de uma vez, sem
 * precisar ir pra /compass pra ver o resto.
 */
export function CompassDimensionList({
  dimensions,
  className,
}: {
  dimensions: CompassDimensionResult[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {dimensions.map((d) => {
        const Icon = DIMENSION_ICON[d.dimension];
        return (
          <div key={d.dimension} className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-onbrand/50" strokeWidth={1.75} />
            <span className="text-[0.7rem] text-onbrand/70 truncate min-w-0">{d.label}</span>
            <span className="flex-1 min-w-[8px] border-b border-dotted border-onbrand/25 mb-[3px]" />
            <span className="text-[0.72rem] font-semibold tabular-nums shrink-0 w-[2.6em] text-right text-onbrand">
              {d.score}/100
            </span>
          </div>
        );
      })}
    </div>
  );
}
