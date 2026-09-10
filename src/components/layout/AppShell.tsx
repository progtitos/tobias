import Link from "next/link";
import Image from "next/image";
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
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-cream-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-ink-300/20 bg-white/60 px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
          <Image src="/logo.png" alt="Tobias" width={30} height={30} className="rounded-full" />
          <span className="font-serif text-lg text-brand-950">Tobias</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-900 transition-colors"
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <TrialBadge user={user} className="mb-3" />
        <UserMenu user={user} />
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-ink-300/20 bg-white/70 sticky top-0 z-10 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Tobias" width={26} height={26} className="rounded-full" />
          <span className="font-serif text-base text-brand-950">Tobias</span>
        </Link>
        <div className="flex items-center gap-2">
          <TrialBadge user={user} compact />
          <UserMenu user={user} compact />
        </div>
      </header>

      <main className="flex-1 flex flex-col pb-16 md:pb-0 min-w-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex items-stretch justify-between bg-white/95 backdrop-blur border-t border-ink-300/20">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-ink-500 hover:text-brand-900"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
