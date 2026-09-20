import { getAdminOverview } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/Card";

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  TOBIAS: "Tobias",
  TOBIAS_PRO: "Tobias Pro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  TRIALING: "Em trial",
  ACTIVE: "Ativo",
  PAST_DUE: "Pagamento atrasado",
  CANCELED: "Cancelado",
};

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "gold" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wide text-onbrand/50 mb-1">{label}</p>
        <p className={`font-sans font-semibold text-2xl tabular-nums ${tone === "gold" ? "text-gold-400" : "text-onbrand"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Visão geral</h1>
      <p className="text-sm text-onbrand/55 mb-6">Números do Tobias em produção, direto do banco.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatTile label="Total de usuários" value={overview.totalUsers} />
        <StatTile label="Novos (30 dias)" value={overview.newUsersLast30d} tone="gold" />
        <StatTile label="Assinantes ativos" value={overview.byStatus.ACTIVE ?? 0} />
        <StatTile label="Em trial" value={overview.byStatus.TRIALING ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="py-4">
            <h2 className="font-sans font-semibold text-onbrand mb-3">Por status de assinatura</h2>
            <div className="flex flex-col gap-1">
              {Object.entries(overview.byStatus).map(([status, n]) => (
                <div key={status} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm even:bg-onbrand/[0.03]">
                  <span className="text-onbrand/70">{STATUS_LABELS[status] ?? status}</span>
                  <span className="font-medium tabular-nums text-onbrand">{n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <h2 className="font-sans font-semibold text-onbrand mb-3">Por plano</h2>
            <div className="flex flex-col gap-1">
              {Object.entries(overview.byPlan).map(([plan, n]) => (
                <div key={plan} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm even:bg-onbrand/[0.03]">
                  <span className="text-onbrand/70">{PLAN_LABELS[plan] ?? plan}</span>
                  <span className="font-medium tabular-nums text-onbrand">{n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <h2 className="font-sans font-semibold text-onbrand mb-1">CRM: Leads</h2>
          <p className="text-sm text-onbrand/55 mb-3">
            {overview.totalLeads} lead(s) cadastrado(s). Disparo de e-mail/WhatsApp em massa ainda não está
            conectado, ver <span className="text-onbrand/70">/admin/leads</span> pra importar e gerenciar por
            enquanto.
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(overview.leadsByStatus).map(([status, n]) => (
              <span key={status} className="text-xs rounded-full bg-onbrand/[0.05] text-onbrand/70 px-2.5 py-1">
                {status}: {n}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
