"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Pause,
  Play,
  Wallet,
  ArrowRight,
  Upload,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BankBadge } from "@/components/ui/BankBadge";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { BANKS, OTHER_BANK_ID, findBank } from "@/lib/utils/banks";
import type { CreditCardUsage } from "@/services/creditCards";
import {
  createBankAccountAction,
  updateBankAccountBalanceAction,
  updateBankAccountDetailsAction,
  toggleBankAccountActiveAction,
  deleteBankAccountAction,
  createCreditCardAction,
  updateCreditCardAction,
  deleteCreditCardAction,
  type ContaFormState,
  type CreditCardFormState,
} from "./actions";
import { uploadStatementAction, type UploadStatementState } from "./importActions";

type BankAccount = {
  id: string;
  name: string;
  bankName: string | null;
  ownerName: string | null;
  type: string;
  balance: number;
  isActive: boolean;
  invested: number;
};

type CreditCard = {
  id: string;
  bankAccountId: string | null;
  nickname: string;
  brand: string | null;
  lastFourDigits: string | null;
  limitAmount: number | null;
  closingDay: number | null;
  dueDay: number | null;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Conta investimento",
  WALLET: "Carteira digital",
};

// Mesmos limiares do card "Seu cartão" do Dashboard (pickCardNeedingAttention)
// — verde/dourado/vermelho pela % do limite usada no ciclo aberto.
function usageTone(usagePct: number | null): { bar: string; text: string } {
  if (usagePct == null) return { bar: "bg-onbrand/25", text: "text-onbrand/50" };
  if (usagePct >= 90) return { bar: "bg-danger-300", text: "text-danger-300" };
  if (usagePct >= 70) return { bar: "bg-gold-400", text: "text-gold-400" };
  return { bar: "bg-ok-400", text: "text-ok-400" };
}

