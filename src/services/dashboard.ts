import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, retirementPlans, financialProfiles } from "@/lib/db/schema";
import { computeNetWorth, monthRange, sumIncome, sumExpenses, sumInvestmentContributions, activeGoals } from "./aggregations";
import { getLatestCompass } from "./compass";
import { simulateRetirementCurve } from "./retirement";

export async function getDashboardData(userId: string) {
  const { start, end } = monthRange();

  const [netWorth, income, expenses, investmentContributions, compass, goals, activeAlerts, retirementPlan, financialProfile] =
    await Promise.all([
      computeNetWorth(userId),
      sumIncome(userId, start, end),
      sumExpenses(userId, start, end),
      sumInvestmentContributions(userId, start, end),
      getLatestCompass(userId),
      activeGoals(userId),
      db
        .select()
        .from(alerts)
        .where(and(eq(alerts.userId, userId), eq(alerts.isDismissed, false)))
        .orderBy(desc(alerts.createdAt))
        .limit(3),
      db.select().from(retirementPlans).where(eq(retirementPlans.userId, userId)).then((r) => r[0] ?? null),
      db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).then((r) => r[0] ?? null),
    ]);

  const healthScore =
    compass.length > 0 ? Math.round(compass.reduce((s, c) => s + c.score, 0) / compass.length) : 0;

  const monthlyCapacity =
    financialProfile?.savingsCapacityPerMonth ?? Math.max(0, income - expenses);

  const retirementPreview = retirementPlan
    ? simulateRetirementCurve({
        currentAge: retirementPlan.currentAge,
        targetRetirementAge: retirementPlan.targetRetirementAge,
        currentNetWorth: retirementPlan.currentNetWorth,
        monthlyContribution: retirementPlan.monthlyContribution,
        desiredMonthlyIncome: retirementPlan.desiredMonthlyIncome,
        expectedReturnConservative: retirementPlan.expectedReturnConservative,
        expectedReturnBase: retirementPlan.expectedReturnBase,
        expectedReturnAggressive: retirementPlan.expectedReturnAggressive,
        expectedInflation: retirementPlan.expectedInflation,
      })
    : null;

  return {
    netWorth,
    healthScore,
    monthlyCapacity,
    month: { income, expenses, investments: investmentContributions, balance: income - expenses - investmentContributions },
    compass,
    goals,
    alerts: activeAlerts,
    retirementPreview,
  };
}
