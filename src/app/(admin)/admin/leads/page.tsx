import { listLeadsForAdmin } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/Card";
import { ImportLeadsForm, LeadStatusSelect } from "./LeadsClient";
import { formatDate } from "../adminFormat";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const { rows, total, pageSize } = await listLeadsForAdmin({ search: params.q, status: params.status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Leads (CRM)</h1>
      <p className="text-sm text-onbrand/55 mb-6">
        {total} lead(s) cadastrado(s). Envio de e-mail marketing e WhatsApp em massa ainda não estão conectados aqui
        — ver nota no schema (<span className="text-onbrand/70">leads</span>) sobre por quê.
      </p>

      <ImportLeadsForm />

      <form className="flex gap-2 mb-4 flex-wrap" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="flex-1 min-w-[220px] rounded-lg bg-brand-800 border border-transparent px-3 py-2 text-sm text-onbrand placeholder:text-onbrand/40 focus:outline-none focus:ring-1 focus:ring-gold-400"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg bg-brand-800 border border-transparent px-3 py-2 text-sm text-onbrand focus:outline-none focus:ring-1 focus:ring-gold-400"
        >
          <option value="">Todos os status</option>
          <option value="NEW">Novo</option>
          <option value="CONTACTED">Contatado</option>
          <option value="QUALIFIED">Qualificado</option>
          <option value="CONVERTED">Convertido</option>
          <option value="LOST">Perdido</option>
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
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-onbrand/[0.04]">
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-onbrand font-medium">{l.name || "—"}</td>
                  <td className="px-4 py-3 text-onbrand/70">{l.email || "—"}</td>
                  <td className="px-4 py-3 text-onbrand/70">{l.phone || "—"}</td>
                  <td className="px-4 py-3 text-onbrand/50 text-xs">{l.source || "—"}</td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect lead={l} />
                  </td>
                  <td className="px-4 py-3 text-onbrand/70 tabular-nums">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-onbrand/50">
                    Nenhum lead cadastrado ainda. Importe um CSV acima pra começar.
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
