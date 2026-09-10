import "server-only";
import { and, eq, gte, desc, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, transactions, subscriptions, categories, financialProfiles } from "@/lib/db/schema";
import { monthRange, computeEmergencyReserve, activeGoals } from "./aggregations";
import { getCurrentBudgetsWithActuals } from "./budget";
import { trackEvent } from "./analytics";
import { formatBRL } from "@/lib/utils/money";

// ============================================================================
// Notification Agent — rule-based behavior checks (spec §21/§29).
//
// This is deliberately NOT AI-generated: every alert here comes from a fixed,
// auditable rule over real DB data, so "why did Tobias tell me this" always
// has a concrete, reproducible answer. AIService can later phrase these more
// naturally, but the trigger and the numbers always come from here.
//
// Dedup: each detector attaches a `dedupeKey` to relatedData, and we skip
// creating a new alert if a non-dismissed alert with the same type+key was
// already raised recently — so re-running this on every dashboard load never
// spams the user with the same finding.
// ============================================================================

type AlertType =
  | "BUDGET_OVERRUN"
  | "SUBSCRIPTION_INCREASE"
  | "INSTALLMENT_ENDING"
  | "CONTRIBUTION_MISSING"
  | "RESERVE_NEAR_TARGET"
  | "GOAL_DELAYED";

type Severity = "INFO" | "WARNING" | "CRITICAL";

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

async function alreadyAlerted(userId: string, type: AlertType, dedupeKey: string, withinDays: number): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ relatedData: alerts.relatedData })
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.type, type), eq(alerts.isDismissed, false), gte(alerts.createdAt, since)));
  return rows.some((r) => (r.relatedData as { dedupeKey?: string } | null)?.dedupeKey === dedupeKey);
}

async function raiseAlert(
  userId: string,
  type: AlertType,
  severity: Severity,
  message: string,
  dedupeKey: string,
  withinDays: number,
  extra?: Record<string, unknown>
): Promise<boolean> {
  if (await alreadyAlerted(userId, type, dedupeKey, withinDays)) return false;
  await db.insert(alerts).values({ userId, type, severity, message, relatedData: { dedupeKey, ...extra } });
  await trackEvent(userId, "alert_generated", { type });
  return true;
}

async function checkBudgetOverruns(userId: string) {
  const budgets = await getCurrentBudgetsWithActuals(userId);
  const key = monthKey();
  for (const b of budgets) {
    if (!b.isOverrun) continue;
    await raiseAlert(
      userId,
      "BUDGET_OVERRUN",
      "WARNING",
      `Você já gastou ${formatBRL(b.actual)} em ${b.label} este mês, passando do limite de ${formatBRL(b.limitAmount)}.`,
      `budget:${b.id}:${key}`,
      25,
      { budgetId: b.id }
    );
    await trackEvent(userId, "budget_overrun_detected", { budgetId: b.id });
  }
}

async function checkInstallmentsEnding(userId: string) {
  const { start, end } = monthRange();
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNotNull(transactions.installmentGroupId), gte(transactions.date, start)))
    .orderBy(desc(transactions.date));

  // Keep only the most recent transaction per installment group.
  const latestByGroup = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.installmentGroupId) continue;
    if (!latestByGroup.has(r.installmentGroupId)) latestByGroup.set(r.installmentGroupId, r);
  }

  for (const t of latestByGroup.values()) {
    if (!t.installmentTotal || !t.installmentNumber) continue;
    const remaining = t.installmentTotal - t.installmentNumber;
    if (remaining !== 1) continue;
    if (t.date < start || t.date >= end) continue; // only flag when the last-but-one was charged this month
    await raiseAlert(
      userId,
      "INSTALLMENT_ENDING",
      "INFO",
      `A parcela ${t.installmentNumber}/${t.installmentTotal} de "${t.description}" é a penúltima. No mês que vem sua última parcela libera ${formatBRL(t.amount)}/mês do orçamento.`,
      `installment:${t.installmentGroupId}`,
      35
    );
  }
}

async function checkMissingContribution(userId: string) {
  if (new Date().getDate() < 20) return; // only nag late in the month, once the pattern is clear
  const { start } = monthRange();
  const key = monthKey();
  const goalsList = await activeGoals(userId);

  for (const g of goalsList) {
    if (!g.monthlyContribution || g.monthlyContribution <= 0) continue;
    const contributions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.goalId, g.id),
          eq(transactions.type, "INVESTMENT_CONTRIBUTION"),
          gte(transactions.date, start)
        )
      )
      .limit(1);
    if (contributions.length > 0) continue;

    await raiseAlert(
      userId,
      "CONTRIBUTION_MISSING",
      "WARNING",
      `Ainda não vimos um aporte para "${g.title}" este mês (meta: ${formatBRL(g.monthlyContribution)}/mês).`,
      `goal-contribution:${g.id}:${key}`,
      25,
      { goalId: g.id }
    );
  }
}

