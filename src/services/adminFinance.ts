import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, financialEvents } from "@/lib/db/schema";
import { PRICING_PLANS, type BillingCycle } from "@/lib/billing/plans";
import { getPlanCycleActiveMap, setPlanCycleActive } from "./billingPlans";
import { getMercadoPagoAccessToken, getPreApprovalClient } from "@/lib/mercadopago/client";
import { markSubscriptionActive, markSubscriptionCanceled } from "./subscription";

// ============================================================================
// Admin › Financeiro (pedido do Thiago, 2026-09-30: "maior controle possível
// sobre... graficos, planos"). Importante deixar registrado o que este
// arquivo NÃO inventa: não existe hoje uma tabela de cobranças com valor por
// evento (só o status atual em `users` + um log de eventos sem valor em
// `financial_events`), então nenhum número aqui é um valor de R$ fabricado
// para um mês passado. O MRR é calculado ao vivo (assinantes ativos agora ×
// preço do ciclo deles); a série mensal conta EVENTOS reais de cobrança
// confirmada/falha (não R$), o que é uma leitura honesta do que o sistema de
// fato registra.
// ============================================================================

export type PlanCatalogRow = {
  cycle: BillingCycle;
  label: string;
  priceLabel: string;
  monthlyEquivalentLabel: string;
  activeSubscribers: number;
  active: boolean;
};

export type FinanceOverview = {
  mrr: number;
  activeSubscribers: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  plans: PlanCatalogRow[];
};

/**
 * MRR + catálogo de planos com o número de assinantes ativos em cada ciclo.
 *
 * ne(role, "ADMIN") em toda query de usuário (pedido do Thiago, 01/10/2026):
 * uma conta de staff pode carregar plano/status de assinatura reais —
 * histórico de antes de virar admin (ex.: a própria conta do Thiago), ou o
 * valor padrão de criação de uma conta nova pelo admin — mas não é receita
 * de verdade. Sem esse filtro, uma única conta admin "ACTIVE" já entra no
 * MRR e na contagem de assinantes ativos como se fosse um cliente pagante.
 */
export async function getFinanceOverview(): Promise<FinanceOverview> {
  const [activeByCycle, statusCounts, activeMap] = await Promise.all([
    db
      .select({ cycle: users.planBillingCycle, n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.subscriptionStatus, "ACTIVE"), isNull(users.deletedAt), ne(users.role, "ADMIN")))
      .groupBy(users.planBillingCycle),
    db
      .select({ status: users.subscriptionStatus, n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(isNull(users.deletedAt), ne(users.role, "ADMIN")))
      .groupBy(users.subscriptionStatus),
    getPlanCycleActiveMap(),
  ]);

  const subscribersByCycle = new Map<BillingCycle, number>();
  for (const row of activeByCycle) {
    if (row.cycle) subscribersByCycle.set(row.cycle, row.n);
  }

  let mrr = 0;
  const plans: PlanCatalogRow[] = PRICING_PLANS.map((plan) => {
    const activeSubscribers = subscribersByCycle.get(plan.cycle) ?? 0;
    mrr += activeSubscribers * (plan.price / plan.months);
    return {
      cycle: plan.cycle,
      label: plan.label,
      priceLabel: plan.priceLabel,
      monthlyEquivalentLabel: plan.monthlyEquivalentLabel,
      activeSubscribers,
      active: activeMap[plan.cycle],
    };
  });

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.n]));

  return {
    mrr,
    activeSubscribers: byStatus["ACTIVE"] ?? 0,
    trialing: byStatus["TRIALING"] ?? 0,
    pastDue: byStatus["PAST_DUE"] ?? 0,
    canceled: byStatus["CANCELED"] ?? 0,
    plans,
  };
}

export async function togglePlanCycle(cycle: BillingCycle, active: boolean) {
  await setPlanCycleActive(cycle, active);
}

const CHARGE_EVENT_TYPES = ["mp_subscription_charged", "mp_subscription_payment_failed"] as const;

export type MonthlyChargeCounts = { month: string; label: string; charged: number; failed: number };

/**
 * Últimos `months` meses de eventos de cobrança confirmada vs. falha, um por
 * usuário-cobrança (não é receita em R$ — ver nota no topo do arquivo).
 */
export async function getMonthlyChargeEvents(months = 12): Promise<MonthlyChargeCounts[]> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));

  const rows = await db
    .select({ type: financialEvents.type, createdAt: financialEvents.createdAt })
    .from(financialEvents)
    .where(and(inArray(financialEvents.type, [...CHARGE_EVENT_TYPES]), gte(financialEvents.createdAt, since)));

  const buckets = new Map<string, { charged: number; failed: number }>();
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { charged: 0, failed: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const row of rows) {
    const key = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.type === "mp_subscription_charged") bucket.charged += 1;
    else bucket.failed += 1;
  }

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
  return [...buckets.entries()].map(([month, counts]) => {
    const [year, m] = month.split("-").map(Number);
    return { month, label: `${monthLabel.format(new Date(Date.UTC(year, m - 1, 1)))}`, ...counts };
  });
}

