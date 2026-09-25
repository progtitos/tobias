"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  PlusCircle,
  Pause,
  Play,
  Sparkles,
  LifeBuoy,
  Home,
  Palmtree,
  Target,
  Car,
  Package,
  Trash2,
  Pencil,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { GoalProgressRing } from "./GoalProgressRing";
import { EmergencyFundTank } from "./EmergencyFundTank";
import {
  createGoalAction,
  addContributionAction,
  updateGoalStatusAction,
  updateGoalTargetAction,
  type GoalFormState,
} from "../goals/actions";
import {
  createAssetAction,
  updateAssetValueAction,
  deleteAssetAction,
  createDebtAction,
  updateDebtRemainingAction,
  deleteDebtAction,
  type PatrimonioFormState,
} from "./actions";

type Goal = {
  id: string;
  title: string;
  type: string;
  status: string;
  targetAmount: number | null;
  currentAmount: number;
  monthlyContribution: number | null;
  targetDate: string | null;
  isQuantified: boolean;
};

type EmergencyFundSuggestion = {
  months: number;
  monthlyEssentialExpenses: number;
  suggestedTarget: number;
  reason: string;
} | null;

type NetWorth = {
  liquidAssets: number;
  investedAssets: number;
  otherAssets: number;
  totalDebt: number;
  netWorth: number;
};

// "Outros bens" e "Dívidas" — pedido do Thiago (2026-09-20) depois de olhar
// pra um patrimônio líquido negativo e achar que não fazia sentido: "isso
// daí não passa de um fluxo de caixa que entra e sai". computeNetWorth já
// somava assets.estimatedValue e subtraía debts.remainingAmount — a conta
// estava certa, só faltava um jeito de cadastrar um bem (carro, imóvel
// quitado) e de mexer numa dívida depois de criada (antes só entrava via
// extração de IA no onboarding, e ficava congelada pra sempre). Ver
// services/assets.ts, services/debts.ts e ./actions.ts.
type Asset = {
  id: string;
  name: string;
  type: string;
  estimatedValue: number;
  acquiredAt: string | null;
  notes: string | null;
};

type Debt = {
  id: string;
  description: string;
  type: string;
  totalAmount: number;
  remainingAmount: number;
  interestRateMonthly: number | null;
  installmentAmount: number | null;
  installmentsRemaining: number | null;
  dueDay: number | null;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: "Imóvel",
  VEHICLE: "Veículo",
  OTHER: "Outro",
};

const ASSET_TYPE_ICONS: Record<string, LucideIcon> = {
  REAL_ESTATE: Home,
  VEHICLE: Car,
  OTHER: Package,
};

const DEBT_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  PERSONAL_LOAN: "Empréstimo pessoal",
  FINANCING: "Financiamento",
  OVERDRAFT: "Cheque especial",
  FAMILY_FRIENDS: "Empréstimo de família/amigos",
  OTHER: "Outra",
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  DREAM: "Sonho",
  EMERGENCY_FUND: "Reserva de emergência",
  PROPERTY: "Imóvel",
  RETIREMENT: "Aposentadoria",
  CUSTOM: "Outro",
};

// Ícone + descrição curta por tipo — pedido do Thiago (2026-09-20, depois de
// duas rodadas achando a tela pouco intuitiva): "que tenha um ícone
// representando cada coisa". LifeBuoy (boia salva-vidas) pra reserva de
// emergência não é só decorativo: é o símbolo universal de segurança/socorro,
// reforçando a mesma ideia do reservatório (EmergencyFundTank) — "isso aqui é
// seu colchão de segurança", não mais um objetivo genérico entre outros.
const GOAL_TYPE_ICONS: Record<string, LucideIcon> = {
  DREAM: Sparkles,
  EMERGENCY_FUND: LifeBuoy,
  PROPERTY: Home,
  RETIREMENT: Palmtree,
  CUSTOM: Target,
};

const GOAL_TYPE_DESCRIPTIONS: Record<string, string> = {
  DREAM: "Um sonho seu, no seu tempo",
  EMERGENCY_FUND: "Seu colchão de segurança pra imprevistos — perda de renda, emergência médica etc.",
  PROPERTY: "Um imóvel que você quer conquistar",
  RETIREMENT: "Reserva extra pra complementar sua aposentadoria",
  CUSTOM: "Objetivo personalizado",
};

