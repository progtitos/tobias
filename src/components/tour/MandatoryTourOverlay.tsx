"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, ArrowRight, Check } from "lucide-react";
import { TOUR_STEPS } from "./tourSteps";
import { completeTourAction } from "./actions";
import { isMandatoryTourSuppressed } from "@/lib/onboarding/reveal";

const MARGIN = 8; // respiro entre o alvo e o recorte do spotlight

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Guia obrigatório de primeiro acesso: pedido do Thiago pra "bloquear tudo"
 * até o cliente ver, na tela real, onde fica cada coisa, em vez de um
 * tutorial numa tela separada. Reescrito em 2026-09-24 ("o guia tour tem que
 * passar por cada detalhe do sistema explicando como funciona"): antes o
 * tour inteiro rodava em cima do Dashboard e só apontava pro menu lateral
 * pras outras telas, sem nunca abrir nenhuma delas. Agora cada passo
 * (tourSteps.ts) carrega sua própria `route`, e o overlay navega de verdade
 * pra lá antes de medir o alvo: o tour percorre Dashboard, chat, Transações,
 * Conta, Renda e Despesas, Patrimônio, Investimentos, Aposentadoria e o
 * Ponteiro completo, na ordem real de uso do produto.
 *
 * Monta em AppShell, só quando `tourCompleted` é false. Se o usuário cair
 * numa página diferente da que o passo atual espera (voltou pelo histórico
 * do navegador, abriu um link direto etc.), mandamos ele de volta pra rota
 * certa: isso roda de novo a cada passo, não só uma vez, porque avançar o
 * tour agora legitimamente muda a rota esperada.
 *
 * Uma exceção a esse "bloquear tudo": enquanto a revelação final do
 * onboarding (ProfileRevealOverlay) ainda está em andamento, `active` fica
 * suprimido (ver `isMandatoryTourSuppressed`) — sem isso, `onboardingCompleted`
 * já vira `true` antes da pessoa terminar de ver a revelação, e o tour
 * sequestrava a tela sem nenhum respiro, inclusive numa aba nova aberta pelo
 * link "Prefiro subir um extrato agora" dentro do próprio onboarding.
 */
export function MandatoryTourOverlay({ tourCompleted }: { tourCompleted: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pending, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(220);
  // O posicionamento inteiro depende de medir o DOM real (getBoundingClientRect,
  // window.innerWidth/Height) — coisa que só existe no cliente. Em vez de
  // arriscar o servidor "chutar" um valor e o React reclamar de hidratação
  // (o HTML mudando assim que monta), só desenhamos o overlay depois que o
  // componente já montou no navegador: servidor e primeira pintura do
  // cliente concordam em não renderizar nada.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Enquanto a revelação final do onboarding ainda está em andamento (em
  // QUALQUER aba desta pessoa — inclusive uma aberta pelo link "Prefiro
  // subir um extrato agora"), o tour não deve sequestrar a tela. Reavaliado
  // a cada poucos segundos, não só no mount, porque essa janela pode
  // terminar (ou ser limpa por outra aba) enquanto esta continua aberta —
  // ver src/lib/onboarding/reveal.ts (Thiago, 25/09/2026, itens 1 e 2).
  const [, forceRecheck] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceRecheck((n) => n + 1), 2000);
    return () => window.clearInterval(id);
  }, []);
  const suppressed = mounted && isMandatoryTourSuppressed();

  const active = !tourCompleted && !dismissed && !suppressed;
  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const route = step?.route ?? "/dashboard";

  // Cada passo espera estar numa rota específica. Sempre que o passo muda
  // (ou o usuário sai dela por conta própria) e o guia ainda está ativo,
  // navega pra rota certa. Sem guarda de "só uma vez": diferente da versão
  // anterior, mudar de passo aqui legitimamente muda a rota esperada.
  useEffect(() => {
    if (active && pathname !== route) {
      router.replace(route);
    }
  }, [active, pathname, route, router]);

  useEffect(() => {
    if (!active || pathname !== route) return;

    function measure() {
      const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`);
      let el: HTMLElement | null = null;
      candidates.forEach((c) => {
        if (!el && c.offsetParent !== null) el = c;
      });
      if (el) {
        const box = (el as HTMLElement).getBoundingClientRect();
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        setRect(null);
      }
    }

    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [active, pathname, route, step?.target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  });

  if (!mounted || !active || pathname !== route || !step) return null;

  function finish(skipped: boolean) {
    setDismissed(true);
    startTransition(async () => {
      await completeTourAction(skipped);
      router.refresh();
    });
  }

  function next() {
    if (isLastStep) finish(false);
    else setStepIndex((i) => i + 1);
  }

  // Cartão do passo: fica perto do alvo, mas nunca fixo nele — pra caber em
  // telas pequenas, calcula um ponto e clampa dentro do viewport. Alvo colado
  // na borda de baixo (o menu inferior no mobile) é tratado à parte: não tem
  // espaço nem à direita nem abaixo, então o cartão sobe pra cima do alvo.
  const cardWidth = 320;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 900;
  let cardTop: number;
  let cardLeft: number;
  if (rect) {
    const glueToBottomEdge = rect.top > viewportH - 140;
    const wantsRight = step.placement === "right" && viewportW >= 640 && !glueToBottomEdge;
    if (wantsRight) {
      cardTop = rect.top;
      cardLeft = rect.left + rect.width + 20;
    } else if (glueToBottomEdge) {
      cardTop = rect.top - cardHeight - 16;
      cardLeft = rect.left + rect.width / 2 - cardWidth / 2;
    } else {
      cardTop = rect.top + rect.height + 16;
      cardLeft = rect.left;
    }
  } else {
    cardTop = viewportH / 2 - 100;
    cardLeft = viewportW / 2 - cardWidth / 2;
  }
  cardLeft = Math.min(Math.max(cardLeft, 16), viewportW - cardWidth - 16);
  cardTop = Math.min(Math.max(cardTop, 16), viewportH - cardHeight - 16);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guia de primeiro acesso">
      {/* Backdrop em 4 tiras ao redor do alvo (spotlight) — quando não há
          alvo visível (ex: viewport minúsculo), cobre a tela inteira. */}
      {rect ? (
        <>
          <div
            className="fixed bg-brand-950/80"
            style={{ top: 0, left: 0, right: 0, height: Math.max(rect.top - MARGIN, 0) }}
          />
          <div
            className="fixed bg-brand-950/80"
            style={{ top: rect.top + rect.height + MARGIN, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="fixed bg-brand-950/80"
            style={{
              top: Math.max(rect.top - MARGIN, 0),
              left: 0,
              width: Math.max(rect.left - MARGIN, 0),
              height: rect.height + MARGIN * 2,
            }}
          />
          <div
            className="fixed bg-brand-950/80"
            style={{
              top: Math.max(rect.top - MARGIN, 0),
              left: rect.left + rect.width + MARGIN,
              right: 0,
              height: rect.height + MARGIN * 2,
            }}
          />
          <div
            className="fixed rounded-xl ring-2 ring-gold-400 pointer-events-none"
            style={{
              top: rect.top - MARGIN,
              left: rect.left - MARGIN,
              width: rect.width + MARGIN * 2,
              height: rect.height + MARGIN * 2,
              boxShadow: "0 0 0 4px rgba(240,153,47,0.25), 0 0 32px 4px rgba(240,153,47,0.35)",
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-brand-950/80" />
      )}

      <div
        ref={cardRef}
        className="fixed w-[320px] rounded-2xl bg-brand-800 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] p-5"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gold-400">
            Passo {stepIndex + 1} de {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-onbrand/40 hover:text-onbrand/70"
            aria-label="Pular guia"
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="font-sans font-semibold text-onbrand text-base mb-1.5">{step.title}</h2>
        <p className="text-sm leading-relaxed text-onbrand/70 mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? "w-4 bg-gold-400" : "w-1.5 bg-onbrand/20"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500 text-ink-900 font-medium text-sm px-4 py-2 hover:bg-gold-600 disabled:opacity-60"
          >
            {isLastStep ? (
              <>
                Concluir <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Próximo <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
