import { listUsersForAdmin } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { UserRowActions } from "./UsersClient";
import { formatDate } from "../../adminFormat";

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

      <form className="flex gap-2 mb-4 flex-wrap items-center" method="get">
        <Input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 min-w-[220px] h-10"
        />
        <Select name="status" defaultValue={params.status ?? ""} className="h-10 w-auto min-w-[190px]">
          <option value="">Todos os status</option>
          <option value="TRIALING">Em trial</option>
          <option value="ACTIVE">Ativo</option>
          <option value="PAST_DUE">Pagamento atrasado</option>
          <option value="CANCELED">Cancelado</option>
          <option value="PENDING_PAYMENT">Aguardando pagamento</option>
        </Select>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onbrand/50 text-xs uppercase tracking-wide">
                <th className="px-4 pt-4 pb-2.5 font-medium">Nome</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">E-mail</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Plano</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Status</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Onboarding</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Trial até</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Cadastro</th>
                <th className="px-4 pt-4 pb-2.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="even:bg-onbrand/[0.025]">
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <UserRowActions user={u} />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-onbrand/50">
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
