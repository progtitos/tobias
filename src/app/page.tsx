import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");

  return (
    <div className="flex-1 flex flex-col bg-brand-950 text-cream-50 relative overflow-hidden">
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
          <span className="font-serif font-semibold text-xl tracking-wide">Tobias</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-cream-100/80 hover:text-cream-50 px-3 py-2 transition-colors">
            Entrar
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="sm">
              Começar grátis
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <Image
          src="/logo-transparent.png"
          alt=""
          width={112}
          height={112}
          className="mb-9 drop-shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
        />
        <h1 className="font-serif font-semibold text-4xl sm:text-6xl leading-[1.08] max-w-3xl text-cream-50 tracking-tight">
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
              className="w-full sm:w-auto border-cream-100/30 text-cream-50 hover:bg-white/5"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>
      </main>

      <footer className="relative text-center text-xs text-cream-100/40 py-8">
        © {new Date().getFullYear()} Tobias. Planejamento financeiro pessoal com IA.
      </footer>
    </div>
  );
}
