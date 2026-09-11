import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { investments, transactions } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import { applyGoalContribution } from "./goals";
import type { CreateInvestmentInput } from "@/lib/validations/investment";

export async function listInvestments(userId: string) {
  return db.select().from(investments).where(eq(investments.userId, userId)).orderBy(investments.createdAt);
}

export async function createInvestment(userId: string, input: CreateInvestmentInput) {
  const [investment] = await db
    .insert(investments)
    .values({
      userId,
      name: input.name,
      type: input.type,
      investedAmount: input.investedAmount,
      currentAmount: input.currentAmount,
      liquidity: input.liquidity || null,
      institution: input.institution || null,
      goalId: input.goalId || null,
    })
    .returning();

  await trackEvent(userId, "investment_created", { type: input.type });
  await logFinancialEvent(userId, "investment_created", { investmentId: investment.id, name: input.name });
  return investment;
}

/**
 * Corrects the current market value without treating it as new money — for
 * when a fund's quota moved or the person is just syncing the number to what
 * their broker shows. investedAmount (what actually went in) is untouched,
 * so gain/loss keeps reflecting reality instead of resetting to zero.
 */
export async function updateInvestmentValue(userId: string, investmentId: string, currentAmount: number) {
  const [investment] = await db
    .update(investments)
    .set({ currentAmount, updatedAt: new Date() })
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .returning();

  if (investment) {
    await trackEvent(userId, "investment_updated", { investmentId, currentAmount });
    await logFinancialEvent(userId, "investment_value_updated", { investmentId, currentAmount });
  }
  return investment;
}

/**
 * Registers new money going into an existing investment ("aporte"): bumps
 * both investedAmount and currentAmount, logs it as an
 * INVESTMENT_CONTRIBUTION transaction (so it shows up in Transações and in
 * the month's flow bar), and — when the investment is earmarked toward a
 * goal — reuses the same applyGoalContribution the Sonhos/Transações screens
 * call, so a goal's progress never drifts depending on which screen the
 * money was logged from.
 */
export async function addInvestmentContribution(userId: string, investmentId: string, amount: number) {
  const [investment] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .limit(1);
  if (!investment) throw new Error("Investimento não encontrado");

  const [updated] = await db
    .update(investments)
    .set({
      investedAmount: investment.investedAmount + amount,
      currentAmount: investment.currentAmount + amount,
      updatedAt: new Date(),
    })
    .where(eq(investments.id, investmentId))
    .returning();

  await db.insert(transactions).values({
    userId,
    date: new Date(),
    amount,
    type: "INVESTMENT_CONTRIBUTION",
    description: `Aporte em ${investment.name}`,
    goalId: investment.goalId,
    source: "MANUAL",
  });

  if (investment.goalId) {
    await applyGoalContribution(userId, investment.goalId, amount);
  }

  await trackEvent(userId, "investment_updated", { investmentId, amount });
  return updated;
}

export async function deleteInvestment(userId: string, investmentId: string) {
  await db.delete(investments).where(and(eq(investments.id, investmentId), eq(investments.userId, userId)));
}
