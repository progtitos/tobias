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
import { EmergencyFundTank } from "./EmergencyFundTank";
import {
  createGoalAction,
  addContributionAction,
  updateGoalStatusAction,
  updateGoalTargetAction,
  deleteGoalAction,
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
  EMERGENCY_FUND: "Seu colchão de segurança pra imprevistos: perda de renda, emergência médica etc.",
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
    // max-w-3xl -> max-w-4xl: os objetivos e o par Outros bens/Dívidas agora
    // viram grades de 2 colunas em telas largas (redesenho abaixo) — a
    // largura antiga sufocava as colunas.
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Patrimônio</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Seu patrimônio líquido, o que você tem e o que deve, e seus objetivos, num lugar só. Para editar
          investimentos, vá em Investimentos, para contas bancárias, vá em Conta.
        </p>

        <NetWorthSummary netWorth={netWorth} />

        {/* Redesenho aprovado (screen 4 do briefing, 29/09/2026): "Seus
            objetivos" sobe pra logo depois do patrimônio líquido — antes era
            a última seção, depois de Outros bens e Dívidas, o que enterrava a
            parte mais "viva" da tela (progresso, metas) embaixo de duas
            listas mais estáticas. `id`/`data-tour` continuam os mesmos, só a
            posição no DOM muda — os links existentes pra "/patrimonio#sonhos"
            (chat, Investimentos, Renda e Despesas) e o passo do tour guiado
            continuam funcionando iguais. */}
        <div data-tour="patrimonio-sonhos" className="mt-8">
          <h2 id="sonhos" className="font-sans font-medium text-lg text-onbrand mb-4 scroll-mt-6">
            Seus objetivos
          </h2>

          <GoalsSection goals={goals} emergencyFundSuggestion={emergencyFundSuggestion} />
        </div>

        {/* Outros bens e Dívidas dividem uma fileira em telas largas em vez
            de empilhar — as duas são listas mais estáticas, de consulta
            ocasional, então cabem lado a lado sem brigar por atenção com os
            objetivos acima. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-8 mt-8">
          <div>
            <h2 id="bens" className="font-sans font-medium text-lg text-onbrand mb-1 scroll-mt-6">
              Outros bens
            </h2>
            <p className="text-sm text-onbrand/45 mb-4">
              Carro, imóvel quitado, joias: tudo que tem valor real mas não é dinheiro em conta nem investimento.
            </p>
            <AssetsSection assets={assets} />
          </div>

          <div>
            <h2 id="dividas" className="font-sans font-medium text-lg text-onbrand mb-1 scroll-mt-6">
              Dívidas
            </h2>
            <p className="text-sm text-onbrand/45 mb-4">
              Financiamentos, empréstimos, cartão parcelado: o que falta pagar.
            </p>
            <DebtsSection debts={debts} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NetWorthSummary({ netWorth }: { netWorth: NetWorth }) {
  // Redesenho aprovado: o cartão grande (headline + figuras separadas por
  // uma linha abaixo) vira uma faixa fina — os mesmos 4 números, só numa
  // linha só (quebra pra uma segunda linha em telas estreitas, com uma
  // borda fina separando em vez de um espaço grande de respiro).
  return (
    <Card data-tour="patrimonio-liquido">
      <CardContent className="py-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="shrink-0">
            <p className="text-[11px] uppercase tracking-wide text-onbrand/60 mb-0.5">Patrimônio líquido</p>
            <p
              className={cn(
                "font-sans font-medium text-2xl tracking-tight tabular-nums",
                netWorth.netWorth >= 0 ? "text-onbrand" : "text-danger-300"
              )}
            >
              {formatBRL(netWorth.netWorth)}
            </p>
          </div>
          <div className="flex items-center gap-5 flex-wrap w-full border-t border-onbrand/[0.06] pt-3 sm:w-auto sm:flex-1 sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <SummaryFigure label="Em contas" value={netWorth.liquidAssets} />
            <SummaryFigure label="Investido" value={netWorth.investedAssets} />
            <SummaryFigure label="Outros bens" value={netWorth.otherAssets} />
            <SummaryFigure label="Dívidas" value={netWorth.totalDebt} negative />
          </div>
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
                <Label htmlFor="debt-remaining">Quanto ainda falta pagar (opcional; se vazio, assume o total)</Label>
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
          {/* Redesenho aprovado: objetivos ativos lado a lado em telas largas
              (antes sempre empilhados) — cartões maiores e mais fáceis de
              escanear de relance, como o protótipo propôs. "Outros"
              (pausados/concluídos, menos relevantes no dia a dia) continua
              numa lista simples abaixo, sem grade. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
          </div>
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
          gastos fixos, {formatBRL(suggestion.monthlyEssentialExpenses)}/mês): {suggestion.reason}.
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const pct = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : null;
  const isEmergencyFund = goal.type === "EMERGENCY_FUND";
  const TypeIcon = GOAL_TYPE_ICONS[goal.type] ?? Target;
  const pace = computeRequiredMonthlyPace(goal);

  return (
    // Borda colorida à esquerda (pedido do protótipo: "cartões de objetivo
    // ficam maiores e com uma borda colorida") — reaproveita as duas cores
    // que o selo no canto do anel/tanque já usa (ok-400 pra reserva de
    // emergência, gold-500 pros demais tipos), sem introduzir nenhuma cor
    // nova por tipo de objetivo.
    <Card
      data-testid="goal-card"
      data-goal-title={goal.title}
      className={cn("border-l-4", isEmergencyFund ? "border-l-ok-400" : "border-l-gold-500")}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {isEmergencyFund ? (
              <div className="relative shrink-0">
                <EmergencyFundTank pct={pct} />
                <span
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-brand-800 text-ink-900 bg-ok-400"
                  title={GOAL_TYPE_LABELS[goal.type]}
                >
                  <TypeIcon className="h-3 w-3" strokeWidth={2.5} />
                </span>
              </div>
            ) : (
              // Mesma pegada de 56×56 que o anel de progresso ocupava (ring
              // h-14 w-14), só pra manter o `pl-[68px]` do aporte abaixo
              // alinhado sem precisar remexer em outro lugar do arquivo — o
              // progresso em si virou o mini-gráfico embaixo do texto.
              <div className="h-14 w-14 shrink-0 flex items-center justify-center">
                <span
                  className="h-9 w-9 rounded-full flex items-center justify-center bg-gold-500 text-ink-900"
                  title={GOAL_TYPE_LABELS[goal.type]}
                >
                  <TypeIcon className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </div>
            )}
            <div className="min-w-0 pt-0.5 flex-1">
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
              {/* Mini-gráfico de progresso (redesenho aprovado, 02/10/2026 —
                  mesma linguagem visual da curva Meta da aposentadoria:
                  curva preenchida em vez de anel). Reserva de emergência
                  fica de fora: tem o próprio metáfora visual (o "tanque"
                  acima) e progresso calculado automaticamente, não aportado
                  à mão. Cor única (gold-500, mesma do selo/borda do card) —
                  "sem introduzir nenhuma cor nova por tipo de objetivo", já
                  decidido antes aqui perto (ver comentário na borda colorida
                  do Card). */}
              {!isEmergencyFund && <GoalMiniChart goal={goal} />}
            </div>
          </div>
          {/* Ambos IconButton (44×44 de alvo de toque, `design-system-tobias.md`
              §8/21) num `-m-2.5` só pra compensar o espaço extra que esse
              alvo maior adiciona ao layout do card — sem isso os dois botões
              empurravam o card mais largo/alto que os vizinhos sem ação. */}
          <div className="flex items-center shrink-0 -m-2.5">
            <IconButton
              label={goal.status === "ACTIVE" ? "Pausar objetivo" : "Retomar objetivo"}
              disabled={pending}
              onClick={() =>
                startTransition(() => updateGoalStatusAction(goal.id, goal.status === "ACTIVE" ? "PAUSED" : "ACTIVE"))
              }
            >
              {goal.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label="Excluir objetivo"
              tone="danger"
              disabled={deletePending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          title={`Excluir "${goal.title}"?`}
          description="Isso apaga o objetivo e todo o histórico de progresso dele. Não pode ser desfeito. Transações já lançadas continuam existindo, só deixam de estar ligadas a este objetivo."
          pending={deletePending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => startDeleteTransition(() => deleteGoalAction(goal.id))}
        />

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

/**
 * De onde (hoje, em fração do valor-alvo) até onde (projeção, mesma fração)
 * a curva vai. `goals` só guarda um `currentAmount` corrente, sem histórico
 * de aportes salvo — então a curva não reconstrói o passado, só projeta daqui
 * pra frente com o aporte mensal informado, do mesmo jeito que a curva Meta
 * da aposentadoria (ver `buildMetaTrajectory` em services/retirement.ts).
 * `null` quando não há valor-alvo (goal ainda não quantificado). Fica
 * achatada no nível atual quando a meta já foi atingida, ou quando falta
 * prazo/aporte pra projetar — sem inventar um prazo que ninguém informou.
 */
function goalProjection(goal: Goal): { from: number; to: number } | null {
  if (!goal.targetAmount || goal.targetAmount <= 0) return null;
  const pctNow = Math.min(1, goal.currentAmount / goal.targetAmount);
  if (pctNow >= 1 || !goal.targetDate || !goal.monthlyContribution || goal.monthlyContribution <= 0) {
    return { from: pctNow, to: pctNow };
  }
  const monthsRemaining = Math.max(
    1,
    Math.round((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  const projected = (goal.currentAmount + goal.monthlyContribution * monthsRemaining) / goal.targetAmount;
  return { from: pctNow, to: Math.max(pctNow, Math.min(1, projected)) };
}

// gold-500 — mesma cor do selo/borda que o card já usa pra todo objetivo que
// não é reserva de emergência (ver comentário na borda colorida do Card,
// acima): decisão deliberada de não introduzir uma cor nova por tipo.
const GOAL_CHART_COLOR = "var(--color-gold-500)";

function GoalMiniChart({ goal }: { goal: Goal }) {
  const projection = goalProjection(goal);
  if (!projection) return null;

  const gradientId = `goal-fill-${goal.id}`;
  const width = 240;
  const height = 56;
  const top = 6;
  const bottom = height - 4;
  const toY = (v: number) => bottom - v * (bottom - top);
  const y0 = toY(projection.from);
  const y1 = toY(projection.to);
  // Só 2 pontos reais (hoje, projeção) — uma única curva suave entre eles em
  // vez de reta, pra conversar visualmente com a curva Meta da aposentadoria.
  const line = `M0,${y0} C${width * 0.35},${y0 - (y0 - y1) * 0.15} ${width * 0.65},${y1 + (y0 - y1) * 0.3} ${width},${y1}`;
  const area = `${line} L${width},${bottom} L0,${bottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="mt-2.5 max-w-[320px]">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOAL_CHART_COLOR} stopOpacity={0.35} />
          <stop offset="100%" stopColor={GOAL_CHART_COLOR} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={GOAL_CHART_COLOR} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// Mensagem curta por tipo de objetivo pro card de comemoração abaixo — o
// mesmo "Meta concluída" genérico pra tudo soaria automático demais pro
// momento que é (Thiago pediu "celebração de verdade", só que contida).
const GOAL_ACHIEVED_MESSAGES: Record<string, string> = {
  DREAM: "Sonho realizado. Agora é hora de aproveitar.",
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