type MonthlyPace = { requiredMonthly: number; overdue: boolean; targetDateLabel: string };

/**
 * "Quanto guardar por mês pra chegar no prazo" — pedido direto do Thiago
 * (2026-09-20): "quem não tiver como guardar dinheiro não vai ser aportado
 * automaticamente ali... tem que ter um acompanhamento mensal informando
 * quanto ele deveria aportar por mês dentro do prazo estipulado". Antes essa
 * conta só existia escondida num alerta de fundo (checkGoalDelayed, em
 * services/insights.ts) que só dispara se a pessoa já tiver digitado um
 * "quanto guardar por mês" na criação do objetivo — pra reserva de
 * emergência isso nunca é preenchido (o valor é automático), então esse
 * alerta nunca aparecia pra ela. Esse cálculo aqui é mais simples de
 * propósito: (falta pra meta) ÷ (meses até o prazo), sempre que a meta tem
 * valor E prazo definidos — funciona pra reserva e pra qualquer outro
 * objetivo, independente de aporte mensal já ter sido declarado ou não.
 */
function computeRequiredMonthlyPace(goal: Goal): MonthlyPace | null {
  if (!goal.targetAmount || !goal.targetDate) return null;
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return null; // meta já batida, nada a ritmar

  const targetDateLabel = new Date(goal.targetDate).toLocaleDateString("pt-BR");
  const monthsRemaining = (new Date(goal.targetDate).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
  if (monthsRemaining <= 0) return { requiredMonthly: remaining, overdue: true, targetDateLabel };
  return { requiredMonthly: remaining / monthsRemaining, overdue: false, targetDateLabel };
}

export function PatrimonioClient({
  goals,
  netWorth,
  emergencyFundSuggestion,
  assets,
  debts,
}: {
  goals: Goal[];
  netWorth: NetWorth;
  emergencyFundSuggestion: EmergencyFundSuggestion;
  assets: Asset[];
  debts: Debt[];
}) {
  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Patrimônio</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Seu patrimônio líquido, o que você tem e o que deve, e seus objetivos, num lugar só. Para editar
          investimentos, vá em Investimentos, para contas bancárias, vá em Conta.
        </p>

        <NetWorthSummary netWorth={netWorth} />

        <h2 id="bens" className="font-sans font-medium text-lg text-onbrand mt-8 mb-1 scroll-mt-6">
          Outros bens
        </h2>
        <p className="text-sm text-onbrand/45 mb-4">
          Carro, imóvel quitado, joias — tudo que tem valor real mas não é dinheiro em conta nem investimento.
        </p>
        <AssetsSection assets={assets} />

        <h2 id="dividas" className="font-sans font-medium text-lg text-onbrand mt-8 mb-1 scroll-mt-6">
          Dívidas
        </h2>
        <p className="text-sm text-onbrand/45 mb-4">Financiamentos, empréstimos, cartão parcelado — o que falta pagar.</p>
        <DebtsSection debts={debts} />

        <div data-tour="patrimonio-sonhos">
          <h2 id="sonhos" className="font-sans font-medium text-lg text-onbrand mt-8 mb-4 scroll-mt-6">
            Seus objetivos
          </h2>

          <GoalsSection goals={goals} emergencyFundSuggestion={emergencyFundSuggestion} />
        </div>
      </div>
    </div>
  );
}

