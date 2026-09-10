"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { createTransactionAction, updateCategoryAction, deleteTransactionAction, type ExpenseFormState } from "./actions";

type Category = { id: string; name: string; type: string };
type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: string;
  description: string;
  merchant: string | null;
  paymentMethod: string | null;
  categoryId: string | null;
  categoryName: string | null;
  source: string;
  confidence: number;
  installmentNumber: number | null;
  installmentTotal: number | null;
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  PIX: "Pix",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  OTHER: "Outro",
};

export function ExpensesClient({ transactions, categories }: { transactions: Transaction[]; categories: Category[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(createTransactionAction, undefined);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  useEffect(() => {
    if (state?.success) setShowForm(false);
  }, [state]);

  return (
    <div className="flex-1 px-5 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-brand-950">Seus gastos</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo gasto
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form action={formAction} className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Data</Label>
                <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
              <div>
                <Label htmlFor="amount">Valor total (R$)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0,00" required />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" name="description" placeholder="Ex: Mercado, Uber, Aluguel..." required />
              </div>
              <div>
                <Label htmlFor="merchant">Estabelecimento (opcional)</Label>
                <Input id="merchant" name="merchant" placeholder="Ex: Pão de Açúcar" />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select id="type" name="type" defaultValue="EXPENSE">
                  <option value="EXPENSE">Gasto</option>
                  <option value="INCOME">Receita</option>
                  <option value="INVESTMENT_CONTRIBUTION">Investimento</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="categoryId">Categoria</Label>
                <Select id="categoryId" name="categoryId" defaultValue="">
                  <option value="">Deixar o Tobias categorizar</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentMethod">Forma de pagamento</Label>
                <Select id="paymentMethod" name="paymentMethod" defaultValue="">
                  <option value="">Não informar</option>
                  {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="installmentTotal">Parcelas</Label>
                <Input id="installmentTotal" name="installmentTotal" type="number" min="1" max="48" defaultValue="1" />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar gasto
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {transactions.length === 0 ? (
        <p className="text-ink-500 text-sm py-12 text-center">
          Nenhum gasto registrado este mês ainda. Adicione um gasto ou conte pro Tobias no chat.
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} categories={expenseCategories} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TransactionRow({ transaction, categories }: { transaction: Transaction; categories: Category[] }) {
  const [pending, startTransition] = useTransition();
  const isIncome = transaction.type === "INCOME";
  const lowConfidence = transaction.categoryId && transaction.confidence < 0.7;

  return (
    <li>
      <Card>
        <CardContent className="py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-ink-900 truncate">{transaction.description}</p>
              {transaction.installmentTotal && transaction.installmentTotal > 1 && (
                <Badge tone="neutral">
                  {transaction.installmentNumber}/{transaction.installmentTotal}
                </Badge>
              )}
              {lowConfidence && (
                <Badge tone="warn" title="Categoria sugerida com baixa confiança, confira">
                  <Sparkles className="h-3 w-3" /> confirmar
                </Badge>
              )}
            </div>
            <p className="text-xs text-ink-500">
              {new Date(transaction.date).toLocaleDateString("pt-BR")}
              {transaction.merchant ? ` · ${transaction.merchant}` : ""}
              {transaction.paymentMethod ? ` · ${PAYMENT_LABELS[transaction.paymentMethod]}` : ""}
            </p>
          </div>

          {!isIncome && (
            <select
              className="text-xs rounded-lg border border-ink-300/50 bg-cream-50 px-2 py-1.5 max-w-[130px]"
              value={transaction.categoryId ?? ""}
              disabled={pending}
              onChange={(e) => {
                const categoryId = e.target.value;
                if (!categoryId) return;
                startTransition(() => updateCategoryAction(transaction.id, categoryId));
              }}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <span className={`font-medium tabular-nums ${isIncome ? "text-ok-600" : "text-ink-900"}`}>
            {isIncome ? "+" : "-"}
            {formatBRL(transaction.amount)}
          </span>

          <button
            aria-label="Excluir"
            className="text-ink-300 hover:text-danger-600 transition-colors"
            onClick={() => startTransition(() => deleteTransactionAction(transaction.id))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </li>
  );
}
