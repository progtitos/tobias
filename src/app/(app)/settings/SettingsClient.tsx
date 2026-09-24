"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, History, FileText, MessageCircle, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, FieldError } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { maskCPF, maskPhone } from "@/lib/utils/mask";
import type { Theme } from "@/lib/theme";
import {
  deleteAccountAction,
  cancelSubscriptionAction,
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  type ConnectWhatsAppState,
} from "./actions";

// A subscription can only be canceled from here while it's actually
// costing (or about to cost) money — PENDING_PAYMENT never got a
// preapproval far enough along to cancel, and CANCELED/EXPIRED already are.
const CANCELABLE_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"];

type SettingsUser = {
  name: string;
  email: string;
  cpf: string | null;
  phone: string | null;
  memberSince: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string;
};

type WhatsAppConnection = { phone: string; verified: boolean } | null;

// Kept in sync with subscriptionPlanEnum in src/lib/db/schema.ts — this had
// drifted to a set of labels (BASIC/PREMIUM/FAMILY) that no longer matched
// the actual enum values, so every real subscriber saw the raw enum string
// instead of a label.
const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Período de teste",
  TOBIAS: "Plano Tobias",
  TOBIAS_PRO: "Tobias Pro",
  TOBIAS_FAMILIA: "Tobias Família",
  TOBIAS_PLANNER: "Tobias Planner",
};

export function SettingsClient({
  user,
  whatsapp,
  theme,
}: {
  user: SettingsUser;
  whatsapp: WhatsAppConnection;
  theme: Theme;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | undefined>();

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
      <h1 className="font-sans font-bold text-2xl text-onbrand">Configurações</h1>

      <Card>
        <CardContent className="py-6 space-y-5">
          {/* Cabeçalho maior de propósito — pedido do Thiago (2026-09-20):
              "aumentar também aonde aparece o perfil dele para verificar as
              informações". Antes era uma lista compacta de linhas
              nome/e-mail/CPF, fácil de bater o olho e não confirmar nada de
              verdade; agora nome + e-mail abrem a seção em destaque (com um
              círculo de iniciais), e os demais dados vêm num grid maior,
              cada um com o rótulo em cima do valor em vez de lado a lado. */}
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-full bg-gold-400/15 flex items-center justify-center">
              <span className="font-display font-semibold text-lg text-gold-400">{initials(user.name)}</span>
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-xl text-onbrand truncate">{user.name}</p>
              <p className="text-sm text-onbrand/55 truncate">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-cream-200/10">
            <Field label="CPF" value={maskCPF(user.cpf) ?? "Não informado"} className="pt-4" />
            <Field label="Telefone" value={maskPhone(user.phone) ?? "Não informado"} className="pt-4" />
            <Field label="Cliente desde" value={new Date(user.memberSince).toLocaleDateString("pt-BR")} />
            <div className="pt-0">
              <p className="text-xs uppercase tracking-wide text-onbrand/40 mb-1">Plano</p>
              <Badge tone={user.subscriptionStatus === "TRIALING" ? "gold" : "brand"} className="text-sm px-3 py-1">
                {PLAN_LABELS[user.subscriptionPlan] ?? user.subscriptionPlan}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 space-y-3">
          <h2 className="font-display font-semibold text-lg text-onbrand mb-1 flex items-center gap-2">
            <Palette className="h-4 w-4 text-gold-400" /> Aparência
          </h2>
          <p className="text-sm text-onbrand/65">
            Escolha entre o tema claro ou escuro do app. O escolhido vale só para você.
          </p>
          <ThemeToggle current={theme} />
        </CardContent>
      </Card>

      {CANCELABLE_STATUSES.includes(user.subscriptionStatus) && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <h2 className="font-display font-semibold text-lg text-onbrand mb-1">Assinatura</h2>
            <p className="text-sm text-onbrand/65">
              Cancelar interrompe as próximas cobranças no Mercado Pago. Você continua com acesso até o fim do
              período já pago.
            </p>
            {!confirmingCancel ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(true)}>
                Cancelar assinatura
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={cancelPending}
                  onClick={() =>
                    startCancelTransition(async () => {
                      const result = await cancelSubscriptionAction();
                      if (result?.error) {
                        setCancelError(result.error);
                      } else {
                        setConfirmingCancel(false);
                      }
                    })
                  }
                >
                  Sim, cancelar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(false)}>
                  Voltar
                </Button>
              </div>
            )}
            <FieldError>{cancelError}</FieldError>
          </CardContent>
        </Card>
      )}

      <WhatsAppCard whatsapp={whatsapp} />

      <Card>
        <CardContent className="py-5 space-y-1">
          <h2 className="font-display font-semibold text-lg text-onbrand mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold-400" /> Privacidade e segurança
          </h2>
          <SettingsLink href="/settings/activity" icon={History} label="Ver atividade recente da sua conta" />
          <SettingsLink href="/legal/privacidade" icon={FileText} label="Política de privacidade" />
          <SettingsLink href="/legal/termos" icon={FileText} label="Termos de uso" />
        </CardContent>
      </Card>

      <Card className="border-danger-600/40">
        <CardContent className="py-5 space-y-3">
          <h2 className="font-display font-semibold text-lg text-danger-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Zona de risco
          </h2>
          <p className="text-sm text-onbrand/65">
            Excluir sua conta apaga permanentemente seu perfil, gastos, objetivos, conversas com o Tobias e todo o
            resto dos seus dados financeiros. Essa ação não pode ser desfeita.
          </p>

          {!confirmingDelete ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Excluir minha conta
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <form action={deleteAccountAction}>
                <Button variant="danger" size="sm" type="submit">
                  Sim, excluir permanentemente
                </Button>
              </form>
              <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-onbrand/40 mb-1">{label}</p>
      <p className="text-base text-onbrand font-medium">{value}</p>
    </div>
  );
}

