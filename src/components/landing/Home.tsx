"use client";

import {
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  FileUp,
  Layers3,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
  Compass,
  HeartHandshake,
  LifeBuoy,
  PiggyBank,
} from "lucide-react";
import type { ReactNode } from "react";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import BrandButton from "@/components/landing/BrandButton";
import Logo from "@/components/landing/Logo";
import GifPlaceholder from "@/components/landing/GifPlaceholder";
import { useReveal } from "@/components/landing/useReveal";
import { APP_LINKS } from "@/components/landing/site";
import { PRICING_PLANS } from "@/lib/billing/plans";

const PROBLEMS = [
  {
    icon: Clock3,
    title: "A atualização demora",
    description:
      "Em serviços que dependem de Open Finance, a atualização dos dados pode demorar e não acompanhar o ritmo das suas decisões.",
    note: "Os dados ainda não chegaram",
  },
  {
    icon: Layers3,
    title: "Lançamentos podem ficar de fora",
    description: "Quando falta uma movimentação, o retrato do mês fica incompleto e o planejamento perde contexto.",
    note: "Confira tudo pelo extrato",
  },
  {
    icon: WandSparkles,
    title: "Duplicidades confundem o orçamento",
    description: "A mesma compra pode aparecer mais de uma vez e distorcer saldos, gastos e orçamento.",
    note: "Uma compra. Dois registros?",
  },
];

const STEPS = [
  {
    number: "01",
    icon: FileUp,
    title: "Complete com seu extrato",
    description: "Exporte o extrato do banco e importe no Tobias para adicionar as movimentações ao seu planejamento.",
  },
  {
    number: "02",
    icon: Layers3,
    title: "Revise e mescle duplicidades",
    description:
      "O Tobias ajuda a identificar lançamentos repetidos para você conferir e mesclar o que corresponde à mesma transação.",
  },
  {
    number: "03",
    icon: WandSparkles,
    title: "A IA categoriza seus lançamentos automaticamente",
    description:
      "Em vez de classificar compra por compra, receba categorias sugeridas pela IA no extrato importado. Revise e ajuste quando precisar. Você continua no controle.",
  },
  {
    number: "04",
    icon: Target,
    title: "Acompanhe o plano em movimento",
    description: "Com dados mais organizados, fica mais fácil olhar orçamento, metas e projeções com uma visão atualizada.",
  },
];

// Os 4 pilares vêm de uma metodologia reconhecida de planejamento financeiro
// (organizar "pra que serve" o dinheiro, não só "onde ele está guardado").
// Deliberadamente sem citar a fonte pelo nome aqui na landing (evita parecer
// endosso/parceria que não existe — ver claude/backlog.md item 2). Copy
// mantida no nível de FILOSOFIA que guia o planejamento, não uma lista de
// features: "Legado" em particular não tem nenhuma tela própria no app hoje
// (ver claude/especificacao-patrimonio-por-pilares.md), então a frase dele
// fala de intenção, não de uma funcionalidade concreta que ainda não existe.
const PILLARS = [
  {
    icon: LifeBuoy,
    title: "Essencial",
    description: "O que garante sua base: moradia, contas, saúde. O Tobias mostra o quanto disso já está coberto por renda estável.",
  },
  {
    icon: Sparkles,
    title: "Estilo de vida",
    description: "O que você quer viver: viagem, sonho, hobby. Financiado pelo que sobra depois do essencial, com meta e prazo definidos.",
  },
  {
    icon: PiggyBank,
    title: "Imprevistos",
    description: "O que não estava no plano. Sua reserva de emergência calculada a partir do seu perfil, não um número chutado.",
  },
  {
    icon: HeartHandshake,
    title: "Legado",
    description: "O que você quer deixar para quem você ama. Parte do plano desde o início, não uma reflexão de última hora.",
  },
] as const;

