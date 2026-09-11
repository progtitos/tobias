"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Sparkles,
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Receipt,
  PieChart,
  RefreshCw,
  Pencil,
  Check,
  X,
  Home,
  Utensils,
  Car,
  HeartPulse,
  GraduationCap,
  PartyPopper,
  Plane,
  ShoppingBag,
  Users,
  Baby,
  Shield,
  Repeat,
  CreditCard,
  HandHeart,
  Briefcase,
  MoreHorizontal,
  TrendingUp,
  Wallet,
  Laptop,
  Key,
  LineChart,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  createTransactionAction,
  updateCategoryAction,
  deleteTransactionAction,
  recalculateBudgetAction,
  updateBudgetLimitAction,
  type LancamentosFormState,
} from "./actions";

type Category = { id: string; name: string; type: string; icon: string | null };
type Goal = { id: string; title: string };
type Account = { id: string; name: string; bankName: string | null };
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
  categoryIcon: string | null;
  source: string;
  confidence: number;
  installmentNumber: number | null;
  installmentTotal: number | null;
  goalId: string | null;
  goalTitle: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
};
type BudgetRow = {
  id: string;
  categoryId: string | null;
  label: string;
  limitAmount: number;
  isAutoCalculated: boolean;
  actual: number;
  pctUsed: number;
  isOverrun: boolean;
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

// Um só idioma visual pra direção do dinheiro, reaproveitado no seletor de
// tipo do formulário e em cada linha: entrada (verde), saída (o tom padrão
// do texto, sem soar como alerta), aporte (dourado, ligado ao objetivo) e
// transferência (neutro) — dá pra escanear a lista sem ler o valor.
const TYPE_META: Record<string, { label: string; icon: LucideIcon; amountClass: string; sign: string }> = {
  INCOME: { label: "Receita", icon: ArrowDownCircle, amountClass: "text-ok-400", sign: "+" },
  EXPENSE: { label: "Gasto", icon: ArrowUpCircle, amountClass: "text-onbrand/85", sign: "−" },
  INVESTMENT_CONTRIBUTION: { label: "Investimento", icon: PiggyBank, amountClass: "text-gold-400", sign: "+" },
  TRANSFER: { label: "Transferência", icon: ArrowLeftRight, amountClass: "text-onbrand/55", sign: "" },
};

// Mesmos ícones plantados em seedCategories.ts, um por categoria — assim uma
// linha de "Alimentação" mostra um talher, não a mesma setinha genérica de
// todo gasto. Categoria sem ícone (ou uma criada pelo usuário) cai no Tag.
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "party-popper": PartyPopper,
  plane: Plane,
  "shopping-bag": ShoppingBag,
  users: Users,
  baby: Baby,
  receipt: Receipt,
  shield: Shield,
  repeat: Repeat,
  "credit-card": CreditCard,
  "hand-heart": HandHeart,
  briefcase: Briefcase,
  "more-horizontal": MoreHorizontal,
  "trending-up": TrendingUp,
  wallet: Wallet,
  laptop: Laptop,
  key: Key,
  "line-chart": LineChart,
};

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function LancamentosClient({
  month,
  transactions,
  categories,
  goals,
  accounts,
  budgets,
  totalLimit,
  totalActual,
}: {
  month: string;
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  budgets: BudgetRow[];
  totalLimit: number;
  totalActual: number;
}) {
  const [tab, setTab] = useState<"transacoes" | "orcamento">("transacoes");
  const [year, monthNum] = month.split("-").map(Number);
  const monthLabel = MONTH_LABEL.format(new Date(year, monthNum - 1, 1));
  const isCurrentMonth = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === monthNum - 1;
  })();

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-sans font-bold text-2xl text-onbrand">Lançamentos</h1>
          <div className="flex items-center gap-1">
            <Link
              href={`/lancamentos?month=${shiftMonth(month, -1)}`}
              className="p-1.5 rounded-lg text-onbrand/55 hover:bg-white/5 hover:text-onbrand"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-medium text-onbrand capitalize min-w-[140px] text-center">
              {monthLabel}
            </span>
            <Link
              href={`/lancamentos?month=${shiftMonth(month, 1)}`}
              className={cn(
                "p-1.5 rounded-lg hover:bg-white/5",
                isCurrentMonth ? "text-onbrand/20 pointer-events-none" : "text-onbrand/55 hover:text-onbrand"
              )}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Card className="mb-5">
          <CardContent className="py-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-onbrand/70">Total do mês</span>
              <span className="font-medium text-onbrand">
                {formatBRL(totalActual)}
                {totalLimit > 0 ? ` de ${formatBRL(totalLimit)} (${Math.round((totalActual / totalLimit) * 100)}%)` : ""}
              </span>
            </div>
            {totalLimit > 0 && (
              <ProgressBar
                value={Math.min(100, Math.round((totalActual / totalLimit) * 100))}
                barClassName={totalActual > totalLimit ? "bg-danger-300" : undefined}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex gap-1 mb-5 border-b border-white/10">
          <TabButton active={tab === "transacoes"} onClick={() => setTab("transacoes")} icon={Receipt}>
            Transações
          </TabButton>
          <TabButton active={tab === "orcamento"} onClick={() => setTab("orcamento")} icon={PieChart}>
            Orçamento
          </TabButton>
        </div>

        {tab === "transacoes" ? (
          <TransactionsTab transactions={transactions} categories={categories} goals={goals} accounts={accounts} />
        ) : (
          <BudgetTab budgets={budgets} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-gold-400 text-gold-400" : "border-transparent text-onbrand/50 hover:text-onbrand/80"
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

function TransactionsTab({
  transactions,
  categories,
  goals,
  accounts,
}: {
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("EXPENSE");
  const [state, formAction, pending] = useActionState<LancamentosFormState, FormData>(createTransactionAction, undefined);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  useEffect(() => {
    if (state?.success) setShowForm(false);
  }, [state]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nova transação
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
                <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="EXPENSE">Saída (gasto)</option>
                  <option value="INCOME">Entrada (receita)</option>
                  <option value="INVESTMENT_CONTRIBUTION">Investimento / aporte</option>
                </Select>
              </div>
              {type === "EXPENSE" && (
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
              )}
              {type === "INVESTMENT_CONTRIBUTION" && (
                <div>
                  <Label htmlFor="goalId">Destino (opcional)</Label>
                  <Select id="goalId" name="goalId" defaultValue="">
                    <option value="">Não ligar a um objetivo</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
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
                <Label htmlFor="bankAccountId">Conta (opcional)</Label>
                <Select id="bankAccountId" name="bankAccountId" defaultValue="">
                  <option value="">Não afetar nenhuma conta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.bankName ? ` · ${a.bankName}` : ""}
                    </option>
                  ))}
                </Select>
                {accounts.length === 0 && (
                  <p className="text-xs text-onbrand/45 mt-1">
                    Nenhuma conta cadastrada ainda. Adicione uma em Conta para o saldo dela mudar sozinho aqui.
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar transação
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
        <p className="text-onbrand/55 text-sm py-12 text-center">
          Nenhuma transação registrada neste mês ainda. Adicione uma ou conte pro Tobias no chat.
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
  const lowConfidence = transaction.categoryId && transaction.confidence < 0.7;
  const meta = TYPE_META[transaction.type] ?? TYPE_META.EXPENSE;
  // Um gasto categorizado mostra o ícone da própria categoria (Moradia,
  // Mercado...) em vez da setinha genérica — as outras direções (receita,
  // aporte, transferência) continuam com o ícone de tipo, já que não têm
  // categoria própria.
  const categoryIcon = transaction.categoryIcon ? CATEGORY_ICON_MAP[transaction.categoryIcon] : undefined;
  const Icon = transaction.type === "EXPENSE" ? categoryIcon ?? Tag : meta.icon;

  return (
    <li>
      <Card>
        <CardContent className="py-3.5 flex items-center gap-3">
          <Icon className={`h-5 w-5 shrink-0 ${meta.amountClass}`} aria-hidden />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-onbrand truncate">{transaction.description}</p>
              {transaction.installmentTotal && transaction.installmentTotal > 1 && (
                <Badge tone="neutral">
                  {transaction.installmentNumber}/{transaction.installmentTotal}
                </Badge>
              )}
              {transaction.goalTitle && <Badge tone="gold">→ {transaction.goalTitle}</Badge>}
              {transaction.bankAccountName && <Badge tone="neutral">{transaction.bankAccountName}</Badge>}
              {lowConfidence && (
                <Badge tone="warn" title="Categoria sugerida com baixa confiança, confira">
                  <Sparkles className="h-3 w-3" /> confirmar
                </Badge>
              )}
            </div>
            <p className="text-xs text-onbrand/55">
              {new Date(transaction.date).toLocaleDateString("pt-BR")}
              {transaction.merchant ? ` · ${transaction.merchant}` : ""}
              {transaction.paymentMethod ? ` · ${PAYMENT_LABELS[transaction.paymentMethod]}` : ""}
            </p>
          </div>

          {transaction.type === "EXPENSE" && (
            <select
              className="text-xs rounded-lg border border-black/20 bg-brand-900 text-onbrand px-2 py-1.5 max-w-[130px]"
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

          <span className={`font-medium tabular-nums ${meta.amountClass}`}>
            {meta.sign}
            {formatBRL(transaction.amount)}
          </span>

          <button
            aria-label="Excluir"
            className="text-onbrand/35 hover:text-danger-300 transition-colors"
            onClick={() => startTransition(() => deleteTransactionAction(transaction.id))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------

function BudgetTab({ budgets }: { budgets: BudgetRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() => startTransition(() => recalculateBudgetAction())}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recalcular automaticamente
        </Button>
      </div>

      {budgets.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-12 text-center">
          Ainda não há um orçamento sugerido. Conte pro Tobias sua renda no chat para ele montar um guia inicial.
        </p>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => (
            <BudgetRowCard key={b.id} budget={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetRowCard({ budget }: { budget: BudgetRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget.limitAmount));
  const [pending, startTransition] = useTransition();
  const pct = Math.round(budget.pctUsed * 100);

  function save() {
    const amount = Number(value);
    if (amount >= 0) {
      startTransition(async () => {
        await updateBudgetLimitAction(budget.id, amount);
        setEditing(false);
      });
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-onbrand">{budget.label}</p>
            {!budget.isAutoCalculated && <Badge tone="neutral">Ajustado por você</Badge>}
            {budget.isOverrun && <Badge tone="danger">Estourou</Badge>}
          </div>

          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="0.01"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 w-28 text-sm"
              />
              <button className="text-ok-400 disabled:opacity-50" disabled={pending} onClick={save} title="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button
                className="text-onbrand/40"
                onClick={() => {
                  setEditing(false);
                  setValue(String(budget.limitAmount));
                }}
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              className="text-onbrand/40 hover:text-gold-400 shrink-0"
              title="Ajustar limite"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex justify-between text-sm mb-1">
          <span className="text-onbrand/55">
            {formatBRL(budget.actual)} de {formatBRL(budget.limitAmount)}
          </span>
          <span className={budget.isOverrun ? "text-danger-300 font-medium" : "text-onbrand/70"}>{pct}%</span>
        </div>
        <ProgressBar value={Math.min(100, pct)} barClassName={budget.isOverrun ? "bg-danger-300" : undefined} />
      </CardContent>
    </Card>
  );
}
