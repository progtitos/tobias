"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, History, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { maskCPF, maskPhone } from "@/lib/utils/mask";
import { deleteAccountAction } from "./actions";

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

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Período de teste",
  BASIC: "Plano Básico",
  PREMIUM: "Plano Premium",
  FAMILY: "Plano Família",
};

export function SettingsClient({ user }: { user: SettingsUser }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full space-y-6">
      <h1 className="font-serif text-2xl text-brand-950">Configurações</h1>

      <Card>
        <CardContent className="py-5 space-y-3">
          <h2 className="font-serif text-lg text-brand-950 mb-1">Sua conta</h2>
          <Row label="Nome" value={user.name} />
          <Row label="E-mail" value={user.email} />
          <Row label="CPF" value={maskCPF(user.cpf) ?? "Não informado"} />
          <Row label="Telefone" value={maskPhone(user.phone) ?? "Não informado"} />
          <Row label="Cliente desde" value={new Date(user.memberSince).toLocaleDateString("pt-BR")} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-ink-500">Plano</span>
            <Badge tone={user.subscriptionStatus === "TRIALING" ? "gold" : "brand"}>
              {PLAN_LABELS[user.subscriptionPlan] ?? user.subscriptionPlan}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 space-y-1">
          <h2 className="font-serif text-lg text-brand-950 mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-800" /> Privacidade e segurança
          </h2>
          <SettingsLink href="/settings/activity" icon={History} label="Ver atividade recente da sua conta" />
          <SettingsLink href="/legal/privacidade" icon={FileText} label="Política de privacidade" />
          <SettingsLink href="/legal/termos" icon={FileText} label="Termos de uso" />
        </CardContent>
      </Card>

      <Card className="border-danger-600/30">
        <CardContent className="py-5 space-y-3">
          <h2 className="font-serif text-lg text-danger-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Zona de risco
          </h2>
          <p className="text-sm text-ink-600">
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
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 font-medium">{value}</span>
    </div>
  );
}

function SettingsLink({ href, icon: Icon, label }: { href: string; icon: typeof History; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 py-2 text-sm text-ink-700 hover:text-brand-900">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
