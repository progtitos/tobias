"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Pause,
  Play,
  Landmark,
  LineChart,
  PlusCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  createBankAccountAction,
  updateBankAccountBalanceAction,
  toggleBankAccountActiveAction,
  deleteBankAccountAction,
  createInvestmentAction,
  updateInvestmentValueAction,
  addInvestmentContributionAction,
  deleteInvestmentAction,
  type PatrimonioFormState,
} from "./actions";

type BankAccount = {
  id: string;
  name: string;
  bankName: string | null;
  type: string;
  balance: number;
  isActive: boolean;
};

type Investment = {
  id: string;
  name: string;
  type: string;
  investedAmount: number;
  currentAmount: number;
  liquidity: string | null;
  institution: string | null;
  goalId: string | null;
  goalTitle: string | null;
};

type Goal = { id: string; title: string };

type NetWorth = {
  liquidAssets: number;
  investedAssets: number;
  otherAssets: number;
  totalDebt: number;
  netWorth: number;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Conta investimento",
  WALLET: "Carteira digital",
};

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

export function PatrimonioClient({
  accounts,
  investments,
  goals,
  netWorth,
}: {
  accounts: BankAccount[];
  investments: Investment[];
  goals: Goal[];
  netWorth: NetWorth;
}) {
  const [tab, setTab] = useState<"contas" | "investimentos">("contas");

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-cream-50 mb-1">Seu patrimônio</h1>
        <p className="text-sm text-cream-50/55 mb-6">
          Suas contas e investimentos, na mão. Esses números alimentam seu patrimônio líquido, a curva de
          aposentadoria e o Ponteiro.
        </p>

        <NetWorthSummary netWorth={netWorth} />

        <div className="flex gap-1 mt-6 mb-5 border-b border-white/10">
          <TabButton active={tab === "contas"} onClick={() => setTab("contas")} icon={Landmark}>
            Contas bancárias
          </TabButton>
          <TabButton active={tab === "investimentos"} onClick={() => setTab("investimentos")} icon={LineChart}>
            Investimentos
          </TabButton>
        </div>

        {tab === "contas" ? <AccountsSection accounts={accounts} /> : <InvestmentsSection investments={investments} goals={goals} />}
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
  icon: typeof Landmark;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-gold-400 text-gold-400" : "border-transparent text-cream-50/50 hover:text-cream-50/80"
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function NetWorthSummary({ netWorth }: { netWorth: NetWorth }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-cream-50/60 mb-0.5">Patrimônio líquido</p>
            <p
              className={cn(
                "font-sans font-medium text-3xl tracking-tight tabular-nums",
                netWorth.netWorth >= 0 ? "text-cream-50" : "text-danger-300"
              )}
            >
              {formatBRL(netWorth.netWorth)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
          <SummaryFigure label="Em contas" value={netWorth.liquidAssets} />
          <SummaryFigure label="Investido" value={netWorth.investedAssets} />
          <SummaryFigure label="Outros bens" value={netWorth.otherAssets} />
          <SummaryFigure label="Dívidas" value={netWorth.totalDebt} negative />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryFigure({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-cream-50/50 mb-0.5">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums", negative && value > 0 ? "text-danger-300" : "text-cream-50/85")}>
        {negative && value > 0 ? "−" : ""}
        {formatBRL(value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contas bancárias
// ---------------------------------------------------------------------------

function AccountsSection({ accounts }: { accounts: BankAccount[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<PatrimonioFormState, FormData>(createBankAccountAction, undefined);
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-cream-50/55">{accounts.length} conta{accounts.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {showForm && (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <form
              action={async (fd) => {
                await formAction(fd);
                setShowForm(false);
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="col-span-2">
                <Label htmlFor="name">Nome da conta</Label>
                <Input id="name" name="name" placeholder="Ex: Conta corrente principal" required />
              </div>
              <div>
                <Label htmlFor="bankName">Banco (opcional)</Label>
                <Input id="bankName" name="bankName" placeholder="Ex: Nubank" />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select id="type" name="type" defaultValue="CHECKING">
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="balance">Saldo atual (R$)</Label>
                <Input id="balance" name="balance" type="number" step="0.01" placeholder="0,00" required />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar conta
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

      {accounts.length === 0 ? (
        <p className="text-sm text-cream-50/55 py-12 text-center">
          Você ainda não cadastrou nenhuma conta. Adicione suas contas para o patrimônio e a reserva de emergência
          refletirem a realidade.
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
          {inactive.length > 0 && (
            <>
              <p className="text-xs font-medium text-cream-50/55 pt-4">Desativadas</p>
              {inactive.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AccountRow({ account }: { account: BankAccount }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(account.balance));

  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <Wallet className="h-5 w-5 shrink-0 text-cream-50/45" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-cream-50 truncate">{account.name}</p>
            <Badge tone="brand">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
            {!account.isActive && <Badge tone="neutral">Desativada</Badge>}
          </div>
          {account.bankName && <p className="text-xs text-cream-50/55 mt-0.5">{account.bankName}</p>}
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="h-9 w-28"
              autoFocus
            />
            <button
              className="text-ok-400 hover:opacity-80 disabled:opacity-40"
              disabled={pending}
              onClick={() => {
                const value = Number(balanceInput);
                if (!Number.isNaN(value)) {
                  startTransition(() => updateBankAccountBalanceAction(account.id, value));
                }
                setEditing(false);
              }}
            >
              <Check className="h-4 w-4" />
            </button>
            <button className="text-cream-50/40 hover:text-cream-50/70" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 group"
            onClick={() => {
              setBalanceInput(String(account.balance));
              setEditing(true);
            }}
            title="Atualizar saldo"
          >
            <span className="font-medium tabular-nums text-cream-50">{formatBRL(account.balance)}</span>
            <Pencil className="h-3.5 w-3.5 text-cream-50/30 group-hover:text-gold-400" />
          </button>
        )}

        <button
          className="text-cream-50/40 hover:text-gold-400 shrink-0"
          title={account.isActive ? "Desativar" : "Reativar"}
          disabled={pending}
          onClick={() => startTransition(() => toggleBankAccountActiveAction(account.id, !account.isActive))}
        >
          {account.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          aria-label="Excluir"
          className="text-cream-50/35 hover:text-danger-300 transition-colors shrink-0"
          disabled={pending}
          onClick={() => startTransition(() => deleteBankAccountAction(account.id))}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Investimentos
// ---------------------------------------------------------------------------

function InvestmentsSection({ investments, goals }: { investments: Investment[]; goals: Goal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<PatrimonioFormState, FormData>(createInvestmentAction, undefined);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-cream-50/55">
          {investments.length} investimento{investments.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo investimento
        </Button>
      </div>

      {showForm && (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <form
              action={async (fd) => {
                await formAction(fd);
                setShowForm(false);
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="col-span-2">
                <Label htmlFor="inv-name">Nome</Label>
                <Input id="inv-name" name="name" placeholder="Ex: Tesouro Selic 2029" required />
              </div>
              <div>
                <Label htmlFor="inv-type">Tipo</Label>
                <Select id="inv-type" name="type" defaultValue="FIXED_INCOME">
                  {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="institution">Instituição (opcional)</Label>
                <Input id="institution" name="institution" placeholder="Ex: XP, Nubank..." />
              </div>
              <div>
                <Label htmlFor="investedAmount">Valor investido (R$)</Label>
                <Input id="investedAmount" name="investedAmount" type="number" step="0.01" placeholder="0,00" required />
              </div>
              <div>
                <Label htmlFor="currentAmount">Valor atual (opcional)</Label>
                <Input
                  id="currentAmount"
                  name="currentAmount"
                  type="number"
                  step="0.01"
                  placeholder="Igual ao investido, se vazio"
                />
              </div>
              <div>
                <Label htmlFor="liquidity">Liquidez (opcional)</Label>
                <Input id="liquidity" name="liquidity" placeholder="Ex: D+0, D+1, no vencimento..." />
              </div>
              <div>
                <Label htmlFor="inv-goalId">Ligar a um objetivo (opcional)</Label>
                <Select id="inv-goalId" name="goalId" defaultValue="">
                  <option value="">Não ligar a um objetivo</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar investimento
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

      {investments.length === 0 ? (
        <p className="text-sm text-cream-50/55 py-12 text-center">
          Você ainda não cadastrou investimentos. Adicione os seus para o patrimônio, a curva de aposentadoria e o
          Ponteiro considerarem o que você já tem guardado.
        </p>
      ) : (
        <div className="space-y-2">
          {investments.map((inv) => (
            <InvestmentRow key={inv.id} investment={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvestmentRow({ investment }: { investment: Investment }) {
  const [pending, startTransition] = useTransition();
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(String(investment.currentAmount));
  const [contribution, setContribution] = useState("");

  const gain = investment.currentAmount - investment.investedAmount;
  const gainPct = investment.investedAmount > 0 ? (gain / investment.investedAmount) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-cream-50">{investment.name}</p>
              <Badge tone="brand">{INVESTMENT_TYPE_LABELS[investment.type]}</Badge>
              {investment.goalTitle && <Badge tone="gold">→ {investment.goalTitle}</Badge>}
            </div>
            <p className="text-xs text-cream-50/55 mt-0.5">
              {investment.institution ? `${investment.institution} · ` : ""}
              Aportado: {formatBRL(investment.investedAmount)}
              {investment.liquidity ? ` · Liquidez: ${investment.liquidity}` : ""}
            </p>
          </div>

          {editingValue ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                step="0.01"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                className="h-9 w-28"
                autoFocus
              />
              <button
                className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                disabled={pending}
                onClick={() => {
                  const value = Number(valueInput);
                  if (!Number.isNaN(value)) {
                    startTransition(() => updateInvestmentValueAction(investment.id, value));
                  }
                  setEditingValue(false);
                }}
              >
                <Check className="h-4 w-4" />
              </button>
              <button className="text-cream-50/40 hover:text-cream-50/70" onClick={() => setEditingValue(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <button
                className="flex items-center gap-1.5 group justify-end"
                onClick={() => {
                  setValueInput(String(investment.currentAmount));
                  setEditingValue(true);
                }}
                title="Atualizar valor atual"
              >
                <span className="font-medium tabular-nums text-cream-50">{formatBRL(investment.currentAmount)}</span>
                <Pencil className="h-3.5 w-3.5 text-cream-50/30 group-hover:text-gold-400" />
              </button>
              {gain !== 0 && (
                <p className={cn("text-xs tabular-nums", gain > 0 ? "text-ok-400" : "text-danger-300")}>
                  {gain > 0 ? "+" : ""}
                  {formatBRL(gain)} ({gainPct > 0 ? "+" : ""}
                  {gainPct.toFixed(1)}%)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Registrar aporte (R$)"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className="h-9 max-w-[180px]"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!contribution || pending}
              onClick={() => {
                const amount = Number(contribution);
                if (amount > 0) {
                  startTransition(() => addInvestmentContributionAction(investment.id, amount));
                  setContribution("");
                }
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Aportar
            </Button>
          </div>
          <button
            aria-label="Excluir"
            className="text-cream-50/35 hover:text-danger-300 transition-colors"
            disabled={pending}
            onClick={() => startTransition(() => deleteInvestmentAction(investment.id))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