export type PastDuePayment = {
  userId: string;
  name: string;
  email: string;
  planBillingCycle: BillingCycle | null;
  failedAt: Date | null;
};

/** Assinantes com cobrança em atraso (`subscriptionStatus = "PAST_DUE"`). */
export async function getPastDuePayments(): Promise<PastDuePayment[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      planBillingCycle: users.planBillingCycle,
    })
    .from(users)
    .where(and(eq(users.subscriptionStatus, "PAST_DUE"), isNull(users.deletedAt), ne(users.role, "ADMIN")))
    .orderBy(desc(users.updatedAt));

  if (rows.length === 0) return [];

  const failureEvents = await db
    .select({ userId: financialEvents.userId, createdAt: financialEvents.createdAt })
    .from(financialEvents)
    .where(
      and(
        eq(financialEvents.type, "mp_subscription_payment_failed"),
        inArray(
          financialEvents.userId,
          rows.map((r) => r.id)
        )
      )
    )
    .orderBy(desc(financialEvents.createdAt));

  const latestFailureByUser = new Map<string, Date>();
  for (const ev of failureEvents) {
    if (!latestFailureByUser.has(ev.userId)) latestFailureByUser.set(ev.userId, ev.createdAt);
  }

  return rows.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    planBillingCycle: r.planBillingCycle,
    failedAt: latestFailureByUser.get(r.id) ?? null,
  }));
}

export type RecheckResult = {
  changed: boolean;
  newStatus: string;
  detail: string;
};

/**
 * "Verificar novamente" no admin: não existe API do Mercado Pago pra forçar a
 * re-tentativa de uma cobrança recusada especificamente (isso depende da
 * pessoa atualizar o cartão, algo que só ela pode fazer). O que dá pra fazer
 * de verdade é perguntar pro MP o estado atual da assinatura e do histórico
 * de cobrança (`summarized`) e refletir aqui:
 * - se o MP já cancelou a assinatura (ex.: depois de N tentativas seguidas),
 *   sincroniza pra CANCELED aqui também;
 * - se o MP mostra uma cobrança bem-sucedida mais recente que a última falha
 *   que a gente registrou, a pessoa já resolveu por conta própria (trocou o
 *   cartão pelo e-mail do MP) — sincroniza pra ACTIVE;
 * - caso contrário, devolve o status real (com a data da próxima tentativa)
 *   sem fingir ter resolvido nada.
 */
export async function recheckPastDuePayment(userId: string): Promise<RecheckResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.mpPreapprovalId) {
    return { changed: false, newStatus: "PAST_DUE", detail: "Este usuário não tem assinatura no Mercado Pago." };
  }

  const preapproval = await getPreApprovalClient().get({ id: user.mpPreapprovalId });

  if (preapproval.status === "cancelled") {
    await markSubscriptionCanceled(user.mpPreapprovalId);
    return { changed: true, newStatus: "CANCELED", detail: "O Mercado Pago já tinha cancelado esta assinatura." };
  }

  const lastFailure = (
    await db
      .select({ createdAt: financialEvents.createdAt })
      .from(financialEvents)
      .where(and(eq(financialEvents.userId, userId), eq(financialEvents.type, "mp_subscription_payment_failed")))
      .orderBy(desc(financialEvents.createdAt))
      .limit(1)
  )[0]?.createdAt;

  const lastChargedDate = preapproval.summarized?.last_charged_date
    ? new Date(preapproval.summarized.last_charged_date)
    : null;

  if (lastChargedDate && (!lastFailure || lastChargedDate > lastFailure)) {
    await markSubscriptionActive(user.mpPreapprovalId);
    return { changed: true, newStatus: "ACTIVE", detail: "O Mercado Pago já confirmou uma cobrança mais recente." };
  }

  const nextAttempt = preapproval.next_payment_date
    ? new Date(preapproval.next_payment_date).toLocaleDateString("pt-BR")
    : "não informada pelo Mercado Pago";

  return {
    changed: false,
    newStatus: "PAST_DUE",
    detail: `Ainda em atraso (status no Mercado Pago: ${preapproval.status ?? "desconhecido"}). Próxima tentativa: ${nextAttempt}.`,
  };
}

export type MercadoPagoSyncStatus = {
  configured: boolean;
  lastWebhookEventAt: Date | null;
};

export async function getMercadoPagoSyncStatus(): Promise<MercadoPagoSyncStatus> {
  let configured = true;
  try {
    getMercadoPagoAccessToken();
  } catch {
    configured = false;
  }

  const [lastEvent] = await db
    .select({ createdAt: financialEvents.createdAt })
    .from(financialEvents)
    .where(sql`${financialEvents.type} LIKE 'mp_%'`)
    .orderBy(desc(financialEvents.createdAt))
    .limit(1);

  return { configured, lastWebhookEventAt: lastEvent?.createdAt ?? null };
}
