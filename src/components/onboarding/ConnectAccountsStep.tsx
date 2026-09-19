"use client";

import { useActionState, useState } from "react";
import { Landmark, CreditCard as CreditCardIcon, TrendingUp, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { createBankAccountAction, createCreditCardAction, type ContaFormState, type CreditCardFormState } from "@/app/(app)/conta/actions";
import { createInvestmentAction, type InvestimentosFormState } from "@/app/(app)/investimentos/actions";

type Kind = "account" | "card" | "investment";

/**
 * O passo "obrigatório" pedido pelo Thiago entre o Perfil Desbloqueado e a
 * Curva de aposentadoria: antes de ver a curva, a pessoa adiciona pelo menos
 * uma conta, cartão ou investimento de verdade — pra curva já nascer mais
 * precisa, em vez de só com o que ela contou por texto na conversa.
 *
 * Escopo desta primeira versão: os 3 cadastros rápidos (conta, cartão,
 * investimento) acontecem aqui mesmo, sem sair do onboarding. Subir um
 * extrato pra leitura por IA continua disponível, mas em Conta/Investimentos
 * (link abre em nova aba) — embutir o fluxo de upload + revisão inteiro
 * aqui dentro ficaria maior que o resto do onboarding, e ele sempre exige
 * uma conta/cartão/corretora já existente como destino, então já está coberto
 * pelos 3 cadastros rápidos acima.
 */
export function ConnectAccountsStep({ onDone }: { onDone: () => void }) {
  const [addedAny, setAddedAny] = useState(false);
  const [open, setOpen] = useState<Kind | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cardDone, setCardDone] = useState(false);
  const [investmentDone, setInvestmentDone] = useState(false);

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400 mb-3">Quase lá</p>
      <h2 className="font-display font-bold text-2xl text-onbrand mb-2">Vamos conectar suas contas</h2>
      <p className="text-sm text-onbrand/70 leading-relaxed mb-6 max-w-sm">
        Adicione ao menos uma conta, cartão ou investimento — isso deixa sua curva de aposentadoria bem mais precisa
        do que só o que você me contou até aqui.
      </p>

      <div className="w-full space-y-2.5 text-left">
        <QuickAddCard
          icon={Landmark}
          label="Conta bancária"
          done={accountId !== null}
          isOpen={open === "account"}
          onToggle={() => setOpen(open === "account" ? null : "account")}
        >
          <BankAccountForm
            onSuccess={(id) => {
              setAccountId(id);
              setAddedAny(true);
              setOpen(null);
            }}
          />
        </QuickAddCard>

        <QuickAddCard
          icon={CreditCardIcon}
          label="Cartão de crédito"
          done={cardDone}
          isOpen={open === "card"}
          onToggle={() => setOpen(open === "card" ? null : "card")}
        >
          {accountId ? (
            <CreditCardForm
              bankAccountId={accountId}
              onSuccess={() => {
                setCardDone(true);
                setAddedAny(true);
                setOpen(null);
              }}
            />
          ) : (
            <p className="text-xs text-onbrand/55 py-2">
              Adicione uma conta bancária primeiro — todo cartão fica ligado à conta que paga a fatura.
            </p>
          )}
        </QuickAddCard>

        <QuickAddCard
          icon={TrendingUp}
          label="Investimento"
          done={investmentDone}
          isOpen={open === "investment"}
          onToggle={() => setOpen(open === "investment" ? null : "investment")}
        >
          <InvestmentForm
            onSuccess={() => {
              setInvestmentDone(true);
              setAddedAny(true);
              setOpen(null);
            }}
          />
        </QuickAddCard>
      </div>

      <a
        href="/conta"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-onbrand/45 hover:text-onbrand/70 underline mt-4"
      >
        Prefiro subir um extrato agora (abre em outra aba)
      </a>

      <Button
        variant="secondary"
        size="lg"
        className="mt-6"
        disabled={!addedAny}
        onClick={onDone}
      >
        Ver minha curva de aposentadoria
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
      {!addedAny && (
        <p className="text-[11px] text-onbrand/40 mt-2">Adicione pelo menos um item acima para continuar.</p>
      )}
    </div>
  );
}

