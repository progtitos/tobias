import { listLeadsForAdmin } from "@/services/admin";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ImportLeadsForm, LeadsTable } from "./LeadsClient";

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
        {total} lead(s) cadastrado(s). Envio de e-mail marketing e WhatsApp em massa ainda não estão conectados aqui,
        ver nota no schema (<span className="text-onbrand/70">leads</span>) sobre por quê.
      </p>

      <ImportLeadsForm />

      <form className="flex gap-2 mb-4 flex-wrap items-center" method="get">
        <Input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="flex-1 min-w-[220px] h-10"
        />
        <Select name="status" defaultValue={params.status ?? ""} className="h-10 w-auto min-w-[170px]">
          <option value="">Todos os status</option>
          <option value="NEW">Novo</option>
          <option value="CONTACTED">Contatado</option>
          <option value="QUALIFIED">Qualificado</option>
          <option value="CONVERTED">Convertido</option>
          <option value="LOST">Perdido</option>
        </Select>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>

      {/* key força remontar a tabela (e limpar qualquer seleção antiga) toda
          vez que o conjunto de linhas muda de verdade: filtro novo, página
          nova, ou uma exclusão/importação que muda quem está na lista. */}
      <LeadsTable key={rows.map((l) => l.id).join(",")} rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm text-onbrand/60">
          Página {page} de {totalPages}
        </div>
      )}
    </div>
  );
}
