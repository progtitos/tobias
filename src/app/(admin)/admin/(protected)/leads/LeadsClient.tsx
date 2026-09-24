"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Input";
import { formatDate } from "../../adminFormat";
import {
  importLeadsAction,
  updateLeadStatusAction,
  updateLeadAction,
  deleteLeadAction,
  deleteLeadsAction,
  type ImportLeadsState,
  type UpdateLeadState,
} from "./actions";
import type { AdminLeadRow } from "@/services/admin";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;

export function ImportLeadsForm() {
  const [state, formAction, pending] = useActionState<ImportLeadsState, FormData>(importLeadsAction, undefined);

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <h2 className="font-sans font-semibold text-onbrand mb-1">Importar leads (CSV ou Excel)</h2>
        <p className="text-xs text-onbrand/55 mb-3">
          Cabeçalho aceito em qualquer ordem: <span className="text-onbrand/75">name/nome</span>,{" "}
          <span className="text-onbrand/75">email</span>, <span className="text-onbrand/75">phone/telefone</span>.
          Aceita .csv, .xlsx e .xls. Aguenta arquivos grandes (ex: 50 mil linhas), a importação roda em blocos.
        </p>
        <form action={formAction} className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
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
    <div className="relative inline-block">
      <select
        defaultValue={lead.status}
        disabled={pending}
        onChange={(e) => startTransition(() => updateLeadStatusAction(lead.id, e.target.value))}
        className="appearance-none rounded-lg bg-brand-800 border border-transparent px-2 py-1 pr-6 text-xs text-onbrand focus:outline-none focus:ring-1 focus:ring-gold-400"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-onbrand/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editar lead — pedido do Thiago (2026-09-24): "é necessário podermos editar
// os leads". O status continua editável direto na tabela (LeadStatusSelect,
// já rápido pra triagem); este modal cobre os campos que vêm do
// CSV/Excel importado e podem vir errados ou incompletos (nome, e-mail,
// telefone) mais as anotações internas.
// ---------------------------------------------------------------------------

function EditLeadModal({ lead, open, onClose }: { lead: AdminLeadRow; open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<UpdateLeadState, FormData>(updateLeadAction, undefined);

  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title={`Editar ${lead.name || lead.email || lead.phone || "lead"}`}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <div>
          <Label htmlFor={`lead-name-${lead.id}`}>Nome</Label>
          <Input id={`lead-name-${lead.id}`} name="name" defaultValue={lead.name ?? ""} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`lead-email-${lead.id}`}>E-mail</Label>
            <Input id={`lead-email-${lead.id}`} name="email" type="email" defaultValue={lead.email ?? ""} />
          </div>
          <div>
            <Label htmlFor={`lead-phone-${lead.id}`}>Telefone</Label>
            <Input id={`lead-phone-${lead.id}`} name="phone" defaultValue={lead.phone ?? ""} />
          </div>
        </div>
        <div>
          <Label htmlFor={`lead-notes-${lead.id}`}>Notas (opcional)</Label>
          <Textarea id={`lead-notes-${lead.id}`} name="notes" rows={3} defaultValue={lead.notes ?? ""} />
        </div>
        <FieldError>{state?.error}</FieldError>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tabela de leads com seleção múltipla — pedido do Thiago (2026-09-24): "tem
// que ter opção de selecionar para apagar, selecionar tudo etc". A seleção
// vive só neste componente cliente (não sobrevive a filtro/página novos, que
// trocam `rows` via navegação de verdade e remontam o componente pela `key`
// passada em page.tsx). "Selecionar tudo" seleciona só as linhas da página
// atual, igual ao resto do padrão de paginação do admin.
// ---------------------------------------------------------------------------

export function LeadsTable({ rows }: { rows: AdminLeadRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkPending, startBulkTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-xl bg-brand-800 px-4 py-2.5">
          <p className="text-sm text-onbrand/80">
            {selected.size} lead{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs text-onbrand/55 hover:text-onbrand"
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </button>
            <Button type="button" size="sm" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onbrand/50 text-xs uppercase tracking-wide">
                <th className="pl-4 pr-2 pt-4 pb-2.5 font-medium w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos os leads desta página"
                    className="h-4 w-4 rounded accent-gold-500"
                  />
                </th>
                <th className="px-2 pt-4 pb-2.5 font-medium">Nome</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">E-mail</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Telefone</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Origem</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Status</th>
                <th className="px-4 pt-4 pb-2.5 font-medium">Cadastro</th>
                <th className="px-4 pt-4 pb-2.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <LeadRow key={lead.id} lead={lead} checked={selected.has(lead.id)} onToggle={() => toggleOne(lead.id)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-onbrand/50">
                    Nenhum lead cadastrado ainda. Importe um CSV ou Excel acima pra começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Excluir ${selected.size} lead${selected.size === 1 ? "" : "s"}?`}
        description="Isso não pode ser desfeito."
        pending={bulkPending}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          startBulkTransition(async () => {
            try {
              await deleteLeadsAction(Array.from(selected));
              setSelected(new Set());
              setConfirmBulkDelete(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao excluir os leads selecionados.");
            }
          });
        }}
      />
    </div>
  );
}

function LeadRow({ lead, checked, onToggle }: { lead: AdminLeadRow; checked: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = lead.name || lead.email || lead.phone || "lead";

  return (
    <tr className="even:bg-onbrand/[0.025]">
      <td className="pl-4 pr-2 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Selecionar ${label}`}
          className="h-4 w-4 rounded accent-gold-500"
        />
      </td>
      <td className="px-2 py-3 text-onbrand font-medium">{lead.name || "-"}</td>
      <td className="px-4 py-3 text-onbrand/70">{lead.email || "-"}</td>
      <td className="px-4 py-3 text-onbrand/70">{lead.phone || "-"}</td>
      <td className="px-4 py-3 text-onbrand/50 text-xs">{lead.source || "-"}</td>
      <td className="px-4 py-3">
        <LeadStatusSelect lead={lead} />
      </td>
      <td className="px-4 py-3 text-onbrand/70 tabular-nums">{formatDate(lead.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <IconButton label={`Editar ${label}`} onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={`Excluir ${label}`} tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </td>

      {editing && <EditLeadModal lead={lead} open={editing} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir o lead "${label}"?`}
        description="Isso não pode ser desfeito."
        pending={pending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await deleteLeadAction(lead.id);
              setConfirmDelete(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
            }
          });
        }}
      />
    </tr>
  );
}

