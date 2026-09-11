import Image from "next/image";
import Link from "next/link";
import { Compass, TrendingUp, Target, MessageCircle, Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PRICING_PLANS } from "@/lib/billing/plans";

const FEATURES = [
  {
    icon: Compass,
    title: "Ponteiro financeiro",
    description: "Uma pontuação em 9 dimensões da sua vida financeira, calculada a partir dos seus dados reais.",
  },
  {
    icon: TrendingUp,
    title: "Curva de aposentadoria",
    description: "Cenários conservador, base e agressivo mostram se você está no caminho e o que ajustar se não estiver.",
  },
  {
    icon: Target,
    title: "Metas que se atualizam sozinhas",
    description: "Cada aporte que você registra já reflete no progresso do seu objetivo, sem precisar atualizar nada à mão.",
  },
  {
    icon: MessageCircle,
    title: "Uma conversa, não um formulário",
    description: "Conte pro Tobias como está sua vida financeira e ele monta o plano, sem planilha e sem burocracia.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");

  return (
    <div className="flex-1 flex flex-col bg-brand-950 text-onbrand relative overflow-hidden">
      {/* Soft radial glow behind the hero — the only "decoration" on the page,
          kept subtle so it reads as premium rather than busy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--color-gold-500) 0%, transparent 65%)",
        }}
      />

      <header className="relative flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-transparent.png" alt="Tobias" width={36} height={36} className="drop-shadow-sm" />
          <span className="font-display font-semibold text-xl tracking-wide">Tobias</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-cream-100/80 hover:text-onbrand px-3 py-2 transition-colors">
            Entrar
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="sm">
              Começar grátis
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative flex flex-col items-center px-6 pt-16 pb-8 text-center">
        <Image
          src="/logo-transparent.png"
          alt=""
          width={112}
          height={112}
          className="mb-9 drop-shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
        />
        <h1 className="font-display font-semibold text-4xl sm:text-6xl leading-[1.08] max-w-3xl text-onbrand tracking-tight">
          Você conversa. O Tobias entende. O plano acontece.
        </h1>
        <p className="mt-6 max-w-xl text-cream-100/75 text-lg leading-relaxed">
          Seu planejador financeiro pessoal com inteligência artificial. Sem planilhas, sem
          formulários intermináveis. Só uma conversa que vira um plano de verdade.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link href="/signup">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto shadow-lg shadow-gold-900/20">
              Experimente 15 dias grátis
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-cream-100/30 text-onbrand hover:bg-white/5"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>
      </main>

      {/* O que o Tobias faz — feature highlights */}
      <section className="relative px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 text-left rounded-2xl bg-white/[0.03] border border-white/5 p-5">
              <f.icon className="h-6 w-6 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-semibold text-onbrand">{f.title}</h3>
                <p className="text-sm text-cream-100/65 mt-1 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="relative px-6 py-16 max-w-5xl mx-auto w-full text-center">
        <h2 className="font-display font-semibold text-3xl text-onbrand tracking-tight">Um plano, do seu jeito</h2>
        <p className="mt-3 text-cream-100/65 max-w-lg mx-auto">
          Comece com 15 dias grátis. Depois, escolha como prefere pagar: quanto mais longo o
          período, menor o valor por mês.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.cycle}
              className={
                plan.highlight
                  ? "bg-brand-800 border-gold-500/50 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)] relative"
                  : "bg-brand-800/60"
              }
            >
              <CardContent className="py-6 flex flex-col h-full">
                {plan.highlight && (
                  <Badge tone="gold" className="absolute -top-3 left-6">
                    Melhor custo-benefício
                  </Badge>
                )}
                <p className="text-xs uppercase tracking-wide text-cream-100/60 mb-2">{plan.label}</p>
                <p className="font-sans font-semibold text-3xl tracking-tight text-onbrand tabular-nums">
                  {plan.priceLabel}
                </p>
                <p className="text-sm text-gold-400 mt-1 tabular-nums">{plan.monthlyEquivalentLabel}</p>
                <p className="text-xs text-cream-100/50 mt-3">{plan.billingNote}</p>
                <ul className="mt-5 space-y-2 text-sm text-cream-100/75 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok-400 shrink-0 mt-0.5" /> Acesso completo ao Tobias
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok-400 shrink-0 mt-0.5" /> 15 dias grátis para testar
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-ok-400 shrink-0 mt-0.5" /> Cancele quando quiser
                  </li>
                </ul>
                <Link href={`/signup?plano=${plan.cycle}`} className="mt-6">
                  <Button variant={plan.highlight ? "secondary" : "outline"} className="w-full border-cream-100/30">
                    Começar grátis
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="relative text-center text-xs text-cream-100/40 py-8">
        © {new Date().getFullYear()} Tobias. Planejamento financeiro pessoal com IA.
      </footer>
    </div>
  );
}
