"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X, Pause, Play, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBRL } from "@/lib/utils/money";
import {
  createBankAccountAction,
  updateBankAccountBalanceAction,
  toggleBankAccountActiveAction,
  deleteBankAccountAction,
  type ContaFormState,
} from "./actions";

type BankAccount = {
  id: string;
  name: string;
  bankName: string | null;
  type: string;
  balance: number;
  isActive: boolean;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Conta investimento",
  WALLET: "Carteira digital",
};

export function ContaClient({ accounts }: { accounts: BankAccount[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState<ContaFormState, FormData>(createBankAccountAction, undefined);
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="font-sans font-bold text-2xl text-cream-50 mb-1">Suas contas</h1>
        <p className="text-sm text-cream-50/55 mb-6">
          Contas bancárias e carteiras digitais. O saldo delas alimenta seu patrimônio líquido, a reserva de
          emergência e o Ponteiro — e pode ser ligado direto a uma transação em Lançamentos.
        </p>

        <Card className="mb-6">
          <CardContent className="py-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-cream-50/60 mb-0.5">Saldo em contas</p>
              <p className="font-sans font-medium text-3xl tracking-tight tabular-nums text-cream-50">
                {formatBRL(totalBalance)}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </CardContent>
        </Card>

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
