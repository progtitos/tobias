"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Target,
  PieChart,
  Compass,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { UserMenu } from "./UserMenu";
import { TrialBadge } from "./TrialBadge";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/chat", label: "Tobias", icon: MessageCircle },
  { href: "/expenses", label: "Gastos", icon: Receipt },
  { href: "/goals", label: "Sonhos", icon: Target },
  { href: "/budget", label: "Orçamento", icon: PieChart },
  { href: "/compass", label: "Bússola", icon: Compass },
  { href: "/retirement", label: "Aposentadoria", icon: TrendingUp },
  { href: "/decide", label: "Decisão", icon: ShoppingBag },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-cream-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-brand-950 border-r border-brand-800 px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
          <Image src="/logo-transparent.png" alt="Tobias" width={28} height={28} />
          <span className="font-serif text-lg text-cream-50">Tobias</span>
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
                  active ? "bg-white/10 text-gold-400" : "text-cream-50/45 hover:bg-white/5 hover:text-cream-50/80"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <TrialBadge user={user} className="mb-3" />
        <UserMenu user={user} />
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-brand-950 sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo-transparent.png" alt="Tobias" width={24} height={24} />
          <span className="font-serif text-base text-cream-50">Tobias</span>
        </Link>
        <div className="flex items-center gap-2">
          <TrialBadge user={user} compact />
          <UserMenu user={user} compact />
        </div>
      </header>

      <main className="flex-1 flex flex-col pb-16 md:pb-0 min-w-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex items-stretch justify-between bg-brand-950 border-t border-brand-800">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
                active ? "text-gold-400" : "text-cream-50/45"
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
