"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, ArrowRight, Check } from "lucide-react";
import { TOUR_STEPS } from "./tourSteps";
import { completeTourAction } from "./actions";

const MARGIN = 8; // respiro entre o alvo e o recorte do spotlight

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Guia obrigatório de primeiro acesso: pedido do Thiago pra "bloquear tudo"
 * até o cliente ver, na tela real, onde fica cada coisa (resumo do mês,
 * Ponteiro, Conta, Transações, Aposentadoria) — em vez de um tutorial numa
 * tela separada. Roda inteiro em cima do Dashboard: os 2 primeiros passos
 * apontam pra cards que só existem ali, e os 3 últimos apontam pros itens
 * do menu lateral (que também estão na tela, só que sempre visíveis).
 *
 * Monta em AppShell, só quando `tourCompleted` é false. Se o usuário cair
 * em qualquer página que não seja /dashboard antes de terminar, mandamos
 * ele pra lá — não dá pra apontar pro resumo do mês de outro lugar.
 */
export function MandatoryTourOverlay({ tourCompleted }: { tourCompleted: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pending, startTransition] = useTransition();
  const redirected = useRef(false);
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

  const active = !tourCompleted && !dismissed;
  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  // Passos 1-2 dependem de cards que só existem no Dashboard — se o guia
  // ainda não terminou e o usuário está em outra rota (voltou pelo
  // histórico do navegador, abriu um link direto etc.), força a volta.
  useEffect(() => {
    if (active && pathname !== "/dashboard" && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [active, pathname, router]);

  useEffect(() => {
    if (!active || pathname !== "/dashboard") return;

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
  }, [active, pathname, step?.target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  });

  if (!mounted || !active || pathname !== "/dashboard" || !step) return null;

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
