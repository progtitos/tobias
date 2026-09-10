import "server-only";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  profiles,
  financialProfiles,
  financialMemories,
  goals,
  debts,
  investments,
  retirementPlans,
  alerts,
  aiInsights,
} from "@/lib/db/schema";
import { monthRange, sumExpenses, sumIncome, computeNetWorth, computeEmergencyReserve, expensesByCategory } from "./aggregations";
import { formatBRL } from "@/lib/utils/money";

/**
 * Assembles the structured financial context Tobias needs before answering
 * anything (spec §29): USER PROFILE + FINANCIAL DATA + GOALS + DREAMS +
 * RETIREMENT PLAN + RECENT EVENTS. Every number here comes straight from the
 * database — this function never asks the model to guess a fact, only to
 * reason about facts we hand it. Rendered as plain text because Gemini's
 * systemInstruction is text, not JSON.
 */
export async function buildFinancialContextText(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [financialProfile] = await db
    .select()
    .from(financialProfiles)
    .where(eq(financialProfiles.userId, userId))
    .limit(1);
  const [retirementPlan] = await db
    .select()
    .from(retirementPlans)
    .where(eq(retirementPlans.userId, userId))
    .limit(1);

  const { start, end } = monthRange();
  const [income, expenses, netWorth, reserve, categoryBreakdown] = await Promise.all([
    sumIncome(userId, start, end),
    sumExpenses(userId, start, end),
    computeNetWorth(userId),
    computeEmergencyReserve(userId),
    expensesByCategory(userId, start, end),
  ]);

  const userGoals = await db.select().from(goals).where(eq(goals.userId, userId)).orderBy(goals.priority);
  const userDebts = await db.select().from(debts).where(and(eq(debts.userId, userId), eq(debts.isActive, true)));
  const userInvestments = await db.select().from(investments).where(eq(investments.userId, userId));

  const memories = await db
    .select()
    .from(financialMemories)
    .where(eq(financialMemories.userId, userId))
    .orderBy(desc(financialMemories.importance), desc(financialMemories.createdAt))
    .limit(15);

  const recentAlerts = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isDismissed, false)))
    .orderBy(desc(alerts.createdAt))
    .limit(5);

  const recentInsights = await db
    .select()
    .from(aiInsights)
    .where(eq(aiInsights.userId, userId))
    .orderBy(desc(aiInsights.createdAt))
    .limit(3);

  const age = user.birthDate
    ? Math.floor((Date.now() - user.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : financialProfile?.currentAge ?? null;

  const lines: string[] = [];
  lines.push(`## PERFIL DE ${user.name}`);
  lines.push(`Idade: ${age ?? "não informado"}`);
  if (profile) {
    lines.push(
      `Estado civil: ${profile.maritalStatus ?? "não informado"} | Dependentes: ${profile.dependents} | Profissão: ${profile.profession ?? "não informado"}`
    );
    if (profile.riskProfile) lines.push(`Perfil de risco: ${profile.riskProfile}`);
    if (profile.priorities?.length) lines.push(`Prioridades declaradas: ${profile.priorities.join(", ")}`);
    if (profile.concerns?.length) lines.push(`Preocupações: ${profile.concerns.join(", ")}`);
  }

  lines.push(`\n## SITUAÇÃO FINANCEIRA (dados reais do banco de dados)`);
  lines.push(`Patrimônio líquido: ${formatBRL(netWorth.netWorth)} (líquido: ${formatBRL(netWorth.liquidAssets)}, investido: ${formatBRL(netWorth.investedAssets)}, outros bens: ${formatBRL(netWorth.otherAssets)}, dívidas: ${formatBRL(netWorth.totalDebt)})`);
  lines.push(`Reserva de emergência estimada: ${formatBRL(reserve)}`);
  lines.push(`Receitas registradas este mês: ${formatBRL(income)}`);
  lines.push(`Despesas registradas este mês: ${formatBRL(expenses)}`);
  if (categoryBreakdown.length) {
    lines.push(`Gastos por categoria este mês: ${categoryBreakdown.map((c) => `${c.categoryName} ${formatBRL(c.total)}`).join(", ")}`);
  }
  if (financialProfile) {
    lines.push(
      `Renda mensal declarada (autorreportada, pode diferir do registrado): ${financialProfile.statedMonthlyIncome ? formatBRL(financialProfile.statedMonthlyIncome) : "não informado"}`
    );
    lines.push(`Capacidade de poupança declarada: ${financialProfile.savingsCapacityPerMonth ? formatBRL(financialProfile.savingsCapacityPerMonth) : "não informado"}`);
  }

  if (userDebts.length) {
    lines.push(`\n## DÍVIDAS ATIVAS`);
    for (const d of userDebts) {
      lines.push(`- ${d.description} (${d.type}): saldo devedor ${formatBRL(d.remainingAmount)}${d.interestRateMonthly ? `, juros ${d.interestRateMonthly}% a.m.` : ""}`);
    }
  }

  if (userInvestments.length) {
    lines.push(`\n## INVESTIMENTOS`);
    for (const inv of userInvestments) {
      lines.push(`- ${inv.name} (${inv.type}): ${formatBRL(inv.currentAmount)} atual (aplicado ${formatBRL(inv.investedAmount)})`);
    }
  }

  if (userGoals.length) {
    lines.push(`\n## OBJETIVOS E SONHOS`);
    for (const g of userGoals) {
      const progress = g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : null;
      lines.push(
        `- ${g.title} [${g.type}, status ${g.status}]: ${g.targetAmount ? `meta ${formatBRL(g.targetAmount)}, já tem ${formatBRL(g.currentAmount)} (${progress}%)` : "ainda não quantificado"}${g.targetDate ? `, prazo ${g.targetDate.toLocaleDateString("pt-BR")}` : ""}`
      );
    }
  }

  if (retirementPlan) {
    lines.push(`\n## PLANO DE APOSENTADORIA`);
    lines.push(
      `Idade atual ${retirementPlan.currentAge} → aposentadoria alvo aos ${retirementPlan.targetRetirementAge}. Renda mensal desejada: ${formatBRL(retirementPlan.desiredMonthlyIncome)}. Aporte mensal atual: ${formatBRL(retirementPlan.monthlyContribution)}. Patrimônio atual considerado: ${formatBRL(retirementPlan.currentNetWorth)}.`
    );
  }

  if (memories.length) {
    lines.push(`\n## MEMÓRIA (fatos que ${user.name} já contou ao Tobias)`);
    for (const m of memories) lines.push(`- ${m.content}`);
  }

  if (recentAlerts.length) {
    lines.push(`\n## ALERTAS RECENTES NÃO RESOLVIDOS`);
    for (const a of recentAlerts) lines.push(`- [${a.severity}] ${a.message}`);
  }

  if (recentInsights.length) {
    lines.push(`\n## ÚLTIMOS INSIGHTS GERADOS`);
    for (const i of recentInsights) lines.push(`- ${i.title}: ${i.body}`);
  }

  return lines.join("\n");
}
