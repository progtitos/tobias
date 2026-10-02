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
  Repeat,
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
        <TransactionsTable
          transactions={transactions}
          onEdit={(t) => {
            setShowForm(false);
            setEditingTransaction(t);
          }}
        />
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

  // Barra bem mais enxuta (pedido do Thiago, 30/09/2026: "pode ficar bem
  // mais enxuta que isso") — antes eram duas linhas dentro de um Card com
  // padding generoso (busca sozinha em cima, 4 selects embaixo). Agora é uma
  // única linha compacta (h-9, texto menor), busca e filtros lado a lado,
  // só quebrando linha em telas estreitas.
  return (
    <Card className="mb-3">
      <CardContent className="py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-onbrand/40 pointer-events-none" />
          {/* Não-controlado (defaultValue), remontado via `key` quando o
              filtro muda por fora (navegação de mês, por exemplo) — evita
              precisar de um useEffect só pra sincronizar estado derivado de
              props, que o React recomenda evitar. */}
          <Input
            key={filters.q}
            className="h-9 pl-8 text-sm"
            placeholder="Buscar por descrição ou estabelecimento..."
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch(e.currentTarget.value);
            }}
            onBlur={(e) => commitSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-auto min-w-[108px] h-9 px-2.5 pr-7 text-sm"
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
            className="w-auto min-w-[108px] h-9 px-2.5 pr-7 text-sm"
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
        <Select
          className="w-auto min-w-[108px] h-9 px-2.5 pr-7 text-sm"
          value={filters.tipo}
          onChange={(e) => go({ tipo: e.target.value })}
        >
          <option value="">Tipo: Todos</option>
          {Object.entries(TYPE_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto min-w-[108px] h-9 px-2.5 pr-7 text-sm"
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

// ---------------------------------------------------------------------------
// Tabela de transações (redesenho aprovado, 02/10/2026, revisado 02/10/2026
// a pedido do Thiago: "a ordem é data, descrição, tag, banco e valor... tudo
// em uma linha só igual ao print que enviei" — o banco ganhou coluna própria
// em vez de aparecer como ícone embutido na descrição). Substitui o feed
// agrupado por dia (DayGroup) por uma grade única: mesmo `TABLE_GRID` no
// cabeçalho e em cada linha garante que as colunas batem exatinho de uma
// linha pra outra, sem precisar de <table> (fora do padrão visual do
// produto — ver design-system-tobias.md).
// Data não mostra horário: a coluna existe só como timestamptz à meia-noite
// local (parseDateOnly em transactions.ts), não há captura de hora em lugar
// nenhum do app, então mostrar um horário aqui seria inventar um dado que
// não existe (confirmado com o Thiago antes de implementar).
// ---------------------------------------------------------------------------

const TABLE_GRID = "grid-cols-[52px_minmax(0,1fr)_110px_92px_16px]";

function TransactionsTableHeader() {
  return (
    <div
      className={cn(
        "grid items-center px-3.5 py-2 gap-x-2.5 text-[11px] font-semibold uppercase tracking-wide text-onbrand/40 border-b border-onbrand/[0.06]",
        TABLE_GRID
      )}
    >
      <span>Data</span>
      <span>Descrição</span>
      <span>Banco</span>
      <span className="text-right">Valor</span>
      <span aria-hidden />
    </div>
  );
}

function TransactionsTable({
  transactions,
  onEdit,
}: {
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <TransactionsTableHeader />
      <div className="divide-y divide-onbrand/[0.06]">
        {transactions.map((t) => (
          <TransactionRow key={t.id} transaction={t} onEdit={() => onEdit(t)} />
        ))}
      </div>
    </Card>
  );
}

/** dd/mm numa linha, dia da semana abreviado embaixo — sem horário (ver nota
 * acima). `Intl` já devolve em pt-BR, só maiusculizamos a abreviação. */
function dateCellParts(dateStr: string): { dayMonth: string; weekday: string } {
  const d = new Date(dateStr);
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(d).replace(".", "");
  return { dayMonth, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
}

function TransactionRow({ transaction, onEdit }: { transaction: Transaction; onEdit: () => void }) {
  const lowConfidence = transaction.categoryId && transaction.confidence < 0.7;
  const meta = TYPE_META[transaction.type] ?? TYPE_META.EXPENSE;
  const bankName = transaction.bankAccountBankName ?? transaction.cardBankName ?? null;
  const { dayMonth, weekday } = dateCellParts(transaction.date);

  // Contexto além da descrição (conta/cartão quando não há banco vinculado,
  // categoria, estabelecimento) — o banco já tem coluna própria, então aqui
  // só entra o nome da conta/cartão quando não há banco (pra não repetir a
  // mesma informação duas vezes).
  const subParts: string[] = [];
  if (!bankName) {
    const accountOrCardLabel = transaction.bankAccountName ?? transaction.creditCardNickname ?? null;
    if (accountOrCardLabel) subParts.push(accountOrCardLabel);
  }
  if (transaction.type === "EXPENSE") subParts.push(transaction.categoryName ?? "Sem categoria");
  if (transaction.merchant) subParts.push(transaction.merchant);

  return (
    <button
      type="button"
      onClick={onEdit}
      title="Clique pra editar"
      className={cn(
        "w-full grid items-center text-left hover:bg-onbrand/[0.03] transition-colors px-3.5 py-2 gap-x-2.5",
        TABLE_GRID
      )}
    >
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-medium text-onbrand/80 tabular-nums">{dayMonth}</span>
        <span className="text-[10px] text-onbrand/45">{weekday}</span>
      </span>

      <span className="flex items-center gap-1.5 min-w-0">
        <span className="min-w-0 flex-1">
          {/* title = tooltip nativo do navegador: passando o mouse por cima
              de uma descrição cortada (truncate), o texto inteiro aparece,
              sem precisar alargar a linha pra isso. */}
          <p className="text-sm font-medium text-onbrand truncate" title={transaction.description}>
            {transaction.description}
          </p>
          {subParts.length > 0 && (
            <p className="text-[11px] text-onbrand/55 truncate">{subParts.join(" · ")}</p>
          )}
        </span>
        {/* Indicadores (parcela, meta, confiança baixa) — antes viviam numa
            coluna própria chamada "Tag", que confundia mais do que ajudava
            (pedido do Thiago, 02/10/2026: "ficou estranho essa questão da
            tag... pode remover"). Agora ficam coladinhos na descrição, sem
            coluna reservada pra eles. */}
        {((transaction.installmentTotal && transaction.installmentTotal > 1) ||
          transaction.goalTitle ||
          lowConfidence) && (
          <span className="flex items-center gap-1 shrink-0">
            {transaction.installmentTotal && transaction.installmentTotal > 1 && (
              <Badge tone="neutral" className={COMPACT_BADGE}>
                {transaction.installmentNumber}/{transaction.installmentTotal}
              </Badge>
            )}
            {transaction.goalTitle && (
              <Badge tone="gold" className={COMPACT_BADGE} title={`→ ${transaction.goalTitle}`}>
                →
              </Badge>
            )}
            {lowConfidence && (
              <Badge tone="warn" className={COMPACT_BADGE} title="Categoria sugerida com baixa confiança, confira">
                <Sparkles className="h-2.5 w-2.5" />
              </Badge>
            )}
          </span>
        )}
      </span>

      {/* Caixa de 26×26 fixa em volta do logo (ou do traço, quando não há
          banco vinculado) — mesma altura/largura nos dois casos garante que
          a coluna fica alinhada verticalmente de uma linha pra outra (pedido
          do Thiago: "só precisa alinhar os icones do banco"). */}
      <span className="flex items-center gap-1.5 min-w-0">
        {bankName ? (
          <>
            <BankBadge bankName={bankName} />
            <span className="text-xs text-onbrand/65 truncate">{bankName}</span>
          </>
        ) : (
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center text-onbrand/30 text-sm">
            —
          </span>
        )}
      </span>

      <span className={`text-sm font-medium tabular-nums text-right ${meta.amountClass}`}>
        {meta.sign}
        {formatBRL(transaction.amount)}
      </span>

      <ChevronRight className="h-3.5 w-3.5 text-onbrand/30 justify-self-end" aria-hidden />
    </button>
  );
}

// Linha compacta (pedido do Thiago, 01/10/2026: a lista original — ícone
// 36px, texto no tamanho padrão do corpo, badges de tamanho normal — ficava
// "massante"/mais alta do que precisava numa lista longa), depois convertida
// na grade de 4 colunas acima (02/10/2026). Badges de tag reaproveitam este
// tamanho reduzido.
const COMPACT_BADGE = "text-[10px] px-1.5 py-0 leading-[18px]";

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------
// Redesenho aprovado (screen 3 do briefing, 29/09/2026): a pilha de um Card
// por categoria vira um gráfico de composição (pra onde foi o dinheiro no
// mês) + o mesmo ranking de antes, só compacto (linhas dentro de um único
// Card, sem sombra/raio repetidos por categoria).
//
// O protótipo original propunha uma cor própria por categoria — sinalizado
// ali mesmo como algo que precisava da aprovação do Thiago antes de virar
// código, por conflitar com a seção 15 do Design System ("nunca inventar uma
// cor fora da paleta do produto" em gráfico). A primeira versão tentou
// contornar isso com um único tom (dourado) variando só a opacidade, mas o
// resultado ficou pouco legível — categorias quase idênticas entre si. O
// Thiago viu e pediu cor de verdade por categoria; os 8 tons abaixo (ver
// globals.css, `--color-cat-1`..`--color-cat-8`) foram escolhidos hoje como
// exceção documentada, evitando qualquer cor já usada com outro significado
// no produto (dourado = marca, verde = positivo, vermelho = negativo).
const CATEGORY_CHART_COLORS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
  "var(--color-cat-7)",
  "var(--color-cat-8)",
];

// Categorias além da 8ª reciclam a paleta (módulo) em vez de pedir token novo
// a cada categoria criada pelo usuário.
function categoryChartColor(rank: number): string {
  return CATEGORY_CHART_COLORS[rank % CATEGORY_CHART_COLORS.length];
}

/** Deslocamento (offset) de cada fatia do donut, uma por vez, como o
 * `stroke-dashoffset` de um `<circle>` espera: a soma acumulada das fatias
 * ANTERIORES, negativa. Uma função utilitária comum (fora do corpo do
 * componente) em vez de uma variável reatribuída dentro do `.map` que monta
 * o JSX — o eslint-plugin-react-hooks acusa essa segunda forma como
 * mutação impura durante a renderização. */
function cumulativeOffsets(dashes: number[]): number[] {
  const offsets: number[] = [];
  let sum = 0;
  for (const dash of dashes) {
    offsets.push(-sum);
    sum += dash;
  }
  return offsets;
}

function BudgetDonut({ items, total }: { items: { id: string; label: string; actual: number }[]; total: number }) {
  // O valor total NÃO fica dentro do miolo do anel (isso é o que causava o
  // "não cabe" persistente, não importa quanto se aumentasse o anel ou se
  // encolhesse a fonte — um texto retangular sempre acaba estourando um
  // círculo pequeno o bastante em algum valor). O protótipo aprovado nunca
  // colocou o número ali: ele fica do LADO do anel, como um bloco de texto
  // comum, sem limite de espaço nenhum (ver artefato original, seção
  // Orçamento, `.donut-card`/`.donut-total`) — corrigido aqui, 30/09/2026.
  const size = 128;
  const r = 48;
  const strokeWidth = 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashes = items.map((c) => (c.actual / total) * circumference);
  const offsets = cumulativeOffsets(dashes);

  return (
    // `max-w-sm mx-auto`: sem isso, o grupo donut+legenda esticava pra
    // preencher a largura toda do Card (~1100px em desktop), empurrando a
    // coluna de porcentagem pra bem longe do nome da categoria — o "tudo
    // desalinhado" que o Thiago apontou. Limitando a largura do conjunto,
    // ele fica compacto e centralizado dentro do Card, do jeito que já
    // funcionava no protótipo (frame de celular, nunca mais largo que isso).
    <div className="max-w-sm mx-auto">
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="Composição do gasto por categoria neste mês">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-onbrand)" strokeOpacity={0.07} strokeWidth={strokeWidth} />
          {items.map((c, i) => {
            return (
              <circle
                key={c.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={categoryChartColor(i)}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashes[i]} ${circumference}`}
                strokeDashoffset={offsets[i]}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        </svg>
        <div className="min-w-0">
          <div className="font-sans font-bold text-2xl tabular-nums text-onbrand leading-none truncate">
            {formatBRL(total)}
          </div>
          <div className="text-xs text-onbrand/50 mt-1.5">gasto no mês</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 mt-4">
        {items.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 text-xs min-w-0">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: categoryChartColor(i) }}
              aria-hidden
            />
            <span className="text-onbrand/70 truncate">{c.label}</span>
            <span className="ml-auto pl-2 tabular-nums text-onbrand/45 shrink-0">
              {Math.round((c.actual / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetTab({ budgets }: { budgets: BudgetRow[] }) {
  const [pending, startTransition] = useTransition();
  const ranked = [...budgets].sort((a, b) => b.actual - a.actual);
  const totalActual = ranked.reduce((s, b) => s + b.actual, 0);
  const donutItems = ranked.filter((b) => b.actual > 0).map((b) => ({ id: b.id, label: b.label, actual: b.actual }));

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
        <div className="space-y-5">
          <Card>
            <CardContent className="py-5">
              {totalActual > 0 ? (
                <BudgetDonut items={donutItems} total={totalActual} />
              ) : (
                <p className="text-sm text-onbrand/55 text-center py-3">
                  Nenhum gasto lançado neste mês ainda. O gráfico de composição aparece assim que houver dados.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-onbrand/[0.06]">
              {ranked.map((b, i) => (
                <BudgetRankRow key={b.id} budget={b} dotColor={categoryChartColor(i)} />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function BudgetRankRow({ budget, dotColor }: { budget: BudgetRow; dotColor: string }) {
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
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Mesma cor da fatia do donut acima — a bolinha liga visualmente
              cada linha do ranking à sua fatia. */}
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dotColor }} aria-hidden />
          <p className="font-medium text-onbrand truncate">{budget.label}</p>
          {!budget.isAutoCalculated && <Badge tone="neutral">Ajustado por você</Badge>}
          {budget.isOverrun && <Badge tone="danger">Estourou</Badge>}
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
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

      <div className="flex justify-between text-sm mb-1 pl-3.5">
        <span className="text-onbrand/55">
          {formatBRL(budget.actual)} de {formatBRL(budget.limitAmount)}
        </span>
        <span className={budget.isOverrun ? "text-danger-300 font-medium" : "text-onbrand/70"}>{pct}%</span>
      </div>
      <div className="pl-3.5">
        <ProgressBar value={Math.min(100, pct)} barClassName={budget.isOverrun ? "bg-danger-300" : undefined} />
      </div>
    </div>
  );
}
