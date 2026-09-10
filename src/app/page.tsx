import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");

  return (
    <div className="flex-1 flex flex-col bg-brand-950 text-cream-50">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Tobias" width={32} height={32} className="rounded-full" />
          <span className="font-serif text-xl tracking-wide">Tobias</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-cream-100/80 hover:text-cream-50 px-3 py-2">
            Entrar
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="sm">
              Começar grátis
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/logo.png"
          alt=""
          width={88}
          height={88}
          className="rounded-full mb-8 opacity-95"
        />
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight max-w-2xl text-cream-50">
          Você conversa. O Tobias entende. O plano acontece.
        </h1>
        <p className="mt-5 max-w-xl text-cream-100/75 text-lg leading-relaxed">
          Seu planejador financeiro pessoal com inteligência artificial. Sem planilhas, sem
          formulários intermináveis — só uma conversa que vira um plano de verdade.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3">
          <Link href="/signup">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Experimente 15 dias grátis
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-cream-100/30 text-cream-50 hover:bg-white/5"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>

        <dl className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl text-left">
          {[
            {
              title: "Bússola Financeira",
              body: "Reserva, dívidas, investimentos, aposentadoria — um retrato claro de onde você está.",
            },
            {
              title: "Curva de Aposentadoria",
              body: "Veja hoje se o seu ritmo atual leva você até onde você quer chegar.",
            },
            {
              title: "Fotografe uma nota",
              body: "Sem digitar nada — o Tobias lê a nota fiscal e organiza o gasto por você.",
            },
          ].map((f) => (
            <div key={f.title}>
              <dt className="font-serif text-lg text-gold-400">{f.title}</dt>
              <dd className="mt-1.5 text-sm text-cream-100/70 leading-relaxed">{f.body}</dd>
            </div>
          ))}
        </dl>
      </main>

      <footer className="text-center text-xs text-cream-100/40 py-8">
        © {new Date().getFullYear()} Tobias. Planejamento financeiro pessoal com IA.
      </footer>
    </div>
  );
}