function QuickAddCard({
  icon: Icon,
  label,
  done,
  isOpen,
  onToggle,
  children,
}: {
  icon: typeof Landmark;
  label: string;
  done: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-brand-800 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-onbrand"
      >
        {done ? (
          <span className="h-5 w-5 rounded-full bg-ok-400/20 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-ok-400" />
          </span>
        ) : (
          <Icon className="h-4 w-4 text-onbrand/50 shrink-0" />
        )}
        <span className="flex-1 text-left">{label}</span>
        <span className="text-xs text-gold-400 font-medium">{isOpen ? "fechar" : "adicionar"}</span>
      </button>
      {isOpen && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  );
}

function BankAccountForm({ onSuccess }: { onSuccess: (accountId: string) => void }) {
  const [state, formAction, pending] = useActionState<ContaFormState, FormData>(createBankAccountAction, undefined);

  return (
    <form action={formAction} className="space-y-2.5 pt-1">
      <div>
        <Label htmlFor="onb-acc-name">Nome da conta</Label>
        <Input id="onb-acc-name" name="name" placeholder="Ex: Conta corrente" required />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor="onb-acc-bank">Banco (opcional)</Label>
          <Input id="onb-acc-bank" name="bankName" placeholder="Ex: Itaú" />
        </div>
        <div>
          <Label htmlFor="onb-acc-type">Tipo</Label>
          <Select id="onb-acc-type" name="type" defaultValue="CHECKING">
            <option value="CHECKING">Conta corrente</option>
            <option value="SAVINGS">Poupança</option>
            <option value="WALLET">Carteira digital</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="onb-acc-balance">Saldo atual (opcional)</Label>
        <CurrencyInput id="onb-acc-balance" name="balance" />
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="sm" loading={pending}>
        Salvar conta
      </Button>
      {state?.success && state.accountId && <SuccessAdvance onAdvance={() => onSuccess(state.accountId!)} />}
    </form>
  );
}

/**
 * Pequeno "efeito colateral declarativo": em vez de useEffect, dispara o
 * callback de sucesso assim que este marcador aparece no DOM (ele só
 * aparece quando `state?.success` vira true, ou seja, exatamente uma vez
 * por submit bem-sucedido).
 */
function SuccessAdvance({ onAdvance }: { onAdvance: () => void }) {
  if (typeof window !== "undefined") queueMicrotask(onAdvance);
  return null;
}

function CreditCardForm({ bankAccountId, onSuccess }: { bankAccountId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<CreditCardFormState, FormData>(createCreditCardAction, undefined);

  return (
    <form action={formAction} className="space-y-2.5 pt-1">
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <div>
        <Label htmlFor="onb-card-nickname">Apelido do cartão</Label>
        <Input id="onb-card-nickname" name="nickname" placeholder="Ex: Cartão principal" required />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor="onb-card-limit">Limite (opcional)</Label>
          <CurrencyInput id="onb-card-limit" name="limitAmount" />
        </div>
        <div>
          <Label htmlFor="onb-card-due">Dia de vencimento</Label>
          <Input id="onb-card-due" name="dueDay" type="number" min={1} max={31} placeholder="Ex: 10" />
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="sm" loading={pending}>
        Salvar cartão
      </Button>
      {state?.success && <SuccessAdvance onAdvance={onSuccess} />}
    </form>
  );
}

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

function InvestmentForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<InvestimentosFormState, FormData>(createInvestmentAction, undefined);

  return (
    <form action={formAction} className="space-y-2.5 pt-1">
      <div>
        <Label htmlFor="onb-inv-name">Nome</Label>
        <Input id="onb-inv-name" name="name" placeholder="Ex: Tesouro Selic 2029" required />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor="onb-inv-type">Tipo</Label>
          <Select id="onb-inv-type" name="type" defaultValue="FIXED_INCOME">
            {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="onb-inv-amount">Valor investido</Label>
          <CurrencyInput id="onb-inv-amount" name="investedAmount" required />
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="sm" loading={pending}>
        Salvar investimento
      </Button>
      {state?.success && <SuccessAdvance onAdvance={onSuccess} />}
    </form>
  );
}