function NetWorthSummary({ netWorth }: { netWorth: NetWorth }) {
  return (
    <Card data-tour="patrimonio-liquido">
      <CardContent className="py-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-0.5">Patrimônio líquido</p>
            <p
              className={cn(
                "font-sans font-medium text-3xl tracking-tight tabular-nums",
                netWorth.netWorth >= 0 ? "text-onbrand" : "text-danger-300"
              )}
            >
              {formatBRL(netWorth.netWorth)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-onbrand/[0.06]">
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
      <p className="text-[11px] text-onbrand/50 mb-0.5">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums", negative && value > 0 ? "text-danger-300" : "text-onbrand/85")}>
        {negative && value > 0 ? "−" : ""}
        {formatBRL(value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outros bens
// ---------------------------------------------------------------------------

function AssetsSection({ assets }: { assets: Asset[] }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("VEHICLE");
  const [state, formAction, pending] = useActionState<PatrimonioFormState, FormData>(createAssetAction, undefined);
  const total = assets.reduce((s, a) => s + a.estimatedValue, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
          {assets.length} {assets.length === 1 ? "bem" : "bens"}
          {assets.length > 0 ? ` · ${formatBRL(total)}` : ""}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo bem
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
                <Label htmlFor="asset-name">O que é?</Label>
                <Input id="asset-name" name="name" placeholder="Ex: Carro, apartamento na praia..." required />
              </div>
              <div>
                <Label htmlFor="asset-type">Tipo</Label>
                <Select id="asset-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="asset-value">Valor estimado</Label>
                <CurrencyInput id="asset-value" name="estimatedValue" required />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar bem
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

      {assets.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-6 text-center">Nenhum bem cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  const [pending, startTransition] = useTransition();
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(asset.estimatedValue);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const TypeIcon = ASSET_TYPE_ICONS[asset.type] ?? Package;

  return (
    <Card>
      <CardContent className="py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gold-400/10 flex items-center justify-center">
              <TypeIcon className="h-4 w-4 text-gold-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-onbrand truncate">{asset.name}</p>
                <Badge tone="brand">{ASSET_TYPE_LABELS[asset.type]}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {editingValue ? (
              <>
                <CurrencyInput defaultValue={asset.estimatedValue} onValueChange={setValueInput} className="h-9 w-28" autoFocus />
                <button
                  className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                  disabled={pending}
                  onClick={() => {
                    startTransition(() => updateAssetValueAction(asset.id, valueInput));
                    setEditingValue(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button className="text-onbrand/40 hover:text-onbrand/70" onClick={() => setEditingValue(false)}>
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                className="flex items-center gap-1.5 group"
                onClick={() => {
                  setValueInput(asset.estimatedValue);
                  setEditingValue(true);
                }}
                title="Atualizar valor estimado"
              >
                <span className="font-medium tabular-nums text-onbrand">{formatBRL(asset.estimatedValue)}</span>
                <Pencil className="h-3.5 w-3.5 text-onbrand/30 group-hover:text-gold-400" />
              </button>
            )}
            <IconButton label="Excluir" tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          title={`Excluir "${asset.name}"?`}
          description="Isso não pode ser desfeito."
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            startTransition(() => {
              deleteAssetAction(asset.id);
              setConfirmDelete(false);
            });
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dívidas
// ---------------------------------------------------------------------------

function DebtsSection({ debts }: { debts: Debt[] }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("PERSONAL_LOAN");
  const [state, formAction, pending] = useActionState<PatrimonioFormState, FormData>(createDebtAction, undefined);
  const total = debts.reduce((s, d) => s + d.remainingAmount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
          {debts.length} {debts.length === 1 ? "dívida" : "dívidas"}
          {debts.length > 0 ? ` · ${formatBRL(total)} em aberto` : ""}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nova dívida
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
                <Label htmlFor="debt-description">O que é?</Label>
                <Input id="debt-description" name="description" placeholder="Ex: Financiamento do carro" required />
              </div>
              <div>
                <Label htmlFor="debt-type">Tipo</Label>
                <Select id="debt-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="debt-total">Valor total da dívida</Label>
                <CurrencyInput id="debt-total" name="totalAmount" required />
              </div>
              <div className="col-span-2">
                <Label htmlFor="debt-remaining">Quanto ainda falta pagar (opcional — se vazio, assume o total)</Label>
                <CurrencyInput id="debt-remaining" name="remainingAmount" />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar dívida
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

      {debts.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-6 text-center">Nenhuma dívida em aberto. 🎉</p>
      ) : (
        <div className="space-y-2">
          {debts.map((d) => (
            <DebtRow key={d.id} debt={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DebtRow({ debt }: { debt: Debt }) {
  const [pending, startTransition] = useTransition();
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(debt.remainingAmount);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const paidPct = debt.totalAmount > 0 ? Math.max(0, Math.min(100, 100 - (debt.remainingAmount / debt.totalAmount) * 100)) : 0;

  return (
    <Card>
      <CardContent className="py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-onbrand truncate">{debt.description}</p>
              <Badge tone="brand">{DEBT_TYPE_LABELS[debt.type]}</Badge>
            </div>
            <p className="text-xs text-onbrand/45 mt-0.5">
              {formatBRL(debt.totalAmount)} no total · {paidPct.toFixed(0)}% já pago
              {debt.installmentAmount ? ` · ${formatBRL(debt.installmentAmount)}/mês` : ""}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {editingValue ? (
              <>
                <CurrencyInput defaultValue={debt.remainingAmount} onValueChange={setValueInput} className="h-9 w-28" autoFocus />
                <button
                  className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                  disabled={pending}
                  onClick={() => {
                    startTransition(() => updateDebtRemainingAction(debt.id, valueInput));
                    setEditingValue(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button className="text-onbrand/40 hover:text-onbrand/70" onClick={() => setEditingValue(false)}>
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                className="flex items-center gap-1.5 group"
                onClick={() => {
                  setValueInput(debt.remainingAmount);
                  setEditingValue(true);
                }}
                title="Atualizar saldo devedor"
              >
                <span className="font-medium tabular-nums text-danger-300">−{formatBRL(debt.remainingAmount)}</span>
                <Pencil className="h-3.5 w-3.5 text-onbrand/30 group-hover:text-gold-400" />
              </button>
            )}
            <IconButton label="Excluir" tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          title={`Excluir "${debt.description}"?`}
          description="Isso não pode ser desfeito."
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            startTransition(() => {
              deleteDebtAction(debt.id);
              setConfirmDelete(false);
            });
          }}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sonhos (saiu do menu principal, mora aqui agora — mesmo conteúdo de sempre)
// ---------------------------------------------------------------------------

function GoalsSection({
  goals,
  emergencyFundSuggestion,
}: {
  goals: Goal[];
  emergencyFundSuggestion: EmergencyFundSuggestion;
}) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("DREAM");
  const [targetAmountKey, setTargetAmountKey] = useState(0);
  const [targetAmountDefault, setTargetAmountDefault] = useState<number | undefined>(undefined);
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createGoalAction, undefined);
  // Comemoração de meta batida ("opção 2" combinada com o Thiago: um card
  // contido aqui dentro de Patrimônio, não um overlay de tela cheia como o
  // do onboarding). `key` força o CSS de entrada (`goal-achieved-pop`) a
  // rodar de novo caso uma segunda meta seja batida antes da pessoa fechar
  // a primeira comemoração.
  const [achieved, setAchieved] = useState<{ key: number; title: string; type: string } | null>(null);

  const active = goals.filter((g) => g.status === "ACTIVE");
  const others = goals.filter((g) => g.status !== "ACTIVE");
  const hasEmergencyFundGoal = goals.some((g) => g.type === "EMERGENCY_FUND");

  return (
    <div>
      {achieved && (
        <GoalAchievedBanner
          key={achieved.key}
          goalTitle={achieved.title}
          goalType={achieved.type}
          onDismiss={() => setAchieved(null)}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
          {goals.length} objetivo{goals.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo objetivo
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
                <Label htmlFor="title">O que você quer conquistar?</Label>
                <Input id="title" name="title" placeholder="Ex: Viagem para a Europa" required />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="targetAmount">Quanto custa? (opcional)</Label>
                <CurrencyInput key={targetAmountKey} id="targetAmount" name="targetAmount" defaultValue={targetAmountDefault} />
              </div>
              {type === "EMERGENCY_FUND" && !hasEmergencyFundGoal && (
                <div className="col-span-2 -mt-1">
                  <EmergencyFundSuggestionBox
                    suggestion={emergencyFundSuggestion}
                    onUse={(amount) => {
                      setTargetAmountDefault(amount);
                      setTargetAmountKey((k) => k + 1);
                    }}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="targetDate">Prazo (opcional)</Label>
                <Input id="targetDate" name="targetDate" type="date" />
              </div>
              <div>
                <Label htmlFor="monthlyContribution">Quanto guardar por mês (opcional)</Label>
                <CurrencyInput id="monthlyContribution" name="monthlyContribution" />
              </div>
              <div className="col-span-2">
                <FieldError>{state?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" loading={pending}>
                    Salvar objetivo
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

      {goals.length === 0 ? (
        <p className="text-sm text-onbrand/55 py-12 text-center">
          Você ainda não tem objetivos. Conte um sonho seu pro Tobias no chat, ou crie um aqui.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              emergencyFundSuggestion={emergencyFundSuggestion}
              onAchieved={(title, goalType) =>
                setAchieved({ key: Date.now(), title, type: goalType })
              }
            />
          ))}
          {others.length > 0 && (
            <>
              <p className="text-xs font-medium text-onbrand/55 pt-4">Outros</p>
              {others.map((g) => (
                <GoalCard key={g.id} goal={g} emergencyFundSuggestion={emergencyFundSuggestion} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sugestão de meta de reserva de emergência — resposta direta à pergunta do
// Thiago (2026-09-20) "o Tobias precisa entender o quanto de reserva de
// emergência o cliente tem que ter": aplica a recomendação da Ameriprise (3
// a 6 meses de despesas essenciais, mais para renda única/variável) em cima
// do que a pessoa já cadastrou em Renda e Despesas. Ver
// computeEmergencyFundTarget em services/incomeExpenseSources.ts.
// ---------------------------------------------------------------------------

function EmergencyFundSuggestionBox({
  suggestion,
  onUse,
}: {
  suggestion: EmergencyFundSuggestion;
  onUse: (amount: number) => void;
}) {
  if (!suggestion) {
    return (
      <p className="text-xs text-onbrand/45 rounded-lg bg-brand-900/60 px-3 py-2.5">
        Cadastre seus gastos fixos em Renda e Despesas pra o Tobias sugerir uma meta baseada no que você realmente
        gasta por mês.
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-gold-100/[0.06] border border-gold-500/20 px-3 py-2.5">
      <Sparkles className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-onbrand/75">
          Sugestão: <b className="text-onbrand">{formatBRL(suggestion.suggestedTarget)}</b> ({suggestion.months} meses de
          gastos fixos, {formatBRL(suggestion.monthlyEssentialExpenses)}/mês) — {suggestion.reason}.
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-gold-400 hover:underline mt-1"
          onClick={() => onUse(suggestion.suggestedTarget)}
        >
          Usar esta meta
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  emergencyFundSuggestion,
  onAchieved,
}: {
  goal: Goal;
  emergencyFundSuggestion: EmergencyFundSuggestion;
  onAchieved?: (goalTitle: string, goalType: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [contribution, setContribution] = useState(0);
  // CurrencyInput não aceita `value` controlado (ver componente); mudar essa
  // key força ele a remontar em branco depois de um aporte confirmado.
  const [contributionKey, setContributionKey] = useState(0);
  const pct = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : null;
  const isEmergencyFund = goal.type === "EMERGENCY_FUND";
  const TypeIcon = GOAL_TYPE_ICONS[goal.type] ?? Target;
  const pace = computeRequiredMonthlyPace(goal);

  return (
    <Card data-testid="goal-card" data-goal-title={goal.title}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative shrink-0">
              {isEmergencyFund ? <EmergencyFundTank pct={pct} /> : <GoalProgressRing pct={pct} />}
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-brand-800 text-ink-900",
                  isEmergencyFund ? "bg-ok-400" : "bg-gold-500"
                )}
                title={GOAL_TYPE_LABELS[goal.type]}
              >
                <TypeIcon className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-onbrand">{goal.title}</p>
                <Badge tone="brand">{GOAL_TYPE_LABELS[goal.type]}</Badge>
                {goal.status !== "ACTIVE" && <Badge tone="neutral">{goal.status}</Badge>}
              </div>
              {goal.targetAmount ? (
                <p className="text-sm text-onbrand/55 mt-0.5">
                  {formatBRL(goal.currentAmount)} de {formatBRL(goal.targetAmount)}
                  {goal.targetDate ? ` · até ${new Date(goal.targetDate).toLocaleDateString("pt-BR")}` : ""}
                </p>
              ) : (
                <p className="text-sm text-onbrand/55 mt-0.5">Ainda não quantificado. Conte mais detalhes ao Tobias.</p>
              )}
              {pace && (
                <p className={cn("text-xs mt-1 font-medium", pace.overdue ? "text-danger-300" : "text-gold-400")}>
                  {pace.overdue
                    ? `O prazo (${pace.targetDateLabel}) já passou e ainda falta ${formatBRL(
                        (goal.targetAmount ?? 0) - goal.currentAmount
                      )}. Vale ajustar a meta ou o prazo.`
                    : isEmergencyFund
                      ? `Pra chegar lá até ${pace.targetDateLabel}, seu saldo guardado precisa crescer uns ${formatBRL(pace.requiredMonthly)}/mês.`
                      : `Pra chegar lá até ${pace.targetDateLabel}, aporte pelo menos ${formatBRL(pace.requiredMonthly)}/mês.`}
                </p>
              )}
              <p className="text-xs text-onbrand/40 mt-0.5">{GOAL_TYPE_DESCRIPTIONS[goal.type]}</p>
            </div>
          </div>
          <button
            className="text-onbrand/40 hover:text-gold-400 shrink-0"
            title={goal.status === "ACTIVE" ? "Pausar" : "Retomar"}
            onClick={() =>
              startTransition(() => updateGoalStatusAction(goal.id, goal.status === "ACTIVE" ? "PAUSED" : "ACTIVE"))
            }
          >
            {goal.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>

        {goal.status === "ACTIVE" &&
          (isEmergencyFund ? (
            <div className="mt-3 pl-[68px]">
              <p className="text-xs text-onbrand/45">
                Esse valor é calculado automaticamente a partir do seu saldo em conta e investimentos de liquidez
                imediata. Não precisa registrar aporte aqui.
              </p>
              {!goal.targetAmount && (
                <div className="mt-2">
                  <EmergencyFundSuggestionBox
                    suggestion={emergencyFundSuggestion}
                    onUse={(amount) => startTransition(() => updateGoalTargetAction(goal.id, amount))}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 pl-[68px] flex items-center gap-2">
              <CurrencyInput
                key={contributionKey}
                placeholder="Registrar aporte (R$)"
                onValueChange={setContribution}
                className="h-9 max-w-[180px]"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!contribution || pending}
                onClick={() => {
                  if (contribution > 0) {
                    startTransition(async () => {
                      const result = await addContributionAction(goal.id, contribution);
                      if (result.justAchieved) {
                        onAchieved?.(result.goalTitle ?? goal.title, result.goalType ?? goal.type);
                      }
                    });
                    setContribution(0);
                    setContributionKey((k) => k + 1);
                  }
                }}
              >
                <PlusCircle className="h-3.5 w-3.5" /> Aportar
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

// Mensagem curta por tipo de objetivo pro card de comemoração abaixo — o
// mesmo "Meta concluída" genérico pra tudo soaria automático demais pro
// momento que é (Thiago pediu "celebração de verdade", só que contida).
const GOAL_ACHIEVED_MESSAGES: Record<string, string> = {
  DREAM: "Sonho realizado — agora é hora de aproveitar.",
  EMERGENCY_FUND: "Sua reserva de emergência está completa.",
  PROPERTY: "Você juntou o valor pro imóvel. Bora dar o próximo passo?",
  RETIREMENT: "Meta de aposentadoria alcançada.",
  CUSTOM: "Você chegou lá.",
};

// ---------------------------------------------------------------------------
// Card de comemoração de meta batida — "opção 2" combinada com o Thiago:
// contido dentro da própria tela de Patrimônio (não um overlay de tela cheia
// como o ProfileRevealOverlay do fim do onboarding). Deliberadamente mais
// discreto que aquele: sem confete, brilho que se apaga sozinho (ver
// .goal-achieved-glow em globals.css) — é uma conquista do dia a dia, que
// pode se repetir, não o momento único de fim de onboarding.
// ---------------------------------------------------------------------------

function GoalAchievedBanner({
  goalTitle,
  goalType,
  onDismiss,
}: {
  goalTitle: string;
  goalType: string;
  onDismiss: () => void;
}) {
  const TypeIcon = GOAL_TYPE_ICONS[goalType] ?? Target;
  return (
    <div
      role="status"
      className="goal-achieved-pop goal-achieved-glow mb-4 flex items-start gap-3 rounded-xl border border-gold-500/25 bg-gold-100/[0.06] px-4 py-3.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-900">
        <TypeIcon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-onbrand">Meta concluída: {goalTitle}</p>
        <p className="text-xs text-onbrand/60 mt-0.5">
          {GOAL_ACHIEVED_MESSAGES[goalType] ?? "Você chegou lá."}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-onbrand/40 hover:text-onbrand/70"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
