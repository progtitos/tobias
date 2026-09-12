"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Input";
import { formatBRL } from "@/lib/utils/money";
import { confirmStatementImportAction, type ConfirmImportState } from "../../importActions";

type Category = { id: string; name: string };
type Item = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categoryGuess: string | null;
  suggestedCategoryId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  isDuplicate: boolean;
  isSelected: boolean;
};

export function ImportReviewClient({
  documentId,
  status,
  errorMessage,
  targetLabel,
  kind,
  periodStart,
  periodEnd,
  categories,
  items,
}: {
  documentId: string;
  status: string;
  errorMessage: string | null;
  targetLabel: string;
  kind: string;
  periodStart: string | null;
  periodEnd: string | null;
  categories: Category[];
  items: Item[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((i) => i.isSelected).map((i) => i.id)));
  // Categoria de cada linha (pré-preenchida com a sugestão vinda do server —
  // regra "contém" já cadastrada ou palpite da IA), editável antes de
  // confirmar. `always` guarda, pra cada linha marcada "categorizar sempre",
  // a palavra-chave que vai virar uma regra permanente (ver
  // recurringCategoryRules) — a pessoa pode encurtar a descrição inteira até
  // sobrar só o pedaço que identifica o gasto (ex: "quinto andar").
  const [categoryByItem, setCategoryByItem] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.suggestedCategoryId ?? ""]))
  );
  const [always, setAlways] = useState<Record<string, string>>({});
  const boundAction = confirmStatementImportAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<ConfirmImportState, FormData>(boundAction, undefined);

  function toggleAlways(item: Item) {
    setAlways((prev) => {
      const next = { ...prev };
      if (item.id in next) {
        delete next[item.id];
      } else {
        next[item.id] = item.description;
      }
      return next;
    });
  }

  const periodLabel = useMemo(() => {
    if (!periodStart || !periodEnd) return null;
    const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${fmt(periodStart)}–${fmt(periodEnd)}`;
  }, [periodStart, periodEnd]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const duplicateCount = items.filter((i) => i.isDuplicate).length;

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-lg mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Confira antes de confirmar</h1>
        <p className="text-sm text-onbrand/55 mb-5">
          {kind === "INVOICE_STATEMENT" ? "Fatura" : "Extrato"} de <b className="text-onbrand/80">{targetLabel}</b>
          {periodLabel ? ` · ${periodLabel}` : ""}. Nada vira transação de verdade antes de confirmar aqui.
        </p>

        {status === "FAILED" && (
          <Card className="border-danger-500/40 bg-danger-100/10">
            <CardContent className="py-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-danger-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-onbrand/85">{errorMessage ?? "Não consegui ler este arquivo."}</p>
                <Link href="/conta" className="text-xs text-gold-400 hover:underline mt-2 inline-block">
                  Voltar para Contas
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "NEEDS_REVIEW" && items.length > 0 && (
          <form action={formAction}>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-onbrand/55">
                    {items.length} transaç{items.length === 1 ? "ão lida" : "ões lidas"}
                    {duplicateCount > 0 ? ` · ${duplicateCount} possível${duplicateCount > 1 ? "eis" : ""} duplicata${duplicateCount > 1 ? "s" : ""}` : ""}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-gold-400 hover:underline"
                    onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                  >
                    {allSelected ? "Desmarcar todas" : "Marcar todas"}
                  </button>
                </div>

                <div className="divide-y divide-white/10">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`py-2.5 ${item.isDuplicate ? "bg-warn-100/5 -mx-2 px-2 rounded-lg" : ""}`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="itemId"
                          value={item.id}
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="h-4 w-4 rounded accent-gold-400 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-onbrand truncate flex items-center gap-1.5">
                            {item.description}
                            {item.installmentTotal && item.installmentTotal > 1 && (
                              <span className="text-[10px] font-semibold text-onbrand/55 shrink-0">
                                {item.installmentNumber}/{item.installmentTotal}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-onbrand/50 flex items-center gap-1.5">
                            {new Date(item.date).toLocaleDateString("pt-BR")}
                            {!item.suggestedCategoryId && item.categoryGuess && <span>· {item.categoryGuess}</span>}
                            {item.isDuplicate && (
                              <span className="text-warn-600 font-semibold">⚠ parece duplicada</span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-medium tabular-nums shrink-0 ${item.type === "INCOME" ? "text-ok-400" : "text-onbrand/85"}`}
                        >
                          {item.type === "INCOME" ? "+" : "-"}
                          {formatBRL(item.amount)}
                        </span>
                      </label>

                      {/* Categoria + "sempre categorizar assim" só faz sentido pra gasto
                          (INCOME/aporte não têm categoria própria no app, mesma regra do
                          Lançamentos). Isso é o que faltava pra dar pra corrigir um palpite
                          errado da IA ANTES de confirmar, e pra ensinar o Tobias sobre um
                          gasto fixo mensal (ex: "quinto andar" -> Moradia) que aparece em
                          todo extrato com uma descrição levemente diferente. */}
                      {item.type === "EXPENSE" && (
                        <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
                          <select
                            name={`category_${item.id}`}
                            value={categoryByItem[item.id] ?? ""}
                            onChange={(e) => setCategoryByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="text-xs rounded-lg border border-black/20 bg-brand-900 text-onbrand px-2 py-1.5"
                          >
                            <option value="">Sem categoria</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <label className="flex items-center gap-1.5 text-xs text-onbrand/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.id in always}
                              onChange={() => toggleAlways(item)}
                              className="h-3.5 w-3.5 rounded accent-gold-400"
                            />
                            <Repeat className="h-3 w-3 shrink-0" /> Categorizar assim sempre
                          </label>

                          {item.id in always && (
                            <div className="w-full pl-0">
                              <input
                                type="text"
                                name={`keyword_${item.id}`}
                                value={always[item.id] ?? ""}
                                onChange={(e) => setAlways((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder='Trecho que se repete, ex: "quinto andar"'
                                className="text-xs rounded-lg border border-black/20 bg-brand-900 text-onbrand px-2 py-1.5 w-full min-w-[160px]"
                              />
                              <p className="text-[11px] text-onbrand/45 mt-1">
                                Apague a data/número e deixe só a parte fixa da descrição. Qualquer
                                transação (deste extrato ou de um futuro) com esse trecho vai
                                cair direto em <b>{categories.find((c) => c.id === categoryByItem[item.id])?.name ?? "categoria selecionada"}</b>.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10 flex-wrap">
                  <span className="text-xs text-onbrand/55">{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
                  <Button type="submit" loading={pending} disabled={selected.size === 0}>
                    {pending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      `Confirmar ${selected.size} transaç${selected.size === 1 ? "ão" : "ões"}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <FieldError>{state?.error}</FieldError>
          </form>
        )}

        <Link href="/conta" className="text-xs text-onbrand/45 hover:text-onbrand/70 mt-5 inline-block">
          ← Cancelar e voltar para Contas
        </Link>
      </div>
    </div>
  );
}