async function checkReserveNearTarget(userId: string) {
  const [reserve, fp] = await Promise.all([
    computeEmergencyReserve(userId),
    db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).then((r) => r[0] ?? null),
  ]);
  const essentialExpenses = fp?.statedMonthlyExpenses ?? 0;
  if (essentialExpenses <= 0) return;

  const targetMonths = 6;
  const targetAmount = essentialExpenses * targetMonths;
  const reserveMonths = reserve / essentialExpenses;
  if (reserveMonths < targetMonths * 0.85 || reserveMonths >= targetMonths) return;

  await raiseAlert(
    userId,
    "RESERVE_NEAR_TARGET",
    "INFO",
    `Sua reserva de emergência está quase completa. Faltam ${formatBRL(Math.max(0, targetAmount - reserve))} para atingir ${targetMonths} meses de gastos.`,
    `reserve:${monthKey()}`,
    25
  );
}

async function checkGoalDelayed(userId: string) {
  const key = monthKey();
  const goalsList = await activeGoals(userId);

  for (const g of goalsList) {
    if (!g.targetAmount || !g.targetDate || !g.monthlyContribution || g.monthlyContribution <= 0) continue;
    const monthsRemaining = Math.max(0.1, (g.targetDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000));
    const remainingAmount = Math.max(0, g.targetAmount - g.currentAmount);
    if (remainingAmount <= 0) continue;
    const requiredMonthly = remainingAmount / monthsRemaining;

    if (requiredMonthly <= g.monthlyContribution * 1.15) continue;

    await raiseAlert(
      userId,
      "GOAL_DELAYED",
      "WARNING",
      `No ritmo atual de aportes, "${g.title}" vai atrasar em relação ao prazo. Seria necessário aportar cerca de ${formatBRL(requiredMonthly)}/mês (hoje: ${formatBRL(g.monthlyContribution)}/mês) para chegar até ${g.targetDate.toLocaleDateString("pt-BR")}.`,
      `goal-delayed:${g.id}:${key}`,
      25,
      { goalId: g.id }
    );
  }
}

async function checkSubscriptionIncreases(userId: string) {
  const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      merchant: transactions.merchant,
      amount: transactions.amount,
      date: transactions.date,
      id: transactions.id,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        eq(categories.name, "Assinaturas"),
        isNotNull(transactions.merchant),
        gte(transactions.date, fourMonthsAgo)
      )
    )
    .orderBy(desc(transactions.date));

  const byMerchant = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.merchant) continue;
    const list = byMerchant.get(r.merchant) ?? [];
    list.push(r);
    byMerchant.set(r.merchant, list);
  }

  for (const [merchant, charges] of byMerchant) {
    if (charges.length < 2) continue;
    const [latest, previous] = charges; // already sorted desc by date
    if (latest.amount <= previous.amount * 1.03) continue;

    const raised = await raiseAlert(
      userId,
      "SUBSCRIPTION_INCREASE",
      "WARNING",
      `A assinatura de ${merchant} subiu de ${formatBRL(previous.amount)} para ${formatBRL(latest.amount)}.`,
      `subscription:${merchant}:${latest.id}`,
      60
    );

    if (raised) {
      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.serviceName, merchant)))
        .limit(1);
      if (existing) {
        await db
          .update(subscriptions)
          .set({ amount: latest.amount, lastChargeAmount: previous.amount, lastChargedAt: latest.date, updatedAt: new Date() })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db.insert(subscriptions).values({
          userId,
          serviceName: merchant,
          amount: latest.amount,
          lastChargeAmount: previous.amount,
          lastChargedAt: latest.date,
        });
      }
    }
  }
}

/**
 * Runs every behavior detector for a user and persists any new alerts found.
 * Safe to call on every dashboard load — dedup logic (per-detector windows)
 * keeps it from re-raising the same finding. Never throws: a detector bug
 * must never break the page that triggered it.
 */
export async function runBehaviorChecks(userId: string): Promise<void> {
  const checks = [
    checkBudgetOverruns,
    checkInstallmentsEnding,
    checkMissingContribution,
    checkReserveNearTarget,
    checkGoalDelayed,
    checkSubscriptionIncreases,
  ];

  for (const check of checks) {
    try {
      await check(userId);
    } catch (err) {
      console.error(`[insights] behavior check "${check.name}" failed`, err);
    }
  }
}
