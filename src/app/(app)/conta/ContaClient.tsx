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
  ChevronDown,
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
import { CreditCardBadge } from "@/components/ui/CreditCardBadge";
import { formatBRL } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { BANKS, OTHER_BANK_ID } from "@/lib/utils/banks";
import {
  createBankAccountAction,
  updateBankAccountBalanceAction,
  toggleBankAccountActiveAction,
  deleteBankAccountAction,
  createCreditCardAction,
  deleteCreditCardAction,
  type ContaFormState,
  type CreditCardFormState,
} from "./actions";
import { uploadStatementAction, type UploadStatementState } from "./importActions";

type BankAccount = {
  id: string;
  name: string;
  bankName: string | null;
  type: string;
  balance: number;
  isActive: boolean;
};

type CreditCard = {
  id: string;
  bankAccountId: string | null;
  nickname: string;
  brand: string | null;
  lastFourDigits: string | null;
  limitAmount: number | null;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Conta investimento",
  WALLET: "Carteira digital",
};

export function ContaClient({
  accounts,
  creditCards,
  totalInvested,
}: {
  accounts: BankAccount[];
  creditCards: CreditCard[];
  totalInvested: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<ContaFormState, FormData>(createBankAccountAction, undefined);
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);
  const cardsFor = (accountId: string) => creditCards.filter((c) => c.bankAccountId === accountId);

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Suas contas</h1>
        <p className="text-sm text-onbrand/55 mb-6">
          Contas bancárias, carteiras digitais e cartões de crédito ligados a elas. Abra uma conta pra atualizar o
          saldo, importar o extrato ou adicionar um cartão — e importar a fatura direto dele.
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
              <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="h-4 w-4" /> Nova conta
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
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

        {showForm && (
          <Card className="mb-5">
            <CardContent className="pt-5">
              <NewAccountForm
                formAction={formAction}
                pending={pending}
                error={state?.error}
                onDone={() => setShowForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-onbrand/55 py-12 text-center">
            Você ainda não cadastrou nenhuma conta. Adicione suas contas para o patrimônio e a reserva de emergência
            refletirem a realidade.
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((a) => (
              <AccountCard key={a.id} account={a} cards={cardsFor(a.id)} />
            ))}
            {inactive.length > 0 && (
              <>
                <p className="text-xs font-medium text-onbrand/55 pt-4">Desativadas</p>
                {inactive.map((a) => (
                  <AccountCard key={a.id} account={a} cards={cardsFor(a.id)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nova conta — nome pré-setado com marca (cor + iniciais, quadrado
// arredondado), em vez de digitar o nome do banco.
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
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [customBank, setCustomBank] = useState("");
  const isOther = selectedBank === OTHER_BANK_ID;
  const bankNameValue = isOther ? customBank : (BANKS.find((b) => b.id === selectedBank)?.label ?? "");

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        onDone();
      }}
      className="grid grid-cols-2 gap-4"
    >
      <div className="col-span-2">
        <Label>Banco (opcional)</Label>
        <div className="flex flex-wrap justify-center gap-3 py-1">
          {BANKS.map((bank) => (
            <button
              type="button"
              key={bank.id}
              onClick={() => setSelectedBank(bank.id === selectedBank ? null : bank.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 w-[70px] py-2 px-1 rounded-xl border-[1.5px] border-transparent",
                selectedBank === bank.id && "border-gold-400 bg-gold-400/10"
              )}
            >
              <BankBadge bankName={bank.label} size="lg" />
              <span
                className={cn(
                  "text-[11px] text-center leading-tight text-onbrand/65",
                  selectedBank === bank.id && "text-gold-400 font-medium"
                )}
              >
                {bank.label}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedBank(selectedBank === OTHER_BANK_ID ? null : OTHER_BANK_ID)}
            className={cn(
              "flex flex-col items-center gap-1.5 w-[70px] py-2 px-1 rounded-xl border-[1.5px] border-transparent",
              isOther && "border-gold-400 bg-gold-400/10"
            )}
          >
            <span className="h-10 w-10 rounded-full flex items-center justify-center text-base font-extrabold bg-white/10 text-onbrand/60 border border-dashed border-white/25">
              +
            </span>
            <span className={cn("text-[11px] text-center leading-tight text-onbrand/65", isOther && "text-gold-400 font-medium")}>
              Outro banco
            </span>
          </button>
        </div>
        {isOther && (
          <Input
            className="mt-2"
            placeholder="Nome do banco"
            value={customBank}
            onChange={(e) => setCustomBank(e.target.value)}
          />
        )}
        <input type="hidden" name="bankName" value={bankNameValue} />
      </div>
      <div className="col-span-2">
        <Label htmlFor="name">Nome da conta</Label>
        <Input id="name" name="name" placeholder="Ex: Conta corrente principal" required />
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
        <CurrencyInput id="balance" name="balance" required />
      </div>
      <div className="col-span-2">
        <FieldError>{error}</FieldError>
        <div className="flex gap-2 mt-1">
          <Button type="submit" loading={pending}>
            Salvar conta
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Card de conta — maior e clicável: colapsado mostra o resumo (banco, nome,
// tipo, saldo, quantos cartões estão ligados); aberto revela as ações
// (atualizar saldo, pausar, excluir), os cartões de crédito vinculados (cada
// um clicável só pra excluir — importar sobe pra cá) e os dois gatilhos: um
// upload único (extrato da conta OU fatura de qualquer cartão dela, ver
// ImportUploadPanel) e "+ Cartão de crédito" (cadastra um cartão novo).
//
// Antes existiam DOIS lugares pra subir arquivo (botão aqui + um escondido
// dentro de cada cartão), visualmente idênticos e em profundidades
// diferentes da árvore — já causou uma fatura de cartão entrar como extrato
// de conta na prática (distorceu o saldo). Um botão só, com o destino
// escolhido explicitamente dentro do próprio formulário, elimina essa classe
// de erro em vez de só mitigar com rótulo melhor.
// ---------------------------------------------------------------------------

function AccountCard({ account, cards }: { account: BankAccount; cards: CreditCard[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(account.balance);
  const [panel, setPanel] = useState<"upload" | "cartao" | null>(null);

  return (
    <Card className={cn(open && "ring-1 ring-gold-400/25")}>
      <button
        type="button"
        className="w-full flex items-center gap-3 py-4 px-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Wallet className="h-5 w-5 shrink-0 text-onbrand/45" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {account.bankName && <BankBadge bankName={account.bankName} />}
            <p className="font-medium text-onbrand truncate">{account.name}</p>
            <Badge tone="brand">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
            {!account.isActive && <Badge tone="neutral">Desativada</Badge>}
            {cards.length > 0 && (
              <Badge tone="gold">
                {cards.length} cartão{cards.length > 1 ? "ões" : ""}
              </Badge>
            )}
          </div>
        </div>
        <span className="font-medium tabular-nums text-onbrand shrink-0">{formatBRL(account.balance)}</span>
        <ChevronDown className={cn("h-4 w-4 text-onbrand/40 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <CardContent className="pt-1 pb-5 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
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
                className="flex items-center gap-1.5 group text-onbrand/70 hover:text-onbrand"
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
              className="flex items-center gap-1.5 text-onbrand/70 hover:text-gold-400"
              disabled={pending}
              onClick={() => startTransition(() => toggleBankAccountActiveAction(account.id, !account.isActive))}
            >
              {account.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {account.isActive ? "Desativar" : "Reativar"}
            </button>
            <span className="text-onbrand/20">·</span>
            <button
              className="flex items-center gap-1.5 text-onbrand/50 hover:text-danger-300"
              disabled={pending}
              onClick={() => {
                // Excluir sem confirmação nenhuma já causou um acidente real
                // (o "Excluir cartão" logo abaixo, que tinha o mesmo
                // problema) — conta é ainda mais grave de apagar sem querer.
                if (!window.confirm(`Excluir a conta "${account.name}"? Isso não pode ser desfeito.`)) return;
                startTransition(() => deleteBankAccountAction(account.id));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir conta
            </button>
          </div>

          {cards.length > 0 && (
            <div className="flex flex-wrap gap-4 py-2">
              {cards.map((c) => (
                <CreditCardTile key={c.id} card={c} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-3">
            <Button size="sm" variant="outline" onClick={() => setPanel(panel === "upload" ? null : "upload")}>
              <Upload className="h-3.5 w-3.5" /> Importar extrato ou fatura
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(panel === "cartao" ? null : "cartao")}>
              <Plus className="h-3.5 w-3.5" /> Cartão de crédito
            </Button>
          </div>

          {panel === "upload" && (
            <ImportUploadPanel account={account} cards={cards} onCancel={() => setPanel(null)} />
          )}
          {panel === "cartao" && <NewCreditCardForm bankAccountId={account.id} onDone={() => setPanel(null)} />}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cartão de crédito vinculado — retângulo clicável (CreditCardBadge); ao
// clicar, só revela o botão de excluir. Importar a fatura dele acontece pelo
// upload único lá em cima na conta (ImportUploadPanel), não mais aqui — ver
// o comentário em AccountCard sobre por que esses dois caminhos foram
// unificados.
// ---------------------------------------------------------------------------

function CreditCardTile({ card }: { card: CreditCard }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <CreditCardBadge
        brand={card.brand}
        nickname={card.nickname}
        lastFourDigits={card.lastFourDigits}
        limitAmount={card.limitAmount}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <button
          type="button"
          className="text-[11px] text-onbrand/40 hover:text-danger-300 flex items-center justify-center gap-1 disabled:opacity-40"
          disabled={pending}
          onClick={() => {
            // Sem essa confirmação, um clique em cima do que parecia ser só
            // um retângulo decorativo já apagou um cartão de verdade (visto
            // na prática) — nada avisava antes de excluir.
            if (!window.confirm(`Excluir o cartão "${card.nickname}"? Isso não pode ser desfeito.`)) return;
            startTransition(() => deleteCreditCardAction(card.id));
          }}
        >
          <Trash2 className="h-3 w-3" /> Excluir cartão
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload único de extrato/fatura — um só formulário pra conta e todos os
// cartões ligados a ela, com o destino escolhido explicitamente por um
// seletor (não por "qual botão eu cliquei lá na árvore da tela"), pra não
// repetir o erro de uma fatura de cartão entrar como extrato de conta (e
// distorcer o saldo dela). O texto do botão de enviar e o hidden field que a
// action usa pra saber o alvo mudam de acordo com a opção selecionada.
// ---------------------------------------------------------------------------

type UploadDestination = { kind: "account" } | { kind: "card"; cardId: string };

function ImportUploadPanel({
  account,
  cards,
  onCancel,
}: {
  account: BankAccount;
  cards: CreditCard[];
  onCancel: () => void;
}) {
  const [destination, setDestination] = useState<UploadDestination>({ kind: "account" });
  const [state, formAction, pending] = useActionState<UploadStatementState, FormData>(uploadStatementAction, undefined);

  const submitLabel = destination.kind === "account" ? "Enviar extrato" : "Enviar fatura";

  return (
    <form action={formAction} className="rounded-xl bg-brand-900/60 border border-white/10 p-3.5 mt-3">
      <p className="text-xs text-onbrand/60 mb-2">Isso é o extrato de qual conta, ou a fatura de qual cartão?</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setDestination({ kind: "account" })}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors",
            destination.kind === "account"
              ? "border-gold-400 bg-gold-400/10 text-gold-400"
              : "border-white/10 text-onbrand/65 hover:border-white/25"
          )}
        >
          {account.bankName && <BankBadge bankName={account.bankName} />}
          Conta {account.name}
        </button>
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setDestination({ kind: "card", cardId: c.id })}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border-[1.5px] transition-colors",
              destination.kind === "card" && destination.cardId === c.id
                ? "border-gold-400 bg-gold-400/10 text-gold-400"
                : "border-white/10 text-onbrand/65 hover:border-white/25"
            )}
          >
            <CreditCardIcon className="h-3.5 w-3.5" />
            Cartão {c.nickname}
          </button>
        ))}
      </div>

      {destination.kind === "account" ? (
        <input type="hidden" name="bankAccountId" value={account.id} />
      ) : (
        <input type="hidden" name="creditCardId" value={destination.cardId} />
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
// Novo cartão de crédito — sempre nasce ligado à conta que foi aberta;
// preview do cartão ao vivo enquanto a pessoa escolhe o banco/apelido.
// ---------------------------------------------------------------------------

function NewCreditCardForm({ bankAccountId, onDone }: { bankAccountId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CreditCardFormState, FormData>(createCreditCardAction, undefined);
  const [nickname, setNickname] = useState("");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [lastFour, setLastFour] = useState("");
  const [limit, setLimit] = useState<number | undefined>(undefined);
  const bankLabel = BANKS.find((b) => b.id === selectedBank)?.label ?? null;

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-brand-900/60 border border-white/10">
      <div className="flex justify-center py-2">
        <CreditCardBadge
          brand={bankLabel}
          nickname={nickname || "Meu cartão"}
          lastFourDigits={lastFour || null}
          limitAmount={limit ?? null}
        />
      </div>
      <form action={formAction} className="grid grid-cols-2 gap-3 mt-2">
        <input type="hidden" name="bankAccountId" value={bankAccountId} />
        <input type="hidden" name="brand" value={bankLabel ?? ""} />
        <div className="col-span-2">
          <Label>Banco (opcional)</Label>
          <div className="flex flex-wrap gap-2">
            {BANKS.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setSelectedBank(bank.id === selectedBank ? null : bank.id)}
                className={cn(
                  "h-8 px-2.5 rounded-lg text-xs font-medium",
                  bank.className,
                  selectedBank === bank.id ? "ring-2 ring-gold-400" : "opacity-60 hover:opacity-90"
                )}
              >
                {bank.label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <Label htmlFor="nickname">Apelido do cartão</Label>
          <Input
            id="nickname"
            name="nickname"
            placeholder="Ex: Cartão principal"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastFourDigits">Últimos 4 dígitos</Label>
          <Input
            id="lastFourDigits"
            name="lastFourDigits"
            inputMode="numeric"
            placeholder="1234"
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <div>
          <Label htmlFor="limitAmount">Limite (R$)</Label>
          <CurrencyInput id="limitAmount" name="limitAmount" onValueChange={setLimit} />
        </div>
        <div>
          <Label htmlFor="closingDay">Dia de fechamento</Label>
          <Input id="closingDay" name="closingDay" type="number" min={1} max={31} placeholder="Ex: 20" />
        </div>
        <div>
          <Label htmlFor="dueDay">Dia de vencimento</Label>
          <Input id="dueDay" name="dueDay" type="number" min={1} max={31} placeholder="Ex: 28" />
        </div>
        <div className="col-span-2">
          <FieldError>{state?.error}</FieldError>
          <div className="flex gap-2 mt-1">
            <Button type="submit" size="sm" loading={pending}>
              Salvar cartão
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
