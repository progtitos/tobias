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
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  recalculateBudgetAction,
  updateBudgetLimitAction,
  saveRecurringRuleAction,
  type LancamentosFormState,
} from "./actions";

type Category = { id: string; name: string; type: string; icon: string | null };
type Goal = { id: string; title: string };
type Account = { id: string; name: string; bankName: string | null };
type CardOption = { id: string; nickname: string };
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
  creditCardId: string | null;
  creditCardNickname: string | null;
  cardBankName: string | null;
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
type Filters = { q: string; conta: string; cartao: string; tipo: string; categoria: string };

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
  if (filters.cartao) params.set("cartao", filters.cartao);
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
  cards,
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
  cards: CardOption[];
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
      {/* max-w-4xl (era 3xl): a linha de transação precisa de espaço pra
          descrição + banco + categoria + valor sem espremer nada — largura
          fixa nas colunas resolve alinhamento, mas não resolve espaço
          insuficiente no total. */}
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3" data-tour="lancamentos-lista">
          <h1 className="font-sans font-bold text-2xl text-onbrand">Transações</h1>
          <div className="flex items-center gap-1">
            <Link
              href={buildLancamentosUrl(shiftMonth(month, -1), filters)}
              className="p-1.5 rounded-lg text-onbrand/55 hover:bg-onbrand/5 hover:text-onbrand"
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
                "p-1.5 rounded-lg hover:bg-onbrand/5",
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

        <div className="flex gap-1 mb-5 border-b border-onbrand/[0.06]">
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
            cards={cards}
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
  cards,
}: {
  month: string;
  filters: Filters;
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  cards: CardOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const hasFilters = Boolean(filters.q || filters.conta || filters.cartao || filters.tipo || filters.categoria);

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

      <FilterBar month={month} filters={filters} accounts={accounts} cards={cards} categories={categories} />

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
        <div className="space-y-5">
          {groupByDay(transactions).map((group) => (
            <DayGroup
              key={group.dayKey}
              group={group}
              onEdit={(t) => {
                setShowForm(false);
                setEditingTransaction(t);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed agrupado por dia (redesenho aprovado, 29/09/2026) — antes cada
// transação era um Card avulso, com data repetida em toda linha e o dia sem
// nenhum resumo próprio. Agora um único painel por dia mostra o total líquido
// do dia no cabeçalho (créditos menos débitos, transferência não conta pra
// nenhum lado — é só dinheiro mudando de lugar) e cada linha vira só ícone +
// descrição + valor + seta, já que excluir/trocar categoria saíram da lista
// pra dentro do modal de editar (ver EditTransactionModal).
// ---------------------------------------------------------------------------

type DayGroupData = { dayKey: string; date: string; transactions: Transaction[] };

function groupByDay(transactions: Transaction[]): DayGroupData[] {
  const groups: DayGroupData[] = [];
  const byKey = new Map<string, DayGroupData>();
  for (const t of transactions) {
    const dayKey = t.date.slice(0, 10);
    let group = byKey.get(dayKey);
    if (!group) {
      group = { dayKey, date: t.date, transactions: [] };
      byKey.set(dayKey, group);
      groups.push(group);
    }
    group.transactions.push(t);
  }
  return groups;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(d);
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(d);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`;
}

function dayNetTotal(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === "TRANSFER") return sum;
    const sign = t.type === "EXPENSE" ? -1 : 1;
    return sum + sign * t.amount;
  }, 0);
}

function DayGroup({
  group,
  onEdit,
}: {
  group: DayGroupData;
  onEdit: (t: Transaction) => void;
}) {
  const net = dayNetTotal(group.transactions);
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-onbrand/45">{dayLabel(group.date)}</span>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            net > 0 ? "text-ok-400" : net < 0 ? "text-onbrand/60" : "text-onbrand/35"
          )}
        >
          {net > 0 ? "+" : net < 0 ? "−" : ""}
          {formatBRL(Math.abs(net))}
        </span>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-onbrand/[0.06]">
          {group.transactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} onEdit={() => onEdit(t)} />
          ))}
        </div>
      </Card>
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
  cards,
  categories,
}: {
  month: string;
  filters: Filters;
  accounts: Account[];
  cards: CardOption[];
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
          {cards.length > 0 && (
            // Uma transação de fatura de cartão não tem bankAccountId (só
            // creditCardId — ver listTransactions), então o filtro "Conta"
            // acima nunca a pega. Sem isso não tinha como isolar só os
            // gastos no crédito.
            <Select
              className="w-auto min-w-[140px]"
              value={filters.cartao}
              onChange={(e) => go({ cartao: e.target.value })}
            >
              <option value="">Cartão: Todos</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </Select>
          )}
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
  onCategoryIdChange,
}: {
  type: string;
  setType: (t: string) => void;
  categories: Category[];
  goals: Goal[];
  accounts: Account[];
  defaults?: Partial<Transaction>;
  showInstallments: boolean;
  /**
   * Só usado pelo modal de editar: precisa saber qual categoria está
   * selecionada AGORA (sem esperar o submit do form) pra habilitar a ação
   * "sempre categorizar assim" com a categoria certa. `NewTransactionForm`
   * não passa isso — o select continua funcionando normalmente pro submit
   * de qualquer forma, via `name="categoryId"`.
   */
  onCategoryIdChange?: (categoryId: string) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState(defaults?.paymentMethod ?? "");
  const [amount, setAmount] = useState(defaults?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
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
      <div className="sm:col-span-2">
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
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              onCategoryIdChange?.(e.target.value);
            }}
          >
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
      {/* Sempre largura total, não só quando showInstallments é true
          (28/09/2026): num grid de 1 coluna abaixo de sm isso não muda nada;
          a partir de sm (2 colunas), "Não afetar nenhuma conta" dentro de um
          select de meia largura era exatamente o que cortava o texto no
          modal de editar transação, que sempre passa showInstallments
          falso e por isso nunca dava a esse campo a largura toda antes. */}
      <div className="sm:col-span-2">
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
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TransactionFields
        type={type}
        setType={setType}
        categories={categories}
        goals={goals}
        accounts={accounts}
        showInstallments
      />
      <div className="sm:col-span-2">
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
  // A linha da lista não mostra mais excluir/trocar categoria direto (pedido
  // do Thiago, 29/09/2026: "mover para dentro do modal") — as duas ações e a
  // regra automática ("sempre categorizar assim") moram aqui agora.
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const [showRule, setShowRule] = useState(false);
  const [keyword, setKeyword] = useState(transaction.description);
  const [rulePending, startRuleTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function saveRule() {
    if (!categoryId || !keyword.trim()) return;
    startRuleTransition(async () => {
      const appliedCount = await saveRecurringRuleAction(keyword.trim(), categoryId, transaction.id);
      setShowRule(false);
      const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "essa categoria";
      toast.success(
        appliedCount > 0
          ? `Regra salva. ${appliedCount} transação${appliedCount > 1 ? "ões" : ""} antiga${appliedCount > 1 ? "s" : ""} também ${appliedCount > 1 ? "foram atualizadas" : "foi atualizada"} pra ${categoryName}.`
          : `Regra salva. Daqui pra frente, "${keyword.trim()}" cai direto em ${categoryName}.`
      );
    });
  }

  return (
    // `Modal` (design-system-tobias.md, seção 13) no lugar do overlay/Card
    // hand-rolled de antes (28/09/2026, pedido do Thiago: "modal de editar
    // transações precisa ser redesenhado"). Corrige três problemas visíveis:
    // 1) o overlay antigo não era um portal, então em algumas telas o
    //    conteúdo da página (título "Transações", barra de progresso) ainda
    //    aparecia por cima do backdrop; `Modal` renderiza num portal direto
    //    em `document.body`, z-50, sempre por cima de tudo.
    // 2) o grid de campos era `grid-cols-2` fixo (nunca uma só coluna), então
    //    em telas mais estreitas o select "Conta (opcional)" ficava com
    //    menos de 150px de largura e o texto "Não afetar nenhuma conta"
    //    cortava. Agora é `grid-cols-1 sm:grid-cols-2` (regra geral da seção
    //    5.4 do Design System), então abaixo de 640px cada campo ocupa a
    //    largura toda.
    // 3) ganha de graça semântica de diálogo (role="dialog", trap de foco,
    //    Esc pra fechar) que o markup manual não tinha.
    <Modal open onClose={onClose} title="Editar transação">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={transaction.id} />
        <TransactionFields
          type={type}
          setType={setType}
          categories={categories}
          goals={goals}
          accounts={accounts}
          defaults={transaction}
          showInstallments={false}
          onCategoryIdChange={setCategoryId}
        />

        {type === "EXPENSE" && (
          <div className="sm:col-span-2 -mt-1.5">
            {!showRule ? (
              <button
                type="button"
                title={categoryId ? undefined : "Escolha uma categoria primeiro"}
                disabled={!categoryId}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium transition-colors",
                  categoryId ? "text-onbrand/50 hover:text-gold-400" : "text-onbrand/25 cursor-not-allowed"
                )}
                onClick={() => setShowRule(true)}
              >
                <Repeat className="h-3.5 w-3.5" /> Sempre categorizar assim
              </button>
            ) : (
              <div className="rounded-xl bg-onbrand/[0.04] p-3">
                <p className="text-xs text-onbrand/55 mb-2">
                  Transações antigas ou futuras com este trecho na descrição caem direto nessa categoria.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder='Trecho que se repete, ex: "quinto andar"'
                    className="text-xs rounded-lg border border-transparent bg-brand-900 text-onbrand px-2 py-1.5 flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    className="text-ok-400 disabled:opacity-40 shrink-0"
                    title="Salvar regra"
                    disabled={rulePending || !keyword.trim()}
                    onClick={saveRule}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="text-onbrand/40 shrink-0"
                    title="Cancelar"
                    onClick={() => setShowRule(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <FieldError>{state?.error}</FieldError>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex gap-2">
              <Button type="submit" loading={pending}>
                Salvar alterações
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </div>
            <IconButton
              label="Excluir transação"
              tone="danger"
              disabled={deletePending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir esta transação?"
        description="Isso não pode ser desfeito."
        pending={deletePending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          startDeleteTransition(async () => {
            await deleteTransactionAction(transaction.id);
            setConfirmDelete(false);
            onClose();
          });
        }}
      />
    </Modal>
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const groups = useMemo(
    () => findDuplicateGroups(transactions).filter((g) => !dismissed.has(g[0].id)),
    [transactions, dismissed]
  );

  return (
    // Mesma migração pro `Modal` do design system aplicada ao
    // EditTransactionModal logo acima (28/09/2026) — este modal usava o
    // idêntico markup manual (overlay não-portal, `Card` avulso), então
    // herdava o mesmo problema de conteúdo da página aparecendo por cima do
    // backdrop em algumas telas. `ConfirmDialog` (que já usa `Modal` por
    // baixo) sai de dentro do overlay antigo pra um segundo `Modal` irmão —
    // os dois são portais independentes em `document.body`, então não há
    // aninhamento real de diálogo, só empilhamento visual quando ambos estão
    // abertos.
    <>
      <Modal open onClose={onClose} title="Mesclar duplicadas">
        <p className="text-xs text-onbrand/55 mb-4">
          Mesma data, valor e descrição parecida no mês visível. Confira antes de excluir, o Tobias pode estar
          errado.
        </p>

        {groups.length === 0 ? (
          <p className="text-sm text-onbrand/55 py-8 text-center">Nenhuma duplicata encontrada neste mês. 🎉</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group[0].id} className="rounded-xl bg-onbrand/[0.04] p-3">
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
                      <IconButton
                        label="Excluir esta"
                        tone="danger"
                        disabled={pending}
                        onClick={() => setConfirmDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
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
      </Modal>
      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Excluir esta transação duplicada?"
        description="Isso não pode ser desfeito."
        pending={pending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) return;
          const id = confirmDeleteId;
          startTransition(() => {
            deleteTransactionAction(id);
            setConfirmDeleteId(null);
          });
        }}
      />
    </>
  );
}

// Ícone com fundo colorido por tipo — mesma leitura rápida em créditos/
// investimentos/transferências, uma cor de destaque; gasto fica num círculo
// neutro (a variedade de categorias já é o ícone em si, uma cor por
// categoria é uma evolução futura, fora do escopo deste redesenho).
const TYPE_ICON_BG: Record<string, string> = {
  INCOME: "bg-ok-400/15 text-ok-400",
  EXPENSE: "bg-onbrand/[0.07] text-onbrand/70",
  INVESTMENT_CONTRIBUTION: "bg-gold-400/15 text-gold-400",
  TRANSFER: "bg-onbrand/[0.07] text-onbrand/50",
};

/** Pedacinhos de contexto (banco, categoria, estabelecimento, forma de
 * pagamento) juntados numa linha só, separados por "·" — só entram os que
 * existem pra essa transação, então a linha nunca fica com separadores
 * soltos. */
function TransactionSubtext({ transaction }: { transaction: Transaction }) {
  const parts: React.ReactNode[] = [];

  const bankName = transaction.bankAccountBankName ?? transaction.cardBankName ?? null;
  const accountOrCardLabel = transaction.bankAccountName ?? transaction.creditCardNickname ?? null;
  if (bankName) {
    parts.push(
      <span key="bank" className="inline-flex items-center gap-1">
        <BankBadge bankName={bankName} /> {bankName}
      </span>
    );
  } else if (accountOrCardLabel) {
    parts.push(<span key="acct">{accountOrCardLabel}</span>);
  }

  if (transaction.type === "EXPENSE") {
    parts.push(<span key="cat">{transaction.categoryName ?? "Sem categoria"}</span>);
  }
  if (transaction.merchant) parts.push(<span key="merchant">{transaction.merchant}</span>);
  if (transaction.paymentMethod) parts.push(<span key="pm">{PAYMENT_LABELS[transaction.paymentMethod]}</span>);

  if (parts.length === 0) return null;

  return (
    <p className="text-xs text-onbrand/55 flex items-center gap-1.5 flex-wrap">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-onbrand/25">·</span>}
          {part}
        </span>
      ))}
    </p>
  );
}

function TransactionRow({ transaction, onEdit }: { transaction: Transaction; onEdit: () => void }) {
  const lowConfidence = transaction.categoryId && transaction.confidence < 0.7;
  const meta = TYPE_META[transaction.type] ?? TYPE_META.EXPENSE;
  // Um gasto categorizado mostra o ícone da própria categoria (Moradia,
  // Mercado...) em vez da setinha genérica — as outras direções (receita,
  // aporte, transferência) continuam com o ícone de tipo, já que não têm
  // categoria própria.
  const categoryIcon = transaction.categoryIcon ? CATEGORY_ICON_MAP[transaction.categoryIcon] : undefined;
  const Icon = transaction.type === "EXPENSE" ? categoryIcon ?? Tag : meta.icon;

  return (
    <button
      type="button"
      onClick={onEdit}
      title="Clique pra editar"
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-onbrand/[0.03] transition-colors"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TYPE_ICON_BG[transaction.type])}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* title = tooltip nativo do navegador: passando o mouse por cima
              de uma descrição cortada (truncate), o texto inteiro aparece,
              sem precisar alargar a linha pra isso. */}
          <p className="font-medium text-onbrand truncate" title={transaction.description}>
            {transaction.description}
          </p>
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
        <TransactionSubtext transaction={transaction} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-medium tabular-nums ${meta.amountClass}`}>
          {meta.sign}
          {formatBRL(transaction.amount)}
        </span>
        <ChevronRight className="h-4 w-4 text-onbrand/30" aria-hidden />
      </div>
    </button>
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
