"use client";

import { useState } from "react";
import { Rows3, KanbanSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LeadsTable } from "./LeadsClient";
import { LeadsKanban } from "./LeadsKanban";
import type { AdminLeadRow } from "@/services/admin";

export function LeadsViewSwitcher({
  tableRows,
  kanbanRows,
  kanbanTruncated,
  page,
  totalPages,
}: {
  tableRows: AdminLeadRow[];
  kanbanRows: AdminLeadRow[];
  kanbanTruncated: boolean;
  page: number;
  totalPages: number;
}) {
  const [view, setView] = useState<"table" | "kanban">("table");

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 w-fit rounded-lg bg-onbrand/[0.05] p-1">
        <button
          type="button"
          onClick={() => setView("table")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "table" ? "bg-brand-700 text-onbrand" : "text-onbrand/50 hover:text-onbrand/80"
          )}
        >
          <Rows3 className="h-3.5 w-3.5" /> Tabela
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "kanban" ? "bg-brand-700 text-onbrand" : "text-onbrand/50 hover:text-onbrand/80"
          )}
        >
          <KanbanSquare className="h-3.5 w-3.5" /> Kanban
        </button>
      </div>

      {view === "table" ? (
        <>
          <LeadsTable key={tableRows.map((l) => l.id).join(",")} rows={tableRows} />
          {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4 text-sm text-onbrand/60">
              Página {page} de {totalPages}
            </div>
          )}
        </>
      ) : (
        <LeadsKanban rows={kanbanRows} truncated={kanbanTruncated} />
      )}
    </div>
  );
}