const FAQs = [
  {
    question: "O Tobias conecta minhas contas por Open Finance?",
    answer:
      "Não. O Tobias não oferece conexão por Open Finance. Para adicionar suas movimentações, você importa os extratos do banco no Tobias; depois pode revisar duplicidades, categorizar lançamentos e atualizar seu planejamento.",
  },
  {
    question: "O que acontece quando importo um extrato?",
    answer:
      "O extrato serve para complementar os dados do planejamento. Depois da importação, você pode revisar lançamentos, conferir possíveis duplicidades e organizar as categorias.",
  },
  {
    question: "As categorias são definidas automaticamente?",
    answer:
      "A inteligência artificial ajuda sugerindo categorias com base nas informações dos lançamentos. A categorização deve ser revisada por você para garantir que faça sentido para sua realidade.",
  },
  {
    question: "Como funciona o acompanhamento pelo WhatsApp?",
    answer:
      "O WhatsApp é um canal para interagir com o Tobias e dar continuidade ao acompanhamento financeiro. Assim, você pode retomar objetivos e compartilhar atualizações fora de uma reunião específica.",
  },
  {
    question: "Como funcionam os planos?",
    answer:
      "Os planos incluem acesso ao Tobias e variam pela periodicidade da cobrança: mensal, semestral ou anual. O período de teste, os valores e as condições são apresentados no cadastro.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="mb-4 inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
        <span className="h-px w-5 bg-gold-500/70" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="font-display text-[2rem] font-semibold leading-[1.13] tracking-[-0.03em] text-cream-50 sm:text-[2.7rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 font-sans text-base leading-relaxed text-cream-100/70 sm:text-[1.05rem]">{description}</p>
      )}
    </div>
  );
}

