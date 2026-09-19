"use client";

import { useActionState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { importLeadsAction, updateLeadStatusAction, type ImportLeadsState } from "./actions";
import type { AdminLeadRow } from "@/services/admin";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;

export function ImportLeadsForm() {
  const [state, formAction, pending] = useActionState<ImportLeadsState, FormData>(importLeadsAction, undefined);

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <h2 className="font-sans font-semibold text-onbrand mb-1">Importar leads (CSV)</h2>
        <p className="text-xs text-onbrand/55 mb-3">
          Cabeçalho aceito em qualquer ordem: <span className="text-onbrand/75">name/nome</span>,{" "}
          <span className="text-onbrand/75">email</span>, <span className="text-onbrand/75">phone/telefone</span>.
          Aguenta arquivos grandes (ex: 50 mil linhas) — a importação roda em blocos.
        </p>
        <form action={formAction} className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm text-onbrand/80 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gold-500 file:text-ink-900 file:font-medium file:text-xs text-xs"
          />
          <Button type="submit" size="sm" loading={pending}>
            Importar
          </Button>
        </form>
        {state?.error && <p className="text-sm text-danger-300 mt-2">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-ok-400 mt-2">
            {state.success.imported} lead(s) importado(s) de {state.success.total} linha(s)
            {state.success.skipped > 0 ? ` (${state.success.skipped} linha(s) vazia(s) ignorada(s))` : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadStatusSelect({ lead }: { lead: AdminLeadRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={lead.status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateLeadStatusAction(lead.id, e.target.value))}
      className="rounded-lg bg-brand-800 border border-transparent px-2 py-1 text-xs text-onbrand focus:outline-none focus:ring-1 focus:ring-gold-400"
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

