import { Badge } from "@/components/ui/Badge";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

export function TrialBadge({ user, compact, className }: { user: SessionUser; compact?: boolean; className?: string }) {
  // Contas ADMIN são da equipe, não clientes em teste — pedido do Thiago
  // 2026-09-19 ("admin não tem Trial"): a própria conta dele ainda carrega
  // os campos de trial de quando fez o cadastro normal, mas o badge não deve
  // aparecer pra staff.
  if (user.role === "ADMIN") return null;
  if (user.subscriptionPlan !== "TRIAL" || user.subscriptionStatus !== "TRIALING") return null;

  const daysLeft = Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <Badge tone={daysLeft <= 3 ? "warn" : "gold"} className={cn(compact && "text-[10px] px-2", className)}>
      {daysLeft > 0 ? `Teste: ${daysLeft} dia${daysLeft === 1 ? "" : "s"}` : "Teste expirado"}
    </Badge>
  );
}
