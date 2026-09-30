"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { formatBRL } from "@/lib/utils/money";
import { formatDate } from "../../adminFormat";
import type { BillingCycle } from "@/lib/billing/plans";
import type { PlanCatalogRow, PastDuePayment, MonthlyChargeCounts, MercadoPagoSyncStatus } from "@/services/adminFinance";
import { togglePlanCycleAction, recheckPastDuePaymentAction } from "./actions";

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "gold" | "danger" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wide text-onbrand/50 mb-1">{label}</p>
        <p
          className={`font-sans font-semibold text-2xl tabular-nums ${
            tone === "gold" ? "text-gold-400" : tone === "danger" ? "text-danger-300" : "text-onbrand"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function PlanRow({ plan }: { plan: PlanCatalogRow }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 even:bg-onbrand/[0.03]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-onbrand">{plan.label}</p>
        <p className="text-xs text-onbrand/50 truncate">
          {plan.priceLabel} · {plan.monthlyEquivalentLabel} · {plan.activeSubscribers} assinante(s) ativo(s)
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-onbrand/45 hidden sm:inline">{plan.active ? "Visível no cadastro" : "Oculto"}</span>
        <Switch
          checked={plan.active}
          disabled={pending}
          label={`${plan.active ? "Desativar" : "Ativar"} ciclo ${plan.label}`}
          onChange={(next) =>
            startTransition(async () => {
              try {
                await togglePlanCycleAction(plan.cycle as BillingCycle, next);
                toast.success(next ? `${plan.label} voltou a aparecer no cadastro.` : `${plan.label} foi ocultado do cadastro.`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Falha ao atualizar o plano.");
              }
            })
          }
        />
      </div>
    </div>
  );
}

const CYCLE_LABEL: Record<string, string> = { MENSAL: "Mensal", SEMESTRAL: "Semestral", ANUAL: "Anual" };

function PastDueRow({ payment }: { payment: PastDuePayment }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-t border-onbrand/[0.06]">
      <td className="py-2.5 pr-3">
        <p className="text-sm text-onbrand">{payment.name}</p>
        <p className="text-xs text-onbrand/50">{payment.email}</p>
      </td>
      <td className="py-2.5 pr-3 text-sm text-onbrand/70">
        {payment.planBillingCycle ? CYCLE_LABEL[payment.planBillingCycle] : "-"}
      </td>
      <td className="py-2.5 pr-3 text-sm text-onbrand/70 tabular-nums">
        {payment.failedAt ? formatDate(payment.failedAt) : "não registrado"}
      </td>
      <td className="py-2.5 text-right">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await recheckPastDuePaymentAction(payment.userId);
                if (result.changed) toast.success(result.detail);
                else toast(result.detail);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Falha ao verificar no Mercado Pago.");
              }
            })
          }
        >
          Verificar novamente
        </Button>
      </td>
    </tr>
  );
}

function MonthlyChargesChart({ data }: { data: MonthlyChargeCounts[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,246,245,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "rgba(245,246,245,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "rgba(245,246,245,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(245,246,245,0.04)" }}
            contentStyle={{
              background: "#1b2126",
              border: "1px solid rgba(245,246,245,0.1)",
              borderRadius: 8,
              fontSize: 12,
              color: "#f5f6f5",
            }}
            labelFormatter={(label) => `Mês: ${label}`}
            formatter={(value, name) => [String(value), name === "charged" ? "Cobranças confirmadas" : "Cobranças com falha"]}
          />
          <Bar dataKey="charged" fill="#5ecbb8" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="failed" fill="#f08a72" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceiroClient({
  mrr,
  activeSubscribers,
  trialing,
  pastDueCount,
  canceled,
  plans,
  monthlySeries,
  pastDue,
  syncStatus,
}: {
  mrr: number;
  activeSubscribers: number;
  trialing: number;
  pastDueCount: number;
  canceled: number;
  plans: PlanCatalogRow[];
  monthlySeries: MonthlyChargeCounts[];
  pastDue: PastDuePayment[];
  syncStatus: MercadoPagoSyncStatus;
}) {
  return (
    <div>
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Financeiro</h1>
      <p className="text-sm text-onbrand/55 mb-6">
        MRR calculado ao vivo (assinantes ativos agora × preço do ciclo deles). O gráfico mensal conta eventos de
        cobrança confirmada/falha, não é uma série histórica de valores em R$: hoje o sistema não guarda o valor de
        cada cobrança individual, só o status atual de cada assinante.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatTile label="MRR (receita recorrente)" value={formatBRL(mrr)} tone="gold" />
        <StatTile label="Assinantes ativos" value={String(activeSubscribers)} />
        <StatTile label="Em trial" value={String(trialing)} />
        <StatTile label="Pagamento em atraso" value={String(pastDueCount)} tone={pastDueCount > 0 ? "danger" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <h2 className="font-sans font-semibold text-onbrand mb-1">Planos</h2>
            <p className="text-xs text-onbrand/50 mb-2">
              Desativar um ciclo só tira ele do cadastro de novos assinantes, quem já assina continua normalmente.
            </p>
            <div className="flex flex-col">
              {plans.map((plan) => (
                <PlanRow key={plan.cycle} plan={plan} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h2 className="font-sans font-semibold text-onbrand mb-1">Sincronização com o Mercado Pago</h2>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${syncStatus.configured ? "bg-ok-400" : "bg-danger-300"}`}
                aria-hidden
              />
              <p className="text-sm text-onbrand/80">
                {syncStatus.configured ? "Credenciais configuradas" : "MERCADOPAGO_ACCESS_TOKEN não configurado"}
              </p>
            </div>
            <p className="text-sm text-onbrand/70 mt-2">
              Último evento de webhook recebido:{" "}
              <span className="text-onbrand tabular-nums">
                {syncStatus.lastWebhookEventAt ? formatDate(syncStatus.lastWebhookEventAt) : "nenhum registrado ainda"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <h2 className="font-sans font-semibold text-onbrand mb-3">Cobranças confirmadas x com falha (últimos 12 meses)</h2>
          <MonthlyChargesChart data={monthlySeries} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h2 className="font-sans font-semibold text-onbrand mb-1">Pagamentos em atraso</h2>
          <p className="text-xs text-onbrand/50 mb-3">
            Não existe API para forçar uma nova tentativa de cobrança, isso depende da pessoa atualizar o cartão.
            &quot;Verificar novamente&quot; consulta o status real no Mercado Pago e atualiza aqui se ela já resolveu por
            conta própria.
          </p>
          {pastDue.length === 0 ? (
            <p className="text-sm text-onbrand/50 py-4 text-center">Nenhum pagamento em atraso agora.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-onbrand/45">
                    <th className="pb-2 font-medium">Assinante</th>
                    <th className="pb-2 font-medium">Ciclo</th>
                    <th className="pb-2 font-medium">Em atraso desde</th>
                    <th className="pb-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pastDue.map((p) => (
                    <PastDueRow key={p.userId} payment={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canceled > 0 && (
        <p className="text-xs text-onbrand/40 mt-4">{canceled} assinatura(s) cancelada(s) ao todo (histórico, não contam no MRR).</p>
      )}
    </div>
  );
}
