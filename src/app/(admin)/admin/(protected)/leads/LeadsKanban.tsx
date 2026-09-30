"use client";

import { formatDate } from "../../adminFormat";
import { Card, CardContent } from "@/components/ui/Card";
import { STATUS_OPTIONS, STATUS_LABELS, LeadStatusSelect, LeadActions } from "./LeadsClient";
import type { AdminLeadRow } from "@/services/admin";

// ---------------------------------------------------------------------------
// Visão Kanban dos leads (pedido do Thiago, 2026-09-30: "CRM... graficos,
// planos" — a leitura em kanban do funil de vendas). Movimentação de coluna
// acontece pelo mesmo <select> de status já usado na tabela (LeadStatusSelect)
// em vez de arrastar-e-soltar: drag-and-drop nativo do navegador não funciona
// de forma confiável em telas de toque, e o select já é testado/acessível
// (teclado, leitor de tela) nos dois lugares. Edição/exclusão reaproveitam
// LeadActions, os mesmos diálogos da tabela.
// ---------------------------------------------------------------------------

function KanbanCard({ lead }: { lead: AdminLeadRow }) {
  const label = lead.name || lead.email || lead.phone || "Lead sem nome";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-onbrand truncate">{label}</p>
          <LeadActions lead={lead} />
        </div>
        {lead.email && <p className="text-xs text-onbrand/60 truncate">{lead.email}</p>}
        {lead.phone && <p className="text-xs text-onbrand/60 truncate">{lead.phone}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-onbrand/40">{lead.source || "origem não informada"}</span>
          <span className="text-[11px] text-onbrand/40 tabular-nums">{formatDate(lead.createdAt)}</span>
        </div>
        <div className="mt-2">
          <LeadStatusSelect lead={lead} />
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadsKanban({ rows, truncated }: { rows: AdminLeadRow[]; truncated: boolean }) {
  return (
    <div>
      {truncated && (
        <p className="text-xs text-onbrand/45 mb-3">
          Mostrando os {rows.length} leads mais recentes nesta visão. Use a busca na Tabela pra achar um mais antigo.
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STATUS_OPTIONS.map((status) => {
          const columnLeads = rows.filter((r) => r.status === status);
          return (
            <div key={status} className="flex flex-col w-[260px] shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-onbrand/60">{STATUS_LABELS[status]}</h3>
                <span className="text-[11px] text-onbrand/40 tabular-nums">{columnLeads.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[80px] rounded-xl bg-onbrand/[0.02] p-1.5">
                {columnLeads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} />
                ))}
                {columnLeads.length === 0 && (
                  <p className="text-xs text-onbrand/30 text-center py-4">Nenhum lead aqui.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
