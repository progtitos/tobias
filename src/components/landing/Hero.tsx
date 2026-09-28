"use client";

import { ArrowDownRight, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import BrandButton from "@/components/landing/BrandButton";
import StatementFlowDemo from "@/components/landing/StatementFlowDemo";
import { APP_LINKS } from "@/components/landing/site";
import { useReveal } from "@/components/landing/useReveal";

export default function Hero() {
  const revealRef = useReveal<HTMLElement>();

  return (
    <section
      id="top"
      ref={revealRef}
      className="lp-grain relative overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-36"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 lp-grid-lines opacity-45 [mask-image:radial-gradient(75%_60%_at_50%_0%,#000_8%,transparent_75%)]" />
        <div
          className="absolute right-[-12rem] top-[-8rem] h-[42rem] w-[42rem] rounded-full opacity-35 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(240,153,47,0.34) 0%, rgba(240,153,47,0.08) 45%, transparent 70%)",
          }}
        />
        <div
          className="absolute left-[-10rem] top-[20rem] h-[24rem] w-[24rem] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(94,203,184,0.4) 0%, transparent 68%)" }}
        />
      </div>

      <div className="lp-container">
        <div className="grid min-w-0 grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="min-w-0 max-w-xl">
            <p className="lp-reveal inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/[0.08] px-3.5 py-1.5 font-sans text-[0.72rem] font-medium tracking-wide text-gold-400">
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" /> Sem Open Finance · importe seus extratos
            </p>
            <h1
              className="lp-reveal mt-6 font-display text-[2.35rem] font-semibold leading-[1.06] tracking-[-0.035em] text-cream-50 sm:text-[3.45rem] lg:text-[3.05rem] xl:text-[3.25rem]"
              style={{ ["--reveal-delay" as string]: "80ms" }}
            >
              Extrato em ordem.
              <br />
              <span className="lp-text-gold-gradient">Planeje com Tobias.</span>
            </h1>
            <p
              className="lp-reveal mt-6 max-w-lg font-sans text-[1.02rem] leading-relaxed text-cream-100/75"
              style={{ ["--reveal-delay" as string]: "160ms" }}
            >
              Importe o extrato do seu banco. A IA categoriza os lançamentos automaticamente. Você revisa as
              sugestões, confere duplicidades e acompanha seu planejamento com o Tobias, também pelo WhatsApp.
            </p>
            <div
              className="lp-reveal mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ ["--reveal-delay" as string]: "240ms" }}
            >
              <BrandButton href={APP_LINKS.signup} size="lg" className="w-full sm:w-auto">
                Teste grátis
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </BrandButton>
              <BrandButton href="#como-funciona" variant="outline" size="lg">
                <ArrowDownRight className="size-4" />
                Como funciona
              </BrandButton>
            </div>
            <ul
              className="lp-reveal mt-7 flex flex-wrap gap-x-5 gap-y-2 font-sans text-[0.76rem] text-brand-100/70"
              style={{ ["--reveal-delay" as string]: "320ms" }}
            >
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-ok-400" aria-hidden="true" />
                Importe seu extrato
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-violet-400" aria-hidden="true" />
                IA categoriza lançamentos
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-ok-400" aria-hidden="true" />
                Revise duplicidades
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-ok-400" aria-hidden="true" />
                Acompanhe no WhatsApp
              </li>
            </ul>
          </div>

          <div className="relative min-w-0 max-w-full lp-reveal" style={{ ["--reveal-delay" as string]: "120ms" }}>
            <StatementFlowDemo />
            <p className="mt-5 flex items-start justify-center gap-1.5 text-center text-[0.64rem] leading-relaxed text-brand-100/45">
              <ShieldCheck className="mt-px size-3 shrink-0" aria-hidden="true" />
              Demonstração ilustrativa da proposta. As telas são conceituais, não capturas do aplicativo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
