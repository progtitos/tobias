"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { formatBRL } from "@/lib/utils/money";
import { confirmReceiptAction, type ConfirmReceiptState } from "../../actions";

// Keep in sync with LOW_CONFIDENCE_THRESHOLD in services/receipts.ts — kept
// as a literal here because that module is server-only and can't be
// imported into a Client Component.
const LOW_CONFIDENCE_THRESHOLD = 0.65;

type Item = { description: string; quantity: number; totalPrice: number; categoryGuess: string | null };

export function ConfirmReceiptClient({
  receiptId,
  receipt,
  items,
  categories,
}: {
  receiptId: string;
  receipt: { merchant: string | null; totalAmount: number | null; purchaseDate: string | null; confidence: number; imageUrls: string[] };
  items: Item[];
  categories: { id: string; name: string }[];
}) {
  const boundAction = confirmReceiptAction.bind(null, receiptId);
  const [state, formAction, pending] = useActionState<ConfirmReceiptState, FormData>(boundAction, undefined);
  const lowConfidence = receipt.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-lg mx-auto w-full">
      <h1 className="font-sans font-bold text-2xl text-cream-50 mb-1">Confirme a compra</h1>
      <p className="text-sm text-cream-50/55 mb-5">Confira os dados que o Tobias leu da nota antes de salvar.</p>

      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-xl bg-warn-100/10 border border-warn-600/40 p-3 mb-5 text-sm text-cream-50/80">
          <AlertTriangle className="h-4 w-4 text-warn-600 shrink-0 mt-0.5" />
          <span>A leitura desta nota teve confiança baixa ({Math.round(receipt.confidence * 100)}%). Revise os valores com atenção.</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="merchant">Estabelecimento</Label>
          <Input id="merchant" name="merchant" defaultValue={receipt.merchant ?? ""} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={(receipt.purchaseDate ?? new Date().toISOString()).slice(0, 10)}
              required
            />
          </div>
          <div>
            <Label htmlFor="totalAmount">Valor total (R$)</Label>
            <Input id="totalAmount" name="totalAmount" type="number" step="0.01" defaultValue={receipt.totalAmount ?? ""} required />
          </div>
        </div>
        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <Select id="categoryId" name="categoryId" defaultValue="">
            <option value="">Deixar o Tobias categorizar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {items.length > 0 && (
          <Card>
            <CardContent className="py-3">
              <p className="text-xs font-medium text-cream-50/55 mb-2">Itens identificados</p>
              <ul className="space-y-1.5">
                {items.map((it, i) => (
                  <li key={i} className="flex justify-between text-sm text-cream-50/80">
                    <span className="truncate pr-2">
                      {it.quantity > 1 ? `${it.quantity}x ` : ""}
                      {it.description}
                    </span>
                    <span className="tabular-nums shrink-0">{formatBRL(it.totalPrice)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" loading={pending}>
          Salvar gasto
        </Button>
      </form>
      </div>
    </div>
  );
}