function OpenFinancePain() {
  return (
    <section id="extratos" className="relative overflow-hidden bg-[#101316] py-20 sm:py-24 lg:py-28">
      <div className="lp-container relative">
        <SectionHeading
          eyebrow="O desafio dos dados financeiros"
          title={
            <>
              Quando os dados não chegam
              <br className="hidden sm:block" /> completos, o plano sente.
            </>
          }
          description="Open Finance pode apresentar atrasos, lacunas e duplicidades em serviços que usam esse tipo de conexão. O Tobias funciona de outra forma: você importa seus extratos e organiza os lançamentos no seu planejamento."
        />

        <div className="mt-12 grid gap-3 md:grid-cols-3 lg:mt-14">
          {PROBLEMS.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <article
                key={problem.title}
                className="lp-reveal lp-surface lp-surface-hover rounded-2xl p-5 sm:p-6"
                style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
              >
                <span className="flex size-11 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/[0.07] text-gold-400">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream-50">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-100/65">{problem.description}</p>
                <div className="mt-5 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-[0.66rem] text-brand-100/65">
                  <X className="size-3.5 shrink-0 text-danger-300" aria-hidden="true" />
                  {problem.note}
                </div>
              </article>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[0.73rem] leading-relaxed text-brand-100/50">
          O Tobias não se conecta às suas contas por Open Finance. Você escolhe e importa os extratos que quer
          adicionar ao planejamento.
        </p>
      </div>
    </section>
  );
}

function TobiasSolution() {
  return (
    <section id="como-funciona" className="relative overflow-hidden py-20 sm:py-24 lg:py-28">
      <div
        className="pointer-events-none absolute -right-52 top-20 size-[34rem] rounded-full opacity-15 blur-3xl"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle, rgba(240,153,47,.38), transparent 70%)" }}
      />
      <div className="lp-container relative">
        <div className="grid items-end gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <SectionHeading
            eyebrow="Como o Tobias resolve"
            align="left"
            title={
              <>
                Do extrato
                <br />
                ao plano em dia.
              </>
            }
            description="Sem conexão bancária automática: você importa os extratos que quer incluir e mantém controle sobre o que entra no planejamento."
          />
          <p className="lp-reveal max-w-lg pb-1 text-sm leading-relaxed text-brand-100/65 lg:justify-self-end">
            Importe o extrato, deixe a IA organizar as categorias e confira o que parece repetido. Você ganha tempo
            na organização e continua no controle do planejamento, sem mais uma planilha para cuidar.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isAiStep = i === 2;
              return (
                <article
                  key={step.number}
                  className={`lp-reveal group flex gap-4 rounded-2xl border p-4 transition-all duration-200 sm:p-5 ${
                    isAiStep
                      ? "border-violet-500/35 bg-[linear-gradient(115deg,rgba(169,155,232,.12),rgba(169,155,232,0)_72%)] shadow-[0_12px_40px_-28px_rgba(169,155,232,.65)] hover:border-violet-400/55"
                      : "border-transparent bg-onbrand/[0.03] hover:border-gold-500/25 hover:bg-onbrand/[0.05]"
                  }`}
                  style={{ ["--reveal-delay" as string]: `${i * 75}ms` }}
                >
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span
                      className={`flex size-10 items-center justify-center rounded-xl border ${
                        isAiStep
                          ? "border-violet-500/35 bg-violet-500/[0.13] text-violet-400"
                          : "border-gold-500/20 bg-gold-500/[0.07] text-gold-400"
                      }`}
                    >
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    {i < STEPS.length - 1 && (
                      <span
                        className="h-full min-h-5 w-px bg-gradient-to-b from-gold-500/30 to-transparent"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="pb-1">
                    <p
                      className={`flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.15em] ${
                        isAiStep ? "text-violet-400" : "text-gold-400/80"
                      }`}
                    >
                      {isAiStep && <Sparkles className="size-3" aria-hidden="true" />}
                      Etapa {step.number}
                      {isAiStep && (
                        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[0.52rem] tracking-[0.1em]">
                          IA
                        </span>
                      )}
                    </p>
                    <h3 className="mt-1 font-display text-[0.96rem] font-semibold text-cream-50">{step.title}</h3>
                    <p className="mt-1.5 text-[0.78rem] leading-relaxed text-cream-100/60">{step.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <GifPlaceholder
            slot="extrato-importacao-e-categorias"
            title="Importar, revisar e categorizar"
            description="Gravar a importação de um extrato, a revisão de um lançamento duplicado e a categorização de uma movimentação."
            className="lp-reveal"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Seção "Metodologia" — pedido do Thiago em 28/09/2026: adicionar os pilares
 * mantendo o posicionamento "sem Open Finance / IA categoriza" em destaque
 * (por isso entra DEPOIS de TobiasSolution, não antes). Enviei 3 opções de
 * layout num canvas à parte (claude/backlog.md item 2); o Thiago escolheu a
 * Opção B — trilha horizontal numerada. No mobile a trilha vira uma lista
 * vertical (mesmo padrão de conector já usado nos passos de TobiasSolution),
 * porque uma trilha horizontal não cabe numa tela estreita.
 */
function Pillars() {
  return (
    <section id="pilares" className="relative overflow-hidden bg-brand-900/35 py-20 sm:py-24 lg:py-28">
      <div className="lp-container relative">
        <SectionHeading
          eyebrow="A filosofia por trás do plano"
          align="left"
          title="Do essencial ao legado, cada real no seu lugar."
          description="Uma trilha, não uma lista: o Tobias mostra como cada camada do seu plano se apoia na anterior."
        />

        <div className="relative mt-12 lg:mt-16">
          <div
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-gradient-to-r from-gold-500/50 via-gold-500/25 to-gold-500/50 lg:block"
            aria-hidden="true"
          />
          <div className="grid gap-8 lg:grid-cols-4 lg:gap-6">
            {PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="lp-reveal flex gap-4 lg:flex-col lg:items-center lg:gap-3 lg:text-center"
                  style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
                >
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-gold-500 bg-brand-950 text-gold-400">
                      <Icon className="size-[22px]" aria-hidden="true" />
                    </span>
                    {i < PILLARS.length - 1 && (
                      <span
                        className="h-full min-h-6 w-px bg-gradient-to-b from-gold-500/45 to-gold-500/10 lg:hidden"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.12em] text-gold-400">
                      0{i + 1}
                    </p>
                    <h3 className="mt-1 font-display text-[0.95rem] font-semibold text-cream-50">{pillar.title}</h3>
                    <p className="mt-1.5 text-[0.8rem] leading-relaxed text-cream-100/60 lg:max-w-[15rem]">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-[0.73rem] leading-relaxed text-brand-100/50">
          A ordem sugere prioridade — primeiro a base, depois o resto — mas é a mesma lente sobre os dados que você
          já tem no Tobias, não uma etapa extra de cadastro.
        </p>
      </div>
    </section>
  );
}

function FollowAlong() {
  return (
    <section id="whatsapp" className="relative overflow-hidden bg-brand-900/35 py-20 sm:py-24 lg:py-28">
      <div className="lp-container relative grid items-center gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
        <div className="lp-reveal max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ok-400">
            <span className="h-px w-5 bg-ok-400/70" aria-hidden="true" />
            Acompanhamento pelo WhatsApp
          </p>
          <h2 className="font-display text-[2rem] font-semibold leading-[1.13] tracking-[-0.03em] text-cream-50 sm:text-[2.7rem]">
            Seu planejamento continua entre uma conversa e outra.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-cream-100/70">
            Tire dúvidas, atualize objetivos e retome seus combinados pelo WhatsApp. Acompanhar as finanças pode
            fazer parte da rotina, sem depender de lembrar de tudo só na próxima reunião.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-cream-100/75">
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-ok-400" aria-hidden="true" />
              Uma conversa simples para atualizar seu contexto
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-ok-400" aria-hidden="true" />
              Objetivos e próximos passos sempre em pauta
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-ok-400" aria-hidden="true" />
              Um planejador para ajudar você a manter o rumo
            </li>
          </ul>
        </div>
        <GifPlaceholder
          slot="acompanhamento-whatsapp"
          title="Conversa de acompanhamento pelo WhatsApp"
          description="Gravar uma conversa real mostrando como atualizar uma meta ou retomar um combinado com o Tobias."
          ratio="square"
          className="lp-reveal"
        />
      </div>
    </section>
  );
}

function PlanningFeatures() {
  return (
    <section id="recursos" className="py-20 sm:py-24 lg:py-28">
      <div className="lp-container">
        <SectionHeading
          eyebrow="Planejamento que acompanha você"
          title={
            <>
              Uma visão completa para
              <br className="hidden sm:block" /> decisões do dia a dia.
            </>
          }
          description="Com os lançamentos organizados, seus dados se transformam em contexto para cuidar do presente e planejar o futuro."
        />
        <div className="mt-12 grid gap-4 lg:mt-14 lg:grid-cols-2">
          <article className="lp-reveal lp-surface rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/[0.08] text-gold-400">
                <Target className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold text-cream-50">Metas que ganham acompanhamento</h3>
                <p className="mt-0.5 text-[0.68rem] text-brand-100/55">Progresso atualizado conforme seus registros</p>
              </div>
            </div>
            <GifPlaceholder
              slot="metas-planejamento"
              title="Acompanhar metas"
              description="Gravar a tela de metas e a atualização do progresso após registrar novas movimentações."
              className="mt-5"
            />
          </article>
          <article className="lp-reveal lp-surface rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-ok-400/20 bg-ok-400/[0.08] text-ok-400">
                <Compass className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold text-cream-50">Projeções para olhar mais longe</h3>
                <p className="mt-0.5 text-[0.68rem] text-brand-100/55">Compare cenários de aposentadoria</p>
              </div>
            </div>
            <GifPlaceholder
              slot="projecoes-planejamento"
              title="Explorar projeções"
              description="Gravar a tela de projeções e a interação para comparar cenários do planejamento."
              className="mt-5"
            />
          </article>
        </div>
        <p className="mt-3 text-right text-[0.65rem] text-brand-100/40">
          Exemplos ilustrativos; projeções dependem dos dados e premissas utilizados.
        </p>
      </div>
    </section>
  );
}

function Testimonials() {
  const prompts = [
    "Quanto tempo você levava para organizar as categorias antes?",
    "O que mudou na sua rotina com as categorias sugeridas automaticamente?",
  ];

  return (
    <section id="depoimentos" className="relative overflow-hidden bg-[#101316] py-16 sm:py-20">
      <div className="lp-container relative">
        <div className="grid items-end gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
          <div className="lp-reveal">
            <SectionHeading
              eyebrow="Depoimentos"
              align="left"
              title={
                <>
                  Menos tempo categorizando.
                  <br />
                  Mais tempo para o seu plano.
                </>
              }
              description="A categorização automática ajuda a tirar o trabalho repetitivo do caminho e deixa para você a revisão final."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.map((prompt, i) => (
              <figure
                key={prompt}
                className="lp-reveal flex min-h-44 flex-col justify-between rounded-2xl border border-dashed border-violet-500/30 bg-[linear-gradient(145deg,rgba(169,155,232,.09),rgba(169,155,232,0)_70%)] p-5 sm:p-6"
                style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
              >
                <div>
                  <Quote className="size-5 text-violet-400" aria-hidden="true" />
                  <blockquote className="mt-4 font-display text-sm font-medium leading-relaxed text-cream-50">
                    {prompt}
                  </blockquote>
                </div>
                <figcaption className="mt-5 flex items-center gap-2 pt-3 text-[0.62rem] text-brand-100/55">
                  <span className="size-1.5 rounded-full bg-violet-400" aria-hidden="true" />
                  Depoimento real a inserir, com autorização
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="planos" className="relative overflow-hidden bg-[#101316] py-20 sm:py-24 lg:py-28">
      <div className="lp-container relative">
        <SectionHeading
          eyebrow="Planos"
          title={
            <>
              Acompanhamento para
              <br className="hidden sm:block" /> manter seu plano em movimento.
            </>
          }
          description="Experimente por 15 dias e depois escolha como prefere pagar."
        />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 lg:grid-cols-3 lg:gap-5">
          {PRICING_PLANS.map((plan, i) => (
            <article
              key={plan.cycle}
              className={`lp-reveal relative flex flex-col rounded-2xl p-6 sm:p-7 ${
                plan.highlight
                  ? "border border-gold-500/50 bg-[linear-gradient(145deg,rgba(240,153,47,0.12),rgba(35,41,47,0.95)_46%)] shadow-[0_20px_70px_-35px_rgba(240,153,47,0.28)] lg:-my-3 lg:py-10"
                  : "lp-surface"
              }`}
              style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold-500/40 bg-brand-950 px-3 py-1 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-gold-400">
                  Melhor valor mensal
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold text-cream-50">{plan.label}</p>
                  <p className="mt-1 text-[0.75rem] text-brand-100/60">
                    {plan.months === 1 ? "Flexibilidade mensal" : plan.months === 6 ? "Um semestre inteiro" : "Praticidade anual"}
                  </p>
                </div>
                <Sparkles className={`mt-1 size-4 ${plan.highlight ? "text-gold-400" : "text-brand-100/35"}`} aria-hidden="true" />
              </div>
              <div className="mt-7">
                <p className="font-display text-[2.2rem] font-semibold leading-none tracking-tight text-cream-50">
                  {plan.priceLabel}
                </p>
                <p className="mt-2 text-sm text-gold-400">{plan.monthlyEquivalentLabel}</p>
                <p className="mt-3 min-h-10 text-[0.77rem] leading-relaxed text-brand-100/65">{plan.billingNote}</p>
              </div>
              <ul className="mt-5 space-y-3 pt-5">
                {["Acesso completo ao Tobias", "15 dias grátis para testar", "Cancele quando quiser"].map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[0.8rem] text-cream-100/80">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok-400" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
              <BrandButton
                href={APP_LINKS.signupWithPlan(plan.cycle)}
                variant={plan.highlight ? "gold" : "outline"}
                size="md"
                className="mt-7 w-full"
                aria-label={`Começar período grátis com o plano ${plan.label}`}
              >
                Começar grátis
                <ArrowRight className="size-4" aria-hidden="true" />
              </BrandButton>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[0.7rem] leading-relaxed text-brand-100/50">
          O teste, os valores e as condições de cobrança são confirmados durante o cadastro.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="perguntas" className="py-20 sm:py-24 lg:py-28">
      <div className="lp-container">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div className="lp-reveal">
            <SectionHeading
              eyebrow="Dúvidas"
              align="left"
              title={
                <>
                  Tudo claro
                  <br />
                  antes de começar.
                </>
              }
              description="O que vale saber sobre dados, extratos e acompanhamento."
            />
            <div className="mt-7 inline-flex items-center gap-2 text-sm text-brand-100/70">
              <CircleHelp className="size-4 text-gold-400" aria-hidden="true" />
              <span>Consulte o suporte dentro da sua conta.</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {FAQs.map((faq, i) => (
              <details
                key={faq.question}
                className="lp-reveal group rounded-xl border border-transparent bg-onbrand/[0.03] px-5 transition-colors duration-200 open:border-gold-500/25 open:bg-onbrand/[0.045]"
                style={{ ["--reveal-delay" as string]: `${i * 55}ms` }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[0.9rem] font-medium text-cream-50 marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-onbrand/[0.06] text-brand-100/60 transition-transform duration-200 group-open:rotate-45 group-open:bg-gold-500/15 group-open:text-gold-400">
                    <span className="text-lg leading-none">+</span>
                  </span>
                </summary>
                <p className="max-w-2xl pb-5 pr-8 text-[0.85rem] leading-relaxed text-cream-100/65">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-y border-gold-500/15 bg-brand-900/55 py-16 sm:py-20">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle, rgba(240,153,47,.30), transparent 70%)" }}
      />
      <div className="lp-container relative text-center">
        <p className="lp-reveal mb-4 inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/[0.07] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-gold-400">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Comece pelo seu extrato
        </p>
        <h2
          className="lp-reveal mx-auto max-w-3xl font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] text-cream-50 sm:text-[2.85rem]"
          style={{ ["--reveal-delay" as string]: "80ms" }}
        >
          Crie sua conta. Suba seu primeiro extrato.
          <span className="block lp-text-gold-gradient">Comece a planejar com clareza.</span>
        </h2>
        <p
          className="lp-reveal mx-auto mt-4 max-w-xl text-base leading-relaxed text-cream-100/70"
          style={{ ["--reveal-delay" as string]: "150ms" }}
        >
          Importe o extrato do seu banco, organize os lançamentos e dê o primeiro passo para acompanhar seus
          objetivos com o Tobias.
        </p>
        <div className="lp-reveal mt-8" style={{ ["--reveal-delay" as string]: "220ms" }}>
          <BrandButton href={APP_LINKS.signup} size="lg">
            Criar conta e subir meu extrato
            <ArrowRight className="size-4" aria-hidden="true" />
          </BrandButton>
        </div>
        <p className="lp-reveal mt-4 text-[0.67rem] text-brand-100/45" style={{ ["--reveal-delay" as string]: "280ms" }}>
          Você escolhe quando importar o arquivo depois de criar sua conta.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-950 py-8 sm:py-10">
      <div className="lp-container">
        <div className="flex flex-col items-center justify-between gap-5 pb-7 sm:flex-row">
          <a href="#top" aria-label="Voltar ao início">
            <Logo size={30} />
          </a>
          <nav aria-label="Navegação do rodapé" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.78rem] text-brand-100/65">
            <a href="#extratos" className="transition-colors hover:text-cream-50">
              Extratos
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-cream-50">
              Como funciona
            </a>
            <a href="#pilares" className="transition-colors hover:text-cream-50">
              Metodologia
            </a>
            <a href="#whatsapp" className="transition-colors hover:text-cream-50">
              WhatsApp
            </a>
            <a href="#planos" className="transition-colors hover:text-cream-50">
              Planos
            </a>
            <a href={APP_LINKS.login} className="transition-colors hover:text-cream-50">
              Entrar
            </a>
          </nav>
          <BrandButton href={APP_LINKS.signup} size="sm">
            Começar grátis
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </BrandButton>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 pt-5 text-center text-[0.68rem] text-brand-100/45 sm:flex-row">
          <p>© {new Date().getFullYear()} Tobias. Planejamento financeiro pessoal.</p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            O extrato continua sob seu controle.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingHome() {
  const revealRef = useReveal<HTMLElement>();
  return (
    <div className="min-h-screen overflow-x-clip bg-brand-950 text-cream-50">
      <Header />
      <main id="conteudo" ref={revealRef}>
        <Hero />
        <OpenFinancePain />
        <TobiasSolution />
        <Pillars />
        <FollowAlong />
        <PlanningFeatures />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