// Primeira letra do primeiro e do último nome — pra caber sem quebrar no
// círculo de 56px do cabeçalho do card "Sua conta".
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function SettingsLink({ href, icon: Icon, label }: { href: string; icon: typeof History; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 py-2 text-sm text-onbrand/70 hover:text-gold-400">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function WhatsAppCard({ whatsapp }: { whatsapp: WhatsAppConnection }) {
  const [state, formAction, pending] = useActionState<ConnectWhatsAppState, FormData>(connectWhatsAppAction, undefined);
  const [disconnectPending, startDisconnectTransition] = useTransition();

  return (
    <Card>
      <CardContent className="py-5 space-y-3">
        <h2 className="font-display font-semibold text-lg text-onbrand mb-1 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold-400" /> WhatsApp
        </h2>

        {!whatsapp && (
          <>
            <p className="text-sm text-onbrand/65">
              Conecte seu número para conversar com o Tobias direto pelo WhatsApp, do mesmo jeito que no app.
            </p>
            <form action={formAction} className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px] space-y-1">
                <label htmlFor="whatsapp-phone" className="text-xs text-onbrand/55">
                  Número (com DDI)
                </label>
                <Input id="whatsapp-phone" name="phone" placeholder="+5511999999999" />
              </div>
              <Button type="submit" size="sm" loading={pending}>
                Enviar código
              </Button>
            </form>
            <FieldError>{state?.error}</FieldError>
          </>
        )}

        {whatsapp && !whatsapp.verified && (
          <>
            <p className="text-sm text-onbrand/65">
              Enviamos um código de verificação para <span className="text-onbrand">{maskPhone(whatsapp.phone)}</span>.
              Responda a mensagem no WhatsApp com o código para confirmar.
            </p>
            <Button
              variant="outline"
              size="sm"
              loading={disconnectPending}
              onClick={() => startDisconnectTransition(() => disconnectWhatsAppAction())}
            >
              Cancelar e tentar outro número
            </Button>
          </>
        )}

        {whatsapp?.verified && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="brand">Conectado</Badge>
              <span className="text-sm text-onbrand/70">{maskPhone(whatsapp.phone)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={disconnectPending}
              onClick={() => startDisconnectTransition(() => disconnectWhatsAppAction())}
            >
              Desconectar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
