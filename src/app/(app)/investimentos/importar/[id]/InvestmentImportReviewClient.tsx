"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Input";
import { formatBRL } from "@/lib/utils/money";
import { confirmInvestmentStatementImportAction, type ConfirmInvestmentImportState } from "../../actions";

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  FUNDS: "Fundos",
  STOCKS: "Ações",
  ETF: "ETF",
  REIT: "Fundos imobiliários",
  PENSION: "Previdência",
  TREASURY: "Tesouro Direto",
  OTHER: "Outro",
};

type ExistingInvestment = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  type: string;
  investedAmount: number | null;
  currentAmount: number;
  institution: string | null;
  liquidity: string | null;
  matchedInvestmentId: string | null;
  isSelected: boolean;
};

export function InvestmentImportReviewClient({
  documentId,
  status,
  errorMessage,
  targetLabel,
  existingInvestments,
  items,
}: {
  documentId: string;
  status: string;
  errorMessage: string | null;
  targetLabel: string;
  existingInvestments: ExistingInvestment[];
  items: Item[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((i) => i.isSelected).map((i) => i.id)));
  // Pra cada linha, qual investimento existente ela deve ATUALIZAR — "" quer
  // dizer "criar um investimento novo". Pré-preenchido com o palpite
  // automático (mesma corretora + nome parecido) vindo do servidor, editável
  // aqui antes de confirmar.
  const [matchByItem, setMatchByItem] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.matchedInvestmentId ?? ""]))
  );
  const boundAction = confirmInvestmentStatementImportAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<ConfirmInvestmentImportState, FormData>(boundAction, undefined);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const updateCount = [...selected].filter((id) => matchByItem[id]).length;
  const createCount = selected.size - updateCount;

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-lg mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Confira antes de confirmar</h1>
        <p className="text-sm text-onbrand/55 mb-5">
          Extrato consolidado de <b className="text-onbrand/80">{targetLabel}</b>. Nada vira investimento de verdade
          antes de confirmar aqui.
        </p>

        {status === "FAILED" && (
          <Card className="border-danger-500/40 bg-danger-100/10">
            <CardContent className="py-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-danger-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-onbrand/85">{errorMessage ?? "Não consegui ler este arquivo."}</p>
                <Link href="/investimentos" className="text-xs text-gold-400 hover:underline mt-2 inline-block">
                  Voltar para Investimentos
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
                    {items.length} ativo{items.length === 1 ? "" : "s"} lido{items.length === 1 ? "" : "s"}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-gold-400 hover:underline"
                    onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                  >
                    {allSelected ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                </div>

                <div className="divide-y divide-onbrand/[0.06]">
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
                          <p className="text-sm text-onbrand truncate">{item.name}</p>
                          <p className="text-xs text-onbrand/50">
                            {INVESTMENT_TYPE_LABELS[item.type] ?? item.type}
                            {item.institution ? ` · ${item.institution}` : ""}
                            {item.liquidity ? ` · ${item.liquidity}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-onbrand shrink-0">
                          {formatBRL(item.currentAmount)}
                        </span>
                      </label>

                      <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
                        <select
                          name={`match_${item.id}`}
                          value={matchByItem[item.id] ?? ""}
                          onChange={(e) => setMatchByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="text-xs rounded-lg border border-black/20 bg-brand-900 text-onbrand px-2 py-1.5"
                        >
                          <option value="">Criar como novo investimento</option>
                          {existingInvestments.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              Atualizar valor de: {inv.name}
                            </option>
                          ))}
                        </select>
                        {item.matchedInvestmentId && matchByItem[item.id] === item.matchedInvestmentId && (
                          <span className="text-[11px] text-onbrand/45">match automático, pode trocar</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-onbrand/[0.06] flex-wrap">
                  <span className="text-xs text-onbrand/55">
                    {selected.size} selecionado{selected.size === 1 ? "" : "s"}
                    {selected.size > 0 && ` (${createCount} novo${createCount === 1 ? "" : "s"}, ${updateCount} atualizaç${updateCount === 1 ? "ão" : "ões"})`}
                  </span>
                  <Button type="submit" loading={pending} disabled={selected.size === 0}>
                    {pending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      `Confirmar ${selected.size} ativo${selected.size === 1 ? "" : "s"}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <FieldError>{state?.error}</FieldError>
          </form>
        )}

        <Link href="/investimentos" className="text-xs text-onbrand/45 hover:text-onbrand/70 mt-5 inline-block">
          ← Cancelar e voltar para Investimentos
        </Link>
      </div>
    </div>
  );
}
