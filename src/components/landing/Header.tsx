"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Logo from "@/components/landing/Logo";
import BrandButton from "@/components/landing/BrandButton";
import { APP_LINKS, NAV_LINKS } from "@/components/landing/site";
import { useScrolled } from "@/components/landing/useReveal";
import { cn } from "@/lib/utils/cn";

export default function Header() {
  const scrolled = useScrolled(16);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900"
      >
        Ir para o conteúdo
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-200",
          scrolled
            ? "bg-brand-950/85 shadow-[0_1px_0_rgba(0,0,0,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-brand-950/70"
            : "bg-transparent"
        )}
      >
        <div className="lp-container flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
          <a href="#top" className="lp-press flex items-center" aria-label="Página inicial do Tobias">
            <Logo />
          </a>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-[0.875rem] text-cream-100/75 transition-colors duration-150 hover:bg-onbrand/[0.05] hover:text-cream-50"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <BrandButton href={APP_LINKS.login} variant="ghost" size="sm">
              Entrar
            </BrandButton>
            <BrandButton href={APP_LINKS.signup} size="sm">
              Começar grátis
            </BrandButton>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="menu-mobile"
            className="lp-press inline-flex size-10 items-center justify-center rounded-lg border border-transparent bg-onbrand/[0.06] text-cream-50 hover:bg-onbrand/[0.1] lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      <div
        id="menu-mobile"
        hidden={!open}
        className="fixed inset-0 z-40 bg-brand-950/97 backdrop-blur-xl lg:hidden"
      >
        <div className="lp-container flex h-full flex-col gap-2 pt-24 pb-10">
          <nav aria-label="Navegação mobile" className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-4 font-display text-lg font-medium text-cream-100 transition-colors hover:text-gold-400"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <BrandButton href={APP_LINKS.signup} size="lg" onClick={() => setOpen(false)}>
              Experimente 15 dias grátis
            </BrandButton>
            <BrandButton href={APP_LINKS.login} variant="outline" size="lg" onClick={() => setOpen(false)}>
              Já tenho conta
            </BrandButton>
          </div>
        </div>
      </div>
    </>
  );
}
