"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X, PlusCircle, Upload, Landmark } from "lucide-react";
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
import {
  createInvestmentAction,
  updateInvestmentValueAction,
  addInvestmentContributionAction,
  deleteInvestmentAction,
  createInvestmentAccountAction,
  uploadInvestmentStatementAction,
  type InvestimentosFormState,
  type UploadInvestmentStatementState,
} from "./actions";

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
  bankAccountId: string | null;
};

type Goal = { id: string; title: string };
type InvestmentAccount = { id: string; name: string; bankName: string | null };

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

// Saiu de dentro de Patrimônio pra ser item próprio no menu lateral — o
// conteúdo é o mesmo de sempre, só a tela que virou independente. O
// patrimônio líquido (que soma o total investido daqui) continua em
// Patrimônio, junto dos seus objetivos.
export function InvestimentosClient({
  investments,
  goals,
  accounts,
}: {
  investments: Investment[];
  goals: Goal[];
  accounts: InvestmentAccount[];
}) {
  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Investimentos</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Seus investimentos alimentam o patrimônio líquido (em Patrimônio), a curva de aposentadoria e o Ponteiro —
          para editar contas bancárias, vá em Conta.
        </p>

        <AccountsSection accounts={accounts} />
        <InvestmentsSection investments={investments} goals={goals} accounts={accounts} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corretoras — contas type="INVESTMENT" cadastradas direto por aqui, sem
// precisar passar pela tela de Conta. É o que permite "adicionar corretora à
// parte" e subir um extrato consolidado dela (sem estar ligado a nenhuma
// conta corrente).
// ---------------------------------------------------------------------------

function AccountsSection({ accounts }: { accounts: InvestmentAccount[] }) {
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [accountState, accountFormAction, accountPending] = useActionState<InvestimentosFormState, FormData>(
    createInvestmentAccountAction,
    undefined
  );

  if (accounts.length === 0 && !showAccountForm) {
    return (
      <Card className="mb-5 border-dashed border-onbrand/20 bg-transparent">
        <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-onbrand/60">
            <Landmark className="h-4 w-4 shrink-0" />
            Ainda não tem uma corretora cadastrada — adicione uma para poder subir um extrato consolidado.
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAccountForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar corretora
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-onbrand/50">Corretoras</p>
        <button
          type="button"
          className="text-xs font-semibold text-gold-400 hover:underline flex items-center gap-1"
          onClick={() => setShowAccountForm((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar corretora
        </button>
      </div>

      {showAccountForm && (
        <Card className="mb-3">
          <CardContent className="py-4">
            <form
              action={async (fd) => {
                await accountFormAction(fd);
                setShowAccountForm(false);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <Label htmlFor="acc-name">Nome da corretora</Label>
                <Input id="acc-name" name="name" placeholder="Ex: XP, Nubank, Rico..." required />
              </div>
              <div>
                <Label htmlFor="acc-bankName">Banco/grupo (opcional)</Label>
                <Input id="acc-bankName" name="bankName" placeholder="Ex: XP Investimentos" />
              </div>
              <div className="col-span-2">
                <FieldError>{accountState?.error}</FieldError>
                <div className="flex gap-2 mt-1">
                  <Button type="submit" size="sm" loading={accountPending}>
                    Salvar corretora
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAccountForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-onbrand">
                  <Landmark className="h-4 w-4 text-onbrand/50 shrink-0" />
                  {acc.name}
                  {acc.bankName && <span className="text-onbrand/45 text-xs">· {acc.bankName}</span>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadingFor(uploadingFor === acc.id ? null : acc.id)}
                >
                  <Upload className="h-3.5 w-3.5" /> Importar extrato consolidado
                </Button>
                {uploadingFor === acc.id && (
                  <div className="w-full">
                    <InvestmentUploadForm accountId={acc.id} onCancel={() => setUploadingFor(null)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InvestmentUploadForm({ accountId, onCancel }: { accountId: string; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState<UploadInvestmentStatementState, FormData>(
    uploadInvestmentStatementAction,
    undefined
  );

  return (
    <form action={formAction} className="rounded-xl bg-brand-900/60 p-3.5 mt-2">
      <input type="hidden" name="bankAccountId" value={accountId} />
      <p className="text-xs text-onbrand/60 mb-2">
        Suba o extrato/relatório consolidado dessa corretora (PDF ou foto/print) — o Tobias lê as posições e você
        confere antes de confirmar.
      </p>
      <input
        type="file"
        name="file"
        accept=".pdf,image/*"
        required
        className="block w-full text-onbrand/80 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-gold-500 file:text-ink-900 file:font-medium text-xs file:text-xs"
      />
      <FieldError>{state?.error}</FieldError>
      <div className="flex gap-2 mt-2">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Lendo..." : "Enviar extrato"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function InvestmentsSection({
  investments,
  goals,
  accounts,
}: {
  investments: Investment[];
  goals: Goal[];
  accounts: InvestmentAccount[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<InvestimentosFormState, FormData>(
    createInvestmentAction,
    undefined
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-onbrand/55">
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
                <CurrencyInput id="investedAmount" name="investedAmount" required />
              </div>
              <div>
                <Label htmlFor="currentAmount">Valor atual (opcional)</Label>
                <CurrencyInput id="currentAmount" name="currentAmount" placeholder="Igual ao investido, se vazio" />
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
              {accounts.length > 0 && (
                <div>
                  <Label htmlFor="inv-bankAccountId">Corretora (opcional)</Label>
                  <Select id="inv-bankAccountId" name="bankAccountId" defaultValue="">
                    <option value="">Nenhuma</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
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
        <p className="text-sm text-onbrand/55 py-12 text-center">
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
  const [valueInput, setValueInput] = useState(investment.currentAmount);
  const [contribution, setContribution] = useState(0);
  // Muda a key do CurrencyInput de aporte pra forçar ele a remontar (e
  // limpar o texto) depois de um aporte confirmado — CurrencyInput não
  // aceita um `value` controlado por fora (ver comentário no componente).
  const [contributionKey, setContributionKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const gain = investment.currentAmount - investment.investedAmount;
  const gainPct = investment.investedAmount > 0 ? (gain / investment.investedAmount) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-onbrand">{investment.name}</p>
              <Badge tone="brand">{INVESTMENT_TYPE_LABELS[investment.type]}</Badge>
              {investment.goalTitle && <Badge tone="gold">→ {investment.goalTitle}</Badge>}
            </div>
            <p className="text-xs text-onbrand/55 mt-0.5">
              {investment.institution ? `${investment.institution} · ` : ""}
              Aportado: {formatBRL(investment.investedAmount)}
              {investment.liquidity ? ` · Liquidez: ${investment.liquidity}` : ""}
            </p>
          </div>

          {editingValue ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <CurrencyInput defaultValue={investment.currentAmount} onValueChange={setValueInput} className="h-9 w-28" autoFocus />
              <button
                className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                disabled={pending}
                onClick={() => {
                  startTransition(() => updateInvestmentValueAction(investment.id, valueInput));
                  setEditingValue(false);
                }}
              >
                <Check className="h-4 w-4" />
              </button>
              <button className="text-onbrand/40 hover:text-onbrand/70" onClick={() => setEditingValue(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <button
                className="flex items-center gap-1.5 group justify-end"
                onClick={() => {
                  setValueInput(investment.currentAmount);
                  setEditingValue(true);
                }}
                title="Atualizar valor atual"
              >
                <span className="font-medium tabular-nums text-onbrand">{formatBRL(investment.currentAmount)}</span>
                <Pencil className="h-3.5 w-3.5 text-onbrand/30 group-hover:text-gold-400" />
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
                  startTransition(() => addInvestmentContributionAction(investment.id, contribution));
                  setContribution(0);
                  setContributionKey((k) => k + 1);
                }
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Aportar
            </Button>
          </div>
          <IconButton label="Excluir" tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <ConfirmDialog
            open={confirmDelete}
            title={`Excluir o investimento "${investment.name}"?`}
            description="Isso não pode ser desfeito."
            pending={pending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              startTransition(() => {
                deleteInvestmentAction(investment.id);
                setConfirmDelete(false);
              });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
