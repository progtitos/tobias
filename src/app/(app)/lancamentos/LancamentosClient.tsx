"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
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
  Search,
  Merge,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BankBadge } from "@/components/ui/BankBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  createTransactionAction,
  updateTransactionAction,
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
  bankAccountBankName: string | null;
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
type Filters = { q: string; conta: string; tipo: string; categoria: string };

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

// Uma única função pra montar a URL de /lancamentos a partir do mês + filtros
// — usada tanto pelas setas de mês quanto pela barra de busca/filtros, pra
// nenhuma das duas derrubar o que a outra já tinha selecionado.
function buildLancamentosUrl(month: string, filters: Partial<Filters> & { month?: never }): string {
  const params = new URLSearchParams();
  params.set("month", month);
  if (filters.q) params.set("q", filters.q);
  if (filters.conta) params.set("conta", filters.conta);
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.categoria) params.set("categoria", filters.categoria);
  return `/lancamentos?${params.toString()}`;
}

export function LancamentosClient({
  month,
  filters,
  transactions,
  categories,
  goals,
  accounts,
  budgets,
  totalLimit,
  totalActual,
}: {
  month: string;
  filters: Filters;
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
          <h1 className="font-sans font-bold text-2xl text-onbrand">Transações</h1>
          <div className="flex items-center gap-1">
            <Link
              href={buildLancamentosUrl(shiftMonth(month, -1), filters)}
              className="p-1.5 rounded-lg text-onbrand/55 hover:bg-white/5 hover:text-onbrand"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-medium text-onbrand capitalize min-w-[140px] text-center">
              {monthLabel}
            </span>
            <Link
              href={buildLancamentosUrl(shiftMonth(month, 1), filters)}
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
          <TransactionsTab
            month={month}
            filters={filters}
            transactions={transactions}
            categories={categories}
            goals={goals}
            accounts={accounts}
          />
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
  month,
  filters,
  transactions,
  categories,
  goals,
  accounts,
}: {
  month: string;
  filters: Filters;
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const hasFilters = Boolean(filters.q || filters.conta || filters.tipo || filters.categoria);

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setShowMerge(true)}>
          <Merge className="h-4 w-4" /> Mesclar duplicadas
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditingTransaction(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus className="h-4 w-4" /> Nova transação
        </Button>
      </div>

      <FilterBar month={month} filters={filters} accounts={accounts} categories={categories} />

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <NewTransactionForm
              categories={expenseCategories}
              goals={goals}
              accounts={accounts}
              onDone={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          categories={expenseCategories}
          goals={goals}
          accounts={accounts}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {showMerge && <MergeDuplicatesModal transactions={transactions} onClose={() => setShowMerge(false)} />}

      {transactions.length === 0 ? (
        <p className="text-onbrand/55 text-sm py-12 text-center">
          {hasFilters
            ? "Nenhuma transação encontrada com esses filtros neste mês."
            : "Nenhuma transação registrada neste mês ainda. Adicione uma ou conte pro Tobias no chat."}
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              categories={expenseCategories}
              onEdit={() => {
                setShowForm(false);
                setEditingTransaction(t);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Busca + filtros — recarrega a lista via URL (server-side), não filtra no
// navegador, pra sempre bater com o que uma nova consulta traria.
// ---------------------------------------------------------------------------

function FilterBar({
  month,
  filters,
  accounts,
  categories,
}: {
  month: string;
  filters: Filters;
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();

  function go(next: Partial<Filters>) {
    router.push(buildLancamentosUrl(month, { ...filters, ...next }));
  }

  function commitSearch(value: string) {
    if (value !== filters.q) go({ q: value });
  }

  return (
    <Card className="mb-3">
      <CardContent className="py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-onbrand/40 pointer-events-none" />
          {/* Não-controlado (defaultValue), remontado via `key` quando o
              filtro muda por fora (navegação de mês, por exemplo) — evita
              precisar de um useEffect só pra sincronizar estado derivado de
              props, que o React recomenda evitar. */}
          <Input
            key={filters.q}
            className="pl-9"
            placeholder="Buscar por descrição ou estabelecimento..."
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch(e.currentTarget.value);
            }}
            onBlur={(e) => commitSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            className="w-auto min-w-[140px]"
            value={filters.conta}
            onChange={(e) => go({ conta: e.target.value })}
          >
            <option value="">Conta: Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select className="w-auto min-w-[140px]" value={filters.tipo} onChange={(e) => go({ tipo: e.target.value })}>
            <option value="">Tipo: Todos</option>
            {Object.entries(TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto min-w-[140px]"
            value={filters.categoria}
            onChange={(e) => go({ categoria: e.target.value })}
          >
            <option value="">Categoria: Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Formulário de transação — campos compartilhados entre "Nova transação" e a
// edição pela linha. A edição não mostra "Parcelas": ela muda a linha que já
// existe, nunca a recria como um grupo parcelado novo.
// ---------------------------------------------------------------------------

function TransactionFields({
  type,
  setType,
  categories,
  goals,
  accounts,
  defaults,
  showInstallments,
}: {
  type: string;
  setType: (t: string) => void;
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  defaults?: Partial<Transaction>;
  showInstallments: boolean;
}) {
  const [paymentMethod, setPaymentMethod] = useState(defaults?.paymentMethod ?? "");
  const [amount, setAmount] = useState(defaults?.amount ?? 0);
  // "Parcelas" (cartão de crédito) e "gasto fixo mensal" (qualquer outra
  // forma de pagamento) usam o mesmo campo installmentTotal por trás — só um
  // dos dois blocos abaixo fica montado por vez, então nunca colidem.
  const [installments, setInstallments] = useState(2);
  const [fixedExpense, setFixedExpense] = useState(false);
  const [fixedMonths, setFixedMonths] = useState(2);
  const isCreditCard = paymentMethod === "CREDIT_CARD";

  const amountLabel = !showInstallments
    ? "Valor (R$)"
    : isCreditCard
      ? "Valor total da compra (R$)"
      : fixedExpense
        ? "Valor mensal (R$)"
        : "Valor (R$)";

  return (
    <>
      <div>
        <Label htmlFor="date">Data</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={defaults?.date ? defaults.date.slice(0, 10) : new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <Label htmlFor="amount">{amountLabel}</Label>
        <CurrencyInput id="amount" name="amount" defaultValue={defaults?.amount} onValueChange={setAmount} required />
      </div>
      <div className="col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          name="description"
          placeholder="Ex: Mercado, Uber, Aluguel..."
          defaultValue={defaults?.description ?? undefined}
          required
        />
      </div>
      <div>
        <Label htmlFor="merchant">Estabelecimento (opcional)</Label>
        <Input id="merchant" name="merchant" placeholder="Ex: Pão de Açúcar" defaultValue={defaults?.merchant ?? undefined} />
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
          <Select id="categoryId" name="categoryId" defaultValue={defaults?.categoryId ?? ""}>
            <option value="">Deixar o Tobias categorizar</option>
            {categories.map((c) => (
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
          <Select id="goalId" name="goalId" defaultValue={defaults?.goalId ?? ""}>
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
        <Select
          id="paymentMethod"
          name="paymentMethod"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="">Não informar</option>
          {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {showInstallments &&
        (isCreditCard ? (
          <div>
            <Label htmlFor="installmentTotal">Parcelas</Label>
            <Input
              id="installmentTotal"
              name="installmentTotal"
              type="number"
              min="1"
              max="48"
              value={installments}
              onChange={(e) => setInstallments(Math.max(1, Number(e.target.value) || 1))}
            />
            {installments > 1 && amount > 0 && (
              <p className="text-xs text-onbrand/50 mt-1.5">
                {installments}x de {formatBRL(amount / installments)}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="flex items-center gap-2 h-11 text-sm text-onbrand/80 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-gold-400"
                checked={fixedExpense}
                onChange={(e) => setFixedExpense(e.target.checked)}
              />
              Gasto fixo mensal
            </label>
            {fixedExpense && (
              <>
                <Input
                  id="installmentTotal"
                  name="installmentTotal"
                  type="number"
                  min="2"
                  max="48"
                  value={fixedMonths}
                  onChange={(e) => setFixedMonths(Math.max(2, Number(e.target.value) || 2))}
                  placeholder="Por quantos meses"
                />
                <p className="text-xs text-onbrand/50 mt-1.5">
                  Lança {amount > 0 ? formatBRL(amount) : "esse valor"} todo mês, por {fixedMonths} meses seguidos a
                  partir desta data.
                </p>
              </>
            )}
          </div>
        ))}
      <div className={showInstallments ? "col-span-2" : ""}>
        <Label htmlFor="bankAccountId">Conta (opcional)</Label>
        <Select id="bankAccountId" name="bankAccountId" defaultValue={defaults?.bankAccountId ?? ""}>
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
    </>
  );
}

function NewTransactionForm({
  categories,
  goals,
  accounts,
  onDone,
}: {
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  onDone: () => void;
}) {
  const [type, setType] = useState("EXPENSE");
  const [state, formAction, pending] = useActionState<LancamentosFormState, FormData>(createTransactionAction, undefined);

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <TransactionFields
        type={type}
        setType={setType}
        categories={categories}
        goals={goals}
        accounts={accounts}
        showInstallments
      />
      <div className="col-span-2">
        <FieldError>{state?.error}</FieldError>
        <div className="flex gap-2 mt-1">
          <Button type="submit" loading={pending}>
            Salvar transação
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

function EditTransactionModal({
  transaction,
  categories,
  goals,
  accounts,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  onClose: () => void;
}) {
  const [type, setType] = useState(transaction.type);
  const [state, formAction, pending] = useActionState<LancamentosFormState, FormData>(updateTransactionAction, undefined);

  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-semibold text-lg text-onbrand">Editar transação</h3>
            <button className="text-onbrand/40 hover:text-onbrand/70" onClick={onClose} aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <input type="hidden" name="id" value={transaction.id} />
            <TransactionFields
              type={type}
              setType={setType}
              categories={categories}
              goals={goals}
              accounts={accounts}
              defaults={transaction}
              showInstallments={false}
            />
            <div className="col-span-2">
              <FieldError>{state?.error}</FieldError>
              <div className="flex gap-2 mt-1">
                <Button type="submit" loading={pending}>
                  Salvar alterações
                </Button>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mesclar duplicadas — checa o mês visível (mesma data, valor e descrição
// parecida) e deixa você decidir manter ou descartar cada suspeita, em vez de
// apagar automaticamente (o Tobias pode estar errado).
// ---------------------------------------------------------------------------

function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findDuplicateGroups(transactions: Transaction[]): Transaction[][] {
  const groups: Transaction[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    if (used.has(transactions[i].id)) continue;
    const group = [transactions[i]];
    const dayA = transactions[i].date.slice(0, 10);
    const descA = normalizeForCompare(transactions[i].description);

    for (let j = i + 1; j < transactions.length; j++) {
      if (used.has(transactions[j].id)) continue;
      const sameDay = transactions[j].date.slice(0, 10) === dayA;
      const sameAmount = transactions[j].amount === transactions[i].amount;
      const sameType = transactions[j].type === transactions[i].type;
      const similarDesc = normalizeForCompare(transactions[j].description) === descA;
      if (sameDay && sameAmount && sameType && similarDesc) {
        group.push(transactions[j]);
        used.add(transactions[j].id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
      used.add(transactions[i].id);
    }
  }

  return groups;
}

function MergeDuplicatesModal({ transactions, onClose }: { transactions: Transaction[]; onClose: () => void }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const groups = useMemo(
    () => findDuplicateGroups(transactions).filter((g) => !dismissed.has(g[0].id)),
    [transactions, dismissed]
  );

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-sans font-semibold text-lg text-onbrand">Mesclar duplicadas</h3>
            <button className="text-onbrand/40 hover:text-onbrand/70" onClick={onClose} aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-onbrand/55 mb-4">
            Mesma data, valor e descrição parecida no mês visível — confira antes de excluir, o Tobias pode estar
            errado.
          </p>

          {groups.length === 0 ? (
            <p className="text-sm text-onbrand/55 py-8 text-center">Nenhuma duplicata encontrada neste mês. 🎉</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group[0].id} className="rounded-xl border border-white/10 p-3">
                  <div className="space-y-2 mb-2">
                    {group.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-onbrand truncate">{t.description}</p>
                          <p className="text-xs text-onbrand/50">
                            {new Date(t.date).toLocaleDateString("pt-BR")} · {formatBRL(t.amount)}
                            {t.merchant ? ` · ${t.merchant}` : ""}
                          </p>
                        </div>
                        <button
                          className="text-onbrand/40 hover:text-danger-300 shrink-0"
                          title="Excluir esta"
                          disabled={pending}
                          onClick={() => startTransition(() => deleteTransactionAction(t.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissed((prev) => new Set(prev).add(group[0].id))}
                  >
                    Manter as duas
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionRow({
  transaction,
  categories,
  onEdit,
}: {
  transaction: Transaction;
  categories: Category[];
  onEdit: () => void;
}) {
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
      <Card className="cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={onEdit} title="Clique pra editar">
        {/* 4-track grid: icon | main (1fr) | selo do banco + categoria juntos
            (auto) | valor + excluir (largura fixa). O seletor de categoria
            ficava sozinho lá na ponta direita, longe do selo do banco, com um
            vão vazio enorme entre os dois — visualmente esquisito. Juntando
            os dois no mesmo grupo (o selo já diz de qual conta veio a
            transação, a categoria diz pra onde ela foi) o olho lê os dois
            junto, e sobra só valor/excluir isolados na ponta, que é o par que
            faz sentido ficar sempre no mesmo lugar em toda linha. */}
        <CardContent className="py-3.5 grid grid-cols-[20px_1fr_auto_auto] items-center gap-x-3">
          <Icon className={`col-start-1 h-5 w-5 shrink-0 ${meta.amountClass}`} aria-hidden />

          <div className="col-start-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-onbrand truncate">{transaction.description}</p>
              {transaction.installmentTotal && transaction.installmentTotal > 1 && (
                <Badge tone="neutral">
                  {transaction.installmentNumber}/{transaction.installmentTotal}
                </Badge>
              )}
              {transaction.goalTitle && <Badge tone="gold">→ {transaction.goalTitle}</Badge>}
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

          <div className="col-start-3 flex items-center gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {transaction.bankAccountName &&
              (transaction.bankAccountBankName ? (
                <>
                  <BankBadge bankName={transaction.bankAccountBankName} />
                  <span className="text-xs font-medium text-onbrand/75">{transaction.bankAccountBankName}</span>
                </>
              ) : (
                <Badge tone="neutral" className="whitespace-nowrap">
                  {transaction.bankAccountName}
                </Badge>
              ))}

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
          </div>

          <div className="col-start-4 flex items-center gap-3 justify-self-end" onClick={(e) => e.stopPropagation()}>
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
          </div>
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
  const [newLimit, setNewLimit] = useState(budget.limitAmount);
  const [pending, startTransition] = useTransition();
  const pct = Math.round(budget.pctUsed * 100);

  function save() {
    if (newLimit >= 0) {
      startTransition(async () => {
        await updateBudgetLimitAction(budget.id, newLimit);
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
              <CurrencyInput
                autoFocus
                defaultValue={budget.limitAmount}
                onValueChange={setNewLimit}
                className="h-8 w-28 text-sm"
              />
              <button className="text-ok-400 disabled:opacity-50" disabled={pending} onClick={save} title="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button
                className="text-onbrand/40"
                onClick={() => {
                  setEditing(false);
                  setNewLimit(budget.limitAmount);
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
