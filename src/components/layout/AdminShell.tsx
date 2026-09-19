"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Contact } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/leads", label: "Leads (CRM)", icon: Contact },
];

/**
 * Casca do painel admin — mesma estrutura de sidebar do AppShell do cliente
 * (logo + nav vertical à esquerda no desktop, header + nav inferior no
 * mobile), só trocando os itens de navegação e adicionando o nome do admin
 * e o link de volta pro app no rodapé da sidebar. Guardado por
 * requireAdmin() no layout do grupo.
 */
export function AdminShell({ children, adminName }: { children: React.ReactNode; adminName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-brand-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-brand-950 px-4 py-6">
        <Link href="/admin" className="flex items-center gap-2.5 px-2 mb-8">
          <Image src="/logo-transparent.png" alt="Tobias" width={40} height={40} />
          <span className="font-display text-xl text-onbrand">
            Tobias <span className="text-onbrand/40 text-base font-sans font-normal">Admin</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active ? "bg-onbrand/10 text-gold-400" : "text-onbrand/45 hover:bg-onbrand/5 hover:text-onbrand/80"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-onbrand/[0.06] pt-3 flex flex-col gap-2">
          <span className="px-3 text-xs text-onbrand/45 truncate">{adminName}</span>
          <Link href="/dashboard" className="px-3 text-xs text-gold-400 hover:underline">
            ← Voltar ao app
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-brand-950 sticky top-0 z-10">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/logo-transparent.png" alt="Tobias" width={32} height={32} />
          <span className="font-display text-lg text-onbrand">
            Tobias <span className="text-onbrand/40 text-sm font-sans font-normal">Admin</span>
          </span>
        </Link>
        <Link href="/dashboard" className="text-xs text-gold-400 hover:underline">
          Voltar ao app →
        </Link>
      </header>

      <main className="flex-1 flex flex-col pb-16 md:pb-0 min-w-0">
        <div className="px-6 py-6 max-w-6xl mx-auto w-full">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex items-stretch justify-between bg-brand-950 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.5)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
                active ? "text-gold-400" : "text-onbrand/45"
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
