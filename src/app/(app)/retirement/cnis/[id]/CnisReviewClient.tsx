"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { formatBRL } from "@/lib/utils/money";
import { confirmCnisImportAction, type ConfirmCnisState } from "../../actions";

type Item = {
  id: string;
  competencia: string;
  employerName: string | null;
  salaryAmount: number;
  isSelected: boolean;
};

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

export function CnisReviewClient({
  documentId,
  status,
  errorMessage,
  items,
}: {
  documentId: string;
  status: string;
  errorMessage: string | null;
  items: Item[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((i) => i.isSelected).map((i) => i.id)));
  // Editável antes de confirmar: uma linha lida errado pela IA (ex.: "R$
  // 1.800,00" virou "18.000,00") é mais rápido de corrigir aqui do que
  // desmarcar e perder aquela competência inteira da média.
  const [amountByItem, setAmountByItem] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.salaryAmount]))
  );
  const boundAction = confirmCnisImportAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<ConfirmCnisState, FormData>(boundAction, undefined);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  const periodLabel = useMemo(() => {
    if (items.length === 0) return null;
    const first = MONTH_LABEL.format(new Date(items[0].competencia));
    const last = MONTH_LABEL.format(new Date(items[items.length - 1].competencia));
    return first === last ? first : `${first} – ${last}`;
  }, [items]);

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-lg mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Confira antes de confirmar</h1>
        <p className="text-sm text-onbrand/55 mb-2">
          Extrato do CNIS{periodLabel ? ` · ${periodLabel}` : ""}. Nada substitui seu histórico salarial antes de confirmar aqui.
        </p>
        <p className="text-xs text-gold-400/90 mb-5 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Confirmar substitui todo o histórico salarial que já existir por este, do zero (o Extrato do CNIS já é o
          histórico completo, então uma reimportação não deve se somar a uma antiga).
        </p>

        {status === "FAILED" && (
          <Card className="border-danger-500/40 bg-danger-100/10">
            <CardContent className="py-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-danger-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-onbrand/85">{errorMessage ?? "Não consegui ler este arquivo."}</p>
                <Link href="/retirement" className="text-xs text-gold-400 hover:underline mt-2 inline-block">
                  Voltar para Aposentadoria
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
                    {items.length} competência{items.length === 1 ? "" : "s"} lida{items.length === 1 ? "" : "s"}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-gold-400 hover:underline"
                    onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                  >
                    {allSelected ? "Desmarcar todas" : "Marcar todas"}
                  </button>
                </div>

                <div className="divide-y divide-onbrand/[0.06] max-h-[55vh] overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="py-2.5">
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
                          <p className="text-sm text-onbrand capitalize">{MONTH_LABEL.format(new Date(item.competencia))}</p>
                          {item.employerName && <p className="text-xs text-onbrand/50 truncate">{item.employerName}</p>}
                        </div>
                        <div className="w-32 shrink-0" onClick={(e) => e.preventDefault()}>
                          <CurrencyInput
                            name={`amount_${item.id}`}
                            defaultValue={amountByItem[item.id] ?? item.salaryAmount}
                            onValueChange={(v) => setAmountByItem((prev) => ({ ...prev, [item.id]: v }))}
                          />
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-onbrand/[0.06] flex-wrap">
                  <span className="text-xs text-onbrand/55">
                    {selected.size} selecionada{selected.size === 1 ? "" : "s"} · média bruta{" "}
                    {formatBRL(
                      items.filter((i) => selected.has(i.id)).reduce((sum, i) => sum + (amountByItem[i.id] ?? i.salaryAmount), 0) /
                        Math.max(1, selected.size)
                    )}
                    /mês (sem correção pelo INPC ainda)
                  </span>
                  <Button type="submit" loading={pending} disabled={selected.size === 0}>
                    {pending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      `Confirmar ${selected.size} competência${selected.size === 1 ? "" : "s"}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <FieldError>{state?.error}</FieldError>
          </form>
        )}

        <Link href="/retirement" className="text-xs text-onbrand/45 hover:text-onbrand/70 mt-5 inline-block">
          ← Cancelar e voltar para Aposentadoria
        </Link>
      </div>
    </div>
  );
}
