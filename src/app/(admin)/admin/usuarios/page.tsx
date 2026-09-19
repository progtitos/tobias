import { listUsersForAdmin } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "../adminFormat";

const STATUS_TONE: Record<string, "ok" | "gold" | "warn" | "neutral"> = {
  ACTIVE: "ok",
  TRIALING: "gold",
  PENDING_PAYMENT: "neutral",
  PAST_DUE: "warn",
  CANCELED: "warn",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const { rows, total, pageSize } = await listUsersForAdmin({ search: params.q, status: params.status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Usuários</h1>
      <p className="text-sm text-onbrand/55 mb-6">{total} usuário(s) cadastrado(s) no Tobias.</p>

      <form className="flex gap-2 mb-4 flex-wrap" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 min-w-[220px] rounded-lg bg-brand-800 border border-transparent px-3 py-2 text-sm text-onbrand placeholder:text-onbrand/40 focus:outline-none focus:ring-1 focus:ring-gold-400"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg bg-brand-800 border border-transparent px-3 py-2 text-sm text-onbrand focus:outline-none focus:ring-1 focus:ring-gold-400"
        >
          <option value="">Todos os status</option>
          <option value="TRIALING">Em trial</option>
          <option value="ACTIVE">Ativo</option>
          <option value="PAST_DUE">Pagamento atrasado</option>
          <option value="CANCELED">Cancelado</option>
          <option value="PENDING_PAYMENT">Aguardando pagamento</option>
        </select>
        <button type="submit" className="rounded-lg bg-gold-500 text-ink-900 font-medium px-4 py-2 text-sm">
          Filtrar
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onbrand/50 text-xs uppercase tracking-wide border-b border-onbrand/[0.06]">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Trial até</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-onbrand/[0.04]">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-onbrand font-medium">
                    {u.name}
                    {u.role !== "USER" && <span className="ml-1.5 text-[10px] text-gold-400 uppercase">{u.role}</span>}
                  </td>
                  <td className="px-4 py-3 text-onbrand/70">{u.email}</td>
                  <td className="px-4 py-3 text-onbrand/70">{u.subscriptionPlan}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[u.subscriptionStatus] ?? "neutral"}>{u.subscriptionStatus}</Badge>
                  </td>
                  <td className="px-4 py-3 text-onbrand/70">{u.onboardingCompleted ? "Completo" : "Incompleto"}</td>
                  <td className="px-4 py-3 text-onbrand/70 tabular-nums">{formatDate(u.trialEndsAt)}</td>
                  <td className="px-4 py-3 text-onbrand/70 tabular-nums">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-onbrand/50">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm text-onbrand/60">
          Página {page} de {totalPages}
        </div>
      )}
    </div>
  );
}
