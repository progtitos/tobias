"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

export function UserMenu({ user, compact }: { user: SessionUser; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const initial = user.name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-xl hover:bg-cream-100 transition-colors text-left",
          compact ? "p-1" : "w-full p-2"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-cream-50 text-sm font-medium">
          {initial}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink-900 truncate">{user.name}</span>
            <span className="block text-xs text-ink-500 truncate">{user.email}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-52 rounded-xl border border-ink-300/30 bg-white shadow-lg overflow-hidden z-20">
          <Link href="/settings" className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-cream-100">
            <UserIcon className="h-4 w-4" /> Meu perfil
          </Link>
          <Link href="/settings" className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-cream-100">
            <Settings className="h-4 w-4" /> Configurações
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-danger-600 hover:bg-danger-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
