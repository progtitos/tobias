"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { BehavioralProfileIcon } from "@/components/profile/BehavioralProfileIcon";
import { RetirementChart } from "@/components/charts/RetirementChart";
import { Button } from "@/components/ui/Button";
import { ConnectAccountsStep } from "@/components/onboarding/ConnectAccountsStep";
import type { BehavioralProfile } from "@/services/behavioralProfile";
import type { RetirementSimulation } from "@/services/retirement";

export type RevealData = {
  behavioralProfile: { type: BehavioralProfile; label: string; description: string };
  retirementPreview: RetirementSimulation | null;
  retirementTargetAge: number | null;
};

const CONFETTI_TONES = ["bg-gold-400", "bg-ok-400", "bg-onbrand/70", "bg-gold-300"];

/**
 * Um punhado de "confetes" com posições pseudo-aleatórias, mas determinísticas
 * (mesmo `seed` = mesmo layout) — evita qualquer flash de reposicionamento
 * entre renders e não depende de `Math.random()` a cada render.
 */
function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(() => {
    // Arredondado a 1 casa decimal: sem isso, `Math.cos`/`Math.sin` podem
    // devolver o último dígito de ponto flutuante ligeiramente diferente
    // entre a renderização no servidor e a hidratação no cliente (motores JS
    // diferentes), o que o React acusa como hydration mismatch.
    const round = (n: number) => Math.round(n * 10) / 10;
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + seed;
      const distance = 70 + ((i * 37 + seed * 13) % 50);
      return {
        id: i,
        dx: round(Math.cos(angle) * distance),
        dy: round(Math.sin(angle) * distance),
        rot: (i * 47) % 360,
        delay: (i % 6) * 0.04,
        tone: CONFETTI_TONES[i % CONFETTI_TONES.length],
      };
    });
  }, [seed]);

  return (
    <div className="reveal-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`reveal-confetti-piece ${p.tone}`}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * A celebração de fim de onboarding: primeiro o Perfil Comportamental
 * ("Perfil Desbloqueado"), depois — no mesmo esquema, mesmo tom — a curva de
 * aposentadoria, exatamente como pedido: "terminando as perguntas [...]
 * 'revele' o perfil comportamento tipo uma premiação animada [...] em
 * seguida a Curva da aposentadoria no mesmo esquema". Ver nota no
 * globals.css sobre a exceção pontual ao Princípio 3 do design system.
 */
export function ProfileRevealOverlay({ reveal, onDone }: { reveal: RevealData; onDone: () => void }) {
  const hasRetirement = Boolean(reveal.retirementPreview);
  const [step, setStep] = useState<"profile" | "connect" | "retirement">("profile");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/97 backdrop-blur-sm px-5 py-8 overflow-y-auto">
      <div className="w-full max-w-md">
        {step === "profile" ? (
          <div className="flex flex-col items-center text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400 mb-5 reveal-pop">
              Perfil desbloqueado
            </p>
            <div className="relative mb-5">
              <Confetti seed={1} />
              <div className="reveal-glow-ring reveal-pop rounded-full" style={{ animationDelay: "0.1s" }}>
                <BehavioralProfileIcon profile={reveal.behavioralProfile.type} size="lg" />
              </div>
            </div>
            <h2
              className="font-display font-bold text-2xl text-onbrand mb-2 reveal-pop"
              style={{ animationDelay: "0.2s" }}
            >
              {reveal.behavioralProfile.label}
            </h2>
            <p
              className="text-sm text-onbrand/70 leading-relaxed mb-8 reveal-pop"
              style={{ animationDelay: "0.3s" }}
            >
              {reveal.behavioralProfile.description}
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="reveal-pop"
              style={{ animationDelay: "0.4s" }}
              onClick={() => setStep("connect")}
            >
              Continuar
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        ) : step === "connect" ? (
          <ConnectAccountsStep onDone={() => (hasRetirement ? setStep("retirement") : onDone())} />
        ) : (
          <div className="flex flex-col items-center text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400 mb-5 reveal-pop">
              Curva desbloqueada
            </p>
            <div
              className="reveal-glow-ring reveal-pop rounded-full h-16 w-16 flex items-center justify-center bg-gold-500/10 border border-gold-400/30 mb-4"
              style={{ animationDelay: "0.1s" }}
            >
              <Sparkles className="h-7 w-7 text-gold-400" strokeWidth={1.75} />
            </div>
            <h2 className="font-display font-bold text-2xl text-onbrand mb-1 reveal-pop" style={{ animationDelay: "0.15s" }}>
              Sua curva de aposentadoria
            </h2>
            <p className="text-sm text-onbrand/70 mb-6 reveal-pop" style={{ animationDelay: "0.2s" }}>
              Já calculei sua projeção com os dados que você me contou.
            </p>
            {reveal.retirementPreview && (
              <div className="w-full bg-brand-800 rounded-2xl p-4 mb-6 reveal-pop" style={{ animationDelay: "0.3s" }}>
                <RetirementChart
                  simulation={reveal.retirementPreview}
                  targetAge={reveal.retirementTargetAge ?? reveal.retirementPreview.base.series.at(-1)?.age ?? 65}
                  height={190}
                  dark
                />
                <div className="flex justify-center mt-2.5">
                  <span
                    className={
                      reveal.retirementPreview.base.onTrack
                        ? "text-xs font-medium text-ok-400"
                        : "text-xs font-medium text-gold-400"
                    }
                  >
                    {reveal.retirementPreview.base.onTrack
                      ? "No alvo para a idade que você quer se aposentar"
                      : "Um plano inicial, vamos ajustar juntos ao longo do caminho"}
                  </span>
                </div>
              </div>
            )}
            <Button
              variant="secondary"
              size="lg"
              className="reveal-pop"
              style={{ animationDelay: "0.4s" }}
              onClick={onDone}
            >
              Ir para o Dashboard
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
