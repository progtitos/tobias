import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, retirementPlans, financialProfiles, profiles } from "@/lib/db/schema";
import { computeNetWorth, monthRange, sumIncome, sumExpenses, sumInvestmentContributions, activeGoals } from "./aggregations";
import { getLatestCompass, statusForScore } from "./compass";
import { simulateRetirementCurve } from "./retirement";
import { buildRetirementInputs } from "./retirementPlan";
import { BEHAVIORAL_PROFILE_LABELS, type BehavioralProfile } from "./behavioralProfile";
import { getCreditCardsUsage, pickCardNeedingAttention } from "./creditCards";

export async function getDashboardData(userId: string) {
  const { start, end } = monthRange();

  const [netWorth, income, expenses, investmentContributions, compass, goals, activeAlerts, retirementPlan, financialProfile, profile, cardsUsage] =
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
      db.select().from(profiles).where(eq(profiles.userId, userId)).then((r) => r[0] ?? null),
      getCreditCardsUsage(userId),
    ]);

  // Card "Seu patrimônio" do Dashboard virou o cartão que precisa de mais
  // atenção (maior % do limite usado no ciclo aberto) — decisão do Thiago.
  // O patrimônio líquido em si não sumiu do produto, continua completo e
  // detalhado em /patrimonio; só parou de ter esse card dedicado aqui.
  const cardNeedingAttention = pickCardNeedingAttention(cardsUsage);

  const behavioralProfileType = (profile?.behavioralProfile as BehavioralProfile | undefined) ?? "EMERGING_ORGANIZER";
  const behavioralProfile = {
    type: behavioralProfileType,
    label: BEHAVIORAL_PROFILE_LABELS[behavioralProfileType],
    confidence: profile?.behavioralProfileConfidence ?? "INITIAL",
  };

  const healthScore =
    compass.length > 0 ? Math.round(compass.reduce((s, c) => s + c.score, 0) / compass.length) : 0;
  const healthStatus = statusForScore(healthScore);

  // A proactive nudge for the dashboard's "Tobias" card. Deliberately rule-based
  // like the rest of the Bússola: it's just the weakest dimension's own
  // `nextAction`, framed as something Tobias is telling you, not a separate
  // AI-generated message.
  const weakestDimension = compass.length > 0 ? [...compass].sort((a, b) => a.score - b.score)[0] : null;
  const tobiasMessage =
    weakestDimension?.nextAction ??
    "Ainda estou aprendendo sobre suas finanças. Vamos conversar mais para eu te dar recomendações mais precisas?";
  const tobiasFocusLabel = weakestDimension?.label ?? null;

  const monthlyCapacity =
    financialProfile?.savingsCapacityPerMonth ?? Math.max(0, income - expenses);

  const retirementPreview = retirementPlan
    ? simulateRetirementCurve(buildRetirementInputs(retirementPlan, retirementPlan.currentNetWorth))
    : null;

  return {
    netWorth,
    healthScore,
    healthStatus,
    behavioralProfile,
    cardNeedingAttention,
    totalCreditCards: cardsUsage.length,
    monthlyCapacity,
    month: { income, expenses, investments: investmentContributions, balance: income - expenses - investmentContributions },
    compass,
    goals,
    alerts: activeAlerts,
    retirementPreview,
    retirementTargetAge: retirementPlan?.targetRetirementAge ?? null,
    tobiasMessage,
    tobiasFocusLabel,
  };
}
