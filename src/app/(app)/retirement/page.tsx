import { eq } from "drizzle-orm";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { financialProfiles } from "@/lib/db/schema";
import { getRetirementPlan } from "@/services/retirementPlan";
import { computeNetWorth } from "@/services/aggregations";
import { RetirementClient } from "./RetirementClient";

export default async function RetirementPage() {
  const user = await requireOnboardedUser();
  const [plan, netWorth, financialProfile] = await Promise.all([
    getRetirementPlan(user.id),
    computeNetWorth(user.id),
    db.select().from(financialProfiles).where(eq(financialProfiles.userId, user.id)).then((r) => r[0] ?? null),
  ]);

  const defaults = {
    currentAge: plan?.currentAge ?? financialProfile?.currentAge ?? 30,
    targetRetirementAge: plan?.targetRetirementAge ?? financialProfile?.desiredRetirementAge ?? 65,
    desiredMonthlyIncome:
      plan?.desiredMonthlyIncome ?? financialProfile?.desiredRetirementIncome ?? (financialProfile?.statedMonthlyIncome ?? 3000) * 0.7,
    monthlyContribution: plan?.monthlyContribution ?? financialProfile?.savingsCapacityPerMonth ?? 0,
    expectedReturnConservative: plan?.expectedReturnConservative ?? 0.04,
    expectedReturnBase: plan?.expectedReturnBase ?? 0.06,
    expectedReturnAggressive: plan?.expectedReturnAggressive ?? 0.09,
    expectedInflation: plan?.expectedInflation ?? 0.04,
  };

  return <RetirementClient defaults={defaults} currentNetWorth={netWorth.netWorth} hasPlan={Boolean(plan)} />;
}
