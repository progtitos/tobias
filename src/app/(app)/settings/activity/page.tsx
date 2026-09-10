import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getRecentActivity } from "@/services/account";
import { Card, CardContent } from "@/components/ui/Card";

const EVENT_LABELS: Record<string, string> = {
  goal_created: "Objetivo criado",
  goal_updated: "Objetivo atualizado",
  budget_overridden: "Limite de orçamento ajustado manualmente",
  retirement_plan_created: "Plano de aposentadoria criado",
  account_deleted: "Conta excluída",
  affordability_check: "Consulta de \"posso comprar?\"",
};

function describeEvent(type: string, payload: unknown): string {
  const label = EVENT_LABELS[type] ?? type;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.title === "string") return `${label}: ${p.title}`;
    if (typeof p.purchaseDescription === "string") return `${label}: ${p.purchaseDescription}`;
  }
  return label;
}

export default async function ActivityPage() {
  const user = await requireOnboardedUser();
  const events = await getRecentActivity(user.id);

  return (
    <div className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-900 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Configurações
      </Link>
      <h1 className="font-serif text-2xl text-brand-950 mb-1">Atividade recente</h1>
      <p className="text-sm text-ink-500 mb-6">
        Um registro das mudanças mais importantes feitas na sua conta e no seu plano financeiro.
      </p>

      {events.length === 0 ? (
        <p className="text-sm text-ink-500 py-12 text-center">Nenhuma atividade registrada ainda.</p>
      ) : (
        <Card>
          <CardContent className="py-2 divide-y divide-ink-300/15">
            {events.map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-800">{describeEvent(e.type, e.payload)}</span>
                <span className="text-xs text-ink-400 shrink-0">
                  {e.createdAt.toLocaleDateString("pt-BR")} {e.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