export function ContaClient({
  accounts,
  creditCards,
  cardsUsage,
  totalInvested,
}: {
  accounts: BankAccount[];
  creditCards: CreditCard[];
  cardsUsage: CreditCardUsage[];
  totalInvested: number;
}) {
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [accountFormState, accountFormAction, accountPending] = useActionState<ContaFormState, FormData>(
    createBankAccountAction,
    undefined
  );

  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);
  const totalAccountsInvested = active.reduce((s, a) => s + a.invested, 0);

  const usageById = new Map(cardsUsage.map((u) => [u.id, u]));
  const totalCardSpend = cardsUsage.reduce((s, u) => s + u.currentCycleSpend, 0);
  const totalCardLimit = cardsUsage.reduce((s, u) => s + (u.limitAmount ?? 0), 0);
  const cardsWithLimit = cardsUsage.filter((u) => u.limitAmount != null);
  const totalAvailableLimit = cardsWithLimit.reduce((s, u) => s + (u.limitAmount! - u.currentCycleSpend), 0);

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-5xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Suas contas</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Contas bancárias, carteiras digitais e cartões de crédito ligados a elas. Abra uma conta pra atualizar o
          saldo, importar o extrato ou adicionar um cartão, e importar a fatura direto dele.
        </p>

        <Card className="mb-6">
          <CardContent className="py-5">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-onbrand/60 mb-0.5">Seu dinheiro, no total</p>
                <p className="font-sans font-medium text-3xl tracking-tight tabular-nums text-onbrand">
                  {formatBRL(totalBalance + totalInvested)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-onbrand/[0.06]">
              <div>
                <p className="text-[11px] text-onbrand/50 mb-0.5">Em contas</p>
                <p className="text-sm font-medium tabular-nums text-onbrand/85">{formatBRL(totalBalance)}</p>
              </div>
              <div>
                <p className="text-[11px] text-onbrand/50 mb-0.5">Investido</p>
                <p className="text-sm font-medium tabular-nums text-onbrand/85">{formatBRL(totalInvested)}</p>
              </div>
              <Link href="/investimentos" className="flex items-end">
                <span className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                  Ver investimentos <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ------------------------------------------------------------- */}
          {/* Contas */}
          {/* ------------------------------------------------------------- */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-sans font-semibold text-onbrand">Contas</h2>
                <button
                  type="button"
                  onClick={() => setShowAccountForm((v) => !v)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-onbrand/60 hover:text-gold-400 hover:bg-onbrand/5"
                  title="Adicionar conta"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-onbrand/55 pb-3 mb-1 border-b border-onbrand/[0.06]">
                <span>
                  Total em contas correntes <span className="tabular-nums text-onbrand/80">{formatBRL(totalBalance)}</span>
                </span>
                <span>
                  Total em investimentos{" "}
                  <span className="tabular-nums text-onbrand/80">{formatBRL(totalAccountsInvested)}</span>
                </span>
              </div>

              {showAccountForm && (
                <div className="py-3 border-b border-onbrand/[0.06] mb-1">
                  <NewAccountForm
                    formAction={accountFormAction}
                    pending={accountPending}
                    error={accountFormState?.error}
                    onDone={() => setShowAccountForm(false)}
                  />
                </div>
              )}

              {accounts.length === 0 ? (
                <p className="text-sm text-onbrand/55 py-8 text-center">
                  Nenhuma conta cadastrada ainda. Adicione pra o patrimônio refletir a realidade.
                </p>
              ) : (
                <div className="divide-y divide-onbrand/[0.04]">
                  {active.map((a) => (
                    <AccountRow key={a.id} account={a} />
                  ))}
                  {inactive.length > 0 && (
                    <>
                      <p className="text-[11px] font-medium text-onbrand/45 pt-3 pb-1">Desativadas</p>
                      {inactive.map((a) => (
                        <AccountRow key={a.id} account={a} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------------------------- */}
          {/* Cartões */}
          {/* ------------------------------------------------------------- */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-sans font-semibold text-onbrand">Cartões</h2>
                {accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCardForm((v) => !v)}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-onbrand/60 hover:text-gold-400 hover:bg-onbrand/5"
                    title="Adicionar cartão"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-onbrand/55 pb-3 mb-1 border-b border-onbrand/[0.06]">
                <span>
                  Total utilizado em cartões{" "}
                  <span className="tabular-nums text-onbrand/80">
                    {formatBRL(totalCardSpend)} de {formatBRL(totalCardLimit)}
                  </span>
                </span>
                <span>
                  Limite disponível{" "}
                  <span className="tabular-nums text-onbrand/80">{formatBRL(totalAvailableLimit)}</span>
                </span>
              </div>

              {showCardForm && (
                <div className="py-3 border-b border-onbrand/[0.06] mb-1">
                  <NewCreditCardForm accounts={accounts} onDone={() => setShowCardForm(false)} />
                </div>
              )}

              {creditCards.length === 0 ? (
                <p className="text-sm text-onbrand/55 py-8 text-center">
                  {accounts.length === 0
                    ? "Adicione uma conta primeiro: todo cartão fica ligado à conta que paga a fatura."
                    : "Nenhum cartão cadastrado ainda."}
                </p>
              ) : (
                <div className="divide-y divide-onbrand/[0.04]">
                  {creditCards.map((c) => (
                    <CardRow
                      key={c.id}
                      card={c}
                      usage={usageById.get(c.id) ?? null}
                      accountName={accounts.find((a) => a.id === c.bankAccountId)?.name ?? null}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nova conta — instituição num seletor (mais compacto que a grade de logos
// de antes, cabe melhor no layout de duas colunas), nome pré-preenchido a
// partir da instituição escolhida (editável), dono opcional (pra quem
// compartilha o Tobias com a família).
// ---------------------------------------------------------------------------

function NewAccountForm({
  formAction,
  pending,
  error,
  onDone,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onDone: () => void;
}) {
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [customBank, setCustomBank] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const isOther = selectedBank === OTHER_BANK_ID;
  const bankLabel = isOther ? customBank : BANKS.find((b) => b.id === selectedBank)?.label ?? "";

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        onDone();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="acc-bank">Instituição</Label>
          <Select
            id="acc-bank"
            value={selectedBank}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedBank(value);
              const label = value === OTHER_BANK_ID ? customBank : BANKS.find((b) => b.id === value)?.label ?? "";
              if (!nameTouched && label) setName(label);
            }}
          >
            <option value="">Selecione a instituição</option>
            {BANKS.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.label}
              </option>
            ))}
            <option value={OTHER_BANK_ID}>Outra / carteira digital</option>
          </Select>
          {isOther && (
            <Input
              className="mt-2"
              placeholder="Nome da instituição"
              value={customBank}
              onChange={(e) => {
                setCustomBank(e.target.value);
                if (!nameTouched) setName(e.target.value);
              }}
            />
          )}
          <input type="hidden" name="bankName" value={bankLabel} />
        </div>
        <div>
          <Label htmlFor="acc-owner">Proprietário (opcional)</Label>
          <Input id="acc-owner" name="ownerName" placeholder="Ex: Luísa" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="acc-name">Nome da conta</Label>
          <Input
            id="acc-name"
            name="name"
            placeholder="Ex: Conta corrente"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="acc-type">Tipo</Label>
          <Select id="acc-type" name="type" defaultValue="CHECKING">
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="acc-balance">Saldo em conta</Label>
        <CurrencyInput id="acc-balance" name="balance" required />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Adicionar conta
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Editar conta — mesmos campos de cadastro (sem saldo, que já tem seu
// próprio atalho rápido na linha).
// ---------------------------------------------------------------------------

function EditAccountForm({ account, onDone }: { account: BankAccount; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ContaFormState, FormData>(
    updateBankAccountDetailsAction,
    undefined
  );
  const [selectedBank, setSelectedBank] = useState<string>(findBank(account.bankName)?.id ?? OTHER_BANK_ID);
  const [customBank, setCustomBank] = useState(findBank(account.bankName) ? "" : account.bankName ?? "");
  const isOther = selectedBank === OTHER_BANK_ID;
  const bankLabel = isOther ? customBank : BANKS.find((b) => b.id === selectedBank)?.label ?? "";

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-3 py-3">
      <input type="hidden" name="accountId" value={account.id} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`edit-acc-bank-${account.id}`}>Instituição</Label>
          <Select id={`edit-acc-bank-${account.id}`} value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            <option value="">Selecione a instituição</option>
            {BANKS.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.label}
              </option>
            ))}
            <option value={OTHER_BANK_ID}>Outra / carteira digital</option>
          </Select>
          {isOther && (
            <Input
              className="mt-2"
              placeholder="Nome da instituição"
              value={customBank}
              onChange={(e) => setCustomBank(e.target.value)}
            />
          )}
          <input type="hidden" name="bankName" value={bankLabel} />
        </div>
        <div>
          <Label htmlFor={`edit-acc-owner-${account.id}`}>Proprietário (opcional)</Label>
          <Input id={`edit-acc-owner-${account.id}`} name="ownerName" defaultValue={account.ownerName ?? ""} placeholder="Ex: Luísa" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`edit-acc-name-${account.id}`}>Nome da conta</Label>
          <Input id={`edit-acc-name-${account.id}`} name="name" defaultValue={account.name} required />
        </div>
        <div>
          <Label htmlFor={`edit-acc-type-${account.id}`}>Tipo</Label>
          <Select id={`edit-acc-type-${account.id}`} name="type" defaultValue={account.type}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Linha de conta — ícone do banco, nome + tipo + dono, saldo e investido à
// direita, lápis (editar cadastro) e lixeira (excluir) sempre visíveis. O
// resto (atualizar saldo, pausar, importar extrato/fatura) fica atrás de um
// clique na linha, pra não competir visualmente com o essencial.
// ---------------------------------------------------------------------------

function AccountRow({ account }: { account: BankAccount }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(account.balance);
  const [panel, setPanel] = useState<"upload" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="py-3">
      <div className="flex items-center gap-2.5">
        {account.bankName ? <BankBadge bankName={account.bankName} /> : <Wallet className="h-5 w-5 shrink-0 text-onbrand/45" />}
        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setOpen((v) => !v)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-onbrand text-sm truncate">{account.name}</p>
            {!account.isActive && <Badge tone="neutral">Desativada</Badge>}
          </div>
          <p className="text-[11px] text-onbrand/50 truncate">
            {ACCOUNT_TYPE_LABELS[account.type]}
            {account.ownerName ? ` · ${account.ownerName}` : ""}
          </p>
        </button>
        <div className="text-right shrink-0">
          <p className="font-medium tabular-nums text-onbrand text-sm">{formatBRL(account.balance)}</p>
          {account.invested > 0 && (
            <p className="text-[11px] tabular-nums text-onbrand/50">Investido {formatBRL(account.invested)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton label="Editar conta" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Excluir conta" tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          title={`Excluir a conta "${account.name}"?`}
          description="Isso não pode ser desfeito."
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            startTransition(() => {
              deleteBankAccountAction(account.id);
              setConfirmDelete(false);
            });
          }}
        />
      </div>

      {editing && <EditAccountForm account={account} onDone={() => setEditing(false)} />}

      {open && (
        <div className="pt-2 pl-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {editingBalance ? (
              <div className="flex items-center gap-1.5">
                <CurrencyInput
                  defaultValue={account.balance}
                  onValueChange={setBalanceInput}
                  className="h-9 w-28"
                  autoFocus
                />
                <button
                  className="text-ok-400 hover:opacity-80 disabled:opacity-40"
                  disabled={pending}
                  onClick={() => {
                    startTransition(() => updateBankAccountBalanceAction(account.id, balanceInput));
                    setEditingBalance(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button className="text-onbrand/40 hover:text-onbrand/70" onClick={() => setEditingBalance(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 group text-onbrand/70 hover:text-onbrand text-xs"
                onClick={() => {
                  setBalanceInput(account.balance);
                  setEditingBalance(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 text-onbrand/30 group-hover:text-gold-400" /> Atualizar saldo
              </button>
            )}
            <span className="text-onbrand/20">·</span>
            <button
              className="flex items-center gap-1.5 text-onbrand/70 hover:text-gold-400 text-xs"
              disabled={pending}
              onClick={() => startTransition(() => toggleBankAccountActiveAction(account.id, !account.isActive))}
            >
              {account.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {account.isActive ? "Desativar" : "Reativar"}
            </button>
            <span className="text-onbrand/20">·</span>
            <button
              className="flex items-center gap-1.5 text-onbrand/70 hover:text-gold-400 text-xs"
              onClick={() => setPanel(panel === "upload" ? null : "upload")}
            >
              <Upload className="h-3.5 w-3.5" /> Importar extrato ou fatura
            </button>
          </div>

          {panel === "upload" && (
            <StatementUploadForm target={{ kind: "account", accountId: account.id }} onCancel={() => setPanel(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload de extrato/fatura — cada conta e cada cartão tem seu próprio botão
// e painel (ver AccountRow e CardRow), sem seletor de destino: o alvo já é
// sabido pelo contexto de onde o upload foi aberto. Antes havia um único
// formulário compartilhado com um seletor "conta ou qual cartão", que
// convidava a escolher o destino errado (uma fatura de cartão sendo
// enviada como extrato de outra conta) — reportado em produção.
// ---------------------------------------------------------------------------

type UploadTarget = { kind: "account"; accountId: string } | { kind: "card"; creditCardId: string };

function StatementUploadForm({ target, onCancel }: { target: UploadTarget; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState<UploadStatementState, FormData>(uploadStatementAction, undefined);
  const submitLabel = target.kind === "account" ? "Enviar extrato" : "Enviar fatura";

  return (
    <form action={formAction} className="rounded-xl bg-brand-900/60 p-3.5 mt-3">
      {target.kind === "account" ? (
        <input type="hidden" name="bankAccountId" value={target.accountId} />
      ) : (
        <input type="hidden" name="creditCardId" value={target.creditCardId} />
      )}

      <input
        type="file"
        name="file"
        accept=".pdf,.csv,image/*"
        required
        className="block w-full text-onbrand/80 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-gold-500 file:text-ink-900 file:font-medium text-xs file:text-xs"
      />
      <FieldError>{state?.error}</FieldError>
      <div className="flex gap-2 mt-2">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Lendo..." : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Novo cartão de crédito — agora um formulário de primeiro nível (a seção
// Cartões não fica mais dentro de cada conta), então precisa de um seletor
// de "conta que paga a fatura" que antes vinha implícito por estar aberto
// dentro dela.
// ---------------------------------------------------------------------------

function NewCreditCardForm({ accounts, onDone }: { accounts: BankAccount[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CreditCardFormState, FormData>(createCreditCardAction, undefined);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const bankLabel = BANKS.find((b) => b.id === selectedBank)?.label ?? "";

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="brand" value={bankLabel} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="card-account">Conta que paga a fatura</Label>
          <Select id="card-account" name="bankAccountId" defaultValue={accounts[0]?.id ?? ""} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="card-bank">Bandeira / banco (opcional)</Label>
          <Select id="card-bank" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            <option value="">Selecione</option>
            {BANKS.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="card-nickname">Apelido do cartão</Label>
          <Input id="card-nickname" name="nickname" placeholder="Ex: Cartão principal" required />
        </div>
        <div>
          <Label htmlFor="card-last4">Últimos 4 dígitos</Label>
          <Input id="card-last4" name="lastFourDigits" inputMode="numeric" maxLength={4} placeholder="1234" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="card-limit">Limite (R$)</Label>
          <CurrencyInput id="card-limit" name="limitAmount" />
        </div>
        <div>
          <Label htmlFor="card-closing">Fechamento</Label>
          <Input id="card-closing" name="closingDay" type="number" min={1} max={31} placeholder="Ex: 20" />
        </div>
        <div>
          <Label htmlFor="card-due">Vencimento</Label>
          <Input id="card-due" name="dueDay" type="number" min={1} max={31} placeholder="Ex: 28" />
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Adicionar cartão
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Editar cartão — mesmos campos do cadastro; é o caminho principal pra
// preencher um limite que ficou em branco (cartão sem limite não entra na
// barra de uso aqui nem no card "Seu cartão" do Dashboard).
// ---------------------------------------------------------------------------

function EditCreditCardForm({ card, accountName, onDone }: { card: CreditCard; accountName: string | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CreditCardFormState, FormData>(updateCreditCardAction, undefined);
  const [selectedBank, setSelectedBank] = useState<string>(findBank(card.brand)?.id ?? "");
  const bankLabel = selectedBank ? BANKS.find((b) => b.id === selectedBank)?.label ?? card.brand ?? "" : card.brand ?? "";

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-3 py-3">
      <input type="hidden" name="creditCardId" value={card.id} />
      <input type="hidden" name="brand" value={bankLabel} />
      {accountName && <p className="text-[11px] text-onbrand/45">Conta que paga a fatura: {accountName}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`edit-card-nickname-${card.id}`}>Apelido do cartão</Label>
          <Input id={`edit-card-nickname-${card.id}`} name="nickname" defaultValue={card.nickname} required />
        </div>
        <div>
          <Label htmlFor={`edit-card-bank-${card.id}`}>Bandeira / banco</Label>
          <Select id={`edit-card-bank-${card.id}`} value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            <option value="">Selecione</option>
            {BANKS.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`edit-card-last4-${card.id}`}>Últimos 4 dígitos</Label>
          <Input
            id={`edit-card-last4-${card.id}`}
            name="lastFourDigits"
            inputMode="numeric"
            maxLength={4}
            defaultValue={card.lastFourDigits ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={`edit-card-closing-${card.id}`}>Fechamento</Label>
          <Input
            id={`edit-card-closing-${card.id}`}
            name="closingDay"
            type="number"
            min={1}
            max={31}
            defaultValue={card.closingDay ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor={`edit-card-due-${card.id}`}>Vencimento</Label>
          <Input
            id={`edit-card-due-${card.id}`}
            name="dueDay"
            type="number"
            min={1}
            max={31}
            defaultValue={card.dueDay ?? undefined}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`edit-card-limit-${card.id}`}>Limite (R$)</Label>
        <CurrencyInput id={`edit-card-limit-${card.id}`} name="limitAmount" defaultValue={card.limitAmount ?? undefined} />
      </div>
      <FieldError>{state?.error}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Linha de cartão — ícone da bandeira, apelido, gasto do ciclo aberto (R$ e
// %), barra de uso colorida pelos mesmos limiares do Dashboard, limite
// disponível, lápis (editar) e lixeira (excluir).
// ---------------------------------------------------------------------------

function CardRow({
  card,
  usage,
  accountName,
}: {
  card: CreditCard;
  usage: CreditCardUsage | null;
  accountName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [panel, setPanel] = useState<"upload" | null>(null);
  const tone = usageTone(usage?.usagePct ?? null);
  const spend = usage?.currentCycleSpend ?? 0;
  const pct = usage?.usagePct != null ? Math.round(usage.usagePct) : null;
  const available = card.limitAmount != null ? card.limitAmount - spend : null;

  return (
    <div className="py-3">
      <div className="flex items-center gap-2.5">
        {card.brand ? <BankBadge bankName={card.brand} /> : <CreditCardIcon className="h-5 w-5 shrink-0 text-onbrand/45" />}
        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setOpen((v) => !v)}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-onbrand text-sm truncate">
              {card.nickname}
              {card.lastFourDigits && <span className="text-onbrand/40 font-normal"> •••• {card.lastFourDigits}</span>}
            </p>
            <p className={cn("text-sm font-medium tabular-nums shrink-0", tone.text)}>
              {formatBRL(spend)}
              {pct != null && <span className="text-onbrand/45 font-normal"> ({pct}%)</span>}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-onbrand/[0.06] overflow-hidden mt-1.5">
            <div
              className={cn("h-full rounded-full", tone.bar)}
              style={{ width: `${Math.min(100, pct ?? (card.limitAmount == null ? 6 : 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-onbrand/50 mt-1">
            {accountName ? `${accountName} · ` : ""}
            {card.limitAmount != null
              ? `Limite disponível: ${formatBRL(available ?? 0)}`
              : "Sem limite cadastrado, edite pra acompanhar o uso"}
          </p>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton label="Editar cartão" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Excluir cartão" tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          title={`Excluir o cartão "${card.nickname}"?`}
          description="Isso não pode ser desfeito."
          pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            startTransition(() => {
              deleteCreditCardAction(card.id);
              setConfirmDelete(false);
            });
          }}
        />
      </div>

      {editing && <EditCreditCardForm card={card} accountName={accountName} onDone={() => setEditing(false)} />}

      {open && (
        <div className="pt-2 pl-8">
          <button
            type="button"
            className="flex items-center gap-1.5 text-onbrand/70 hover:text-gold-400 text-xs"
            onClick={() => setPanel(panel === "upload" ? null : "upload")}
          >
            <Upload className="h-3.5 w-3.5" /> Importar fatura
          </button>

          {panel === "upload" && (
            <StatementUploadForm target={{ kind: "card", creditCardId: card.id }} onCancel={() => setPanel(null)} />
          )}
        </div>
      )}
    </div>
  );
}
