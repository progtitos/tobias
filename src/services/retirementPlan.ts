import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { retirementPlans } from "@/lib/db/schema";
import { computeNetWorth } from "./aggregations";
import { trackEvent } from "./analytics";

export type RetirementPlanInput = {
  currentAge: number;
  targetRetirementAge: number;
  desiredMonthlyIncome: number;
  monthlyContribution: number;
  expectedReturnConservative: number;
  expectedReturnBase: number;
  expectedReturnAggressive: number;
  expectedInflation: number;
};

export async function getRetirementPlan(userId: string) {
  const [plan] = await db.select().from(retirementPlans).where(eq(retirementPlans.userId, userId)).limit(1);
  return plan ?? null;
}

/**
 * currentNetWorth is intentionally never taken from user input on this page —
 * it's always refreshed from real transaction/account data, so the curve's
 * starting point can't drift from what the rest of the app shows.
 */
export async function upsertRetirementPlan(userId: string, input: RetirementPlanInput) {
  const netWorth = await computeNetWorth(userId);
  const existing = await getRetirementPlan(userId);

  if (existing) {
    await db
      .update(retirementPlans)
      .set({ ...input, currentNetWorth: netWorth.netWorth, updatedAt: new Date() })
      .where(eq(retirementPlans.userId, userId));
  } else {
    await db.insert(retirementPlans).values({ userId, ...input, currentNetWorth: netWorth.netWorth });
    await trackEvent(userId, "retirement_plan_created");
  }

  return getRetirementPlan(userId);
}
