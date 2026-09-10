import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { goals, transactions } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";

export async function listGoals(userId: string) {
  return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt));
}

export async function createGoal(
  userId: string,
  input: {
    title: string;
    type: "DREAM" | "EMERGENCY_FUND" | "PROPERTY" | "RETIREMENT" | "CUSTOM";
    targetAmount?: number;
    targetDate?: string;
    monthlyContribution?: number;
    description?: string;
  }
) {
  const [goal] = await db
    .insert(goals)
    .values({
      userId,
      title: input.title,
      type: input.type,
      description: input.description,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
      monthlyContribution: input.monthlyContribution,
      isQuantified: Boolean(input.targetAmount),
    })
    .returning();

  await trackEvent(userId, "goal_created", { type: input.type });
  await logFinancialEvent(userId, "goal_created", { goalId: goal.id, title: input.title });
  return goal;
}

export async function addGoalContribution(userId: string, goalId: string, amount: number) {
  const [goal] = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
  if (!goal) throw new Error("Objetivo não encontrado");

  await db.insert(transactions).values({
    userId,
    date: new Date(),
    amount,
    type: "INVESTMENT_CONTRIBUTION",
    description: `Aporte para ${goal.title}`,
    goalId,
    source: "MANUAL",
  });

  const newAmount = goal.currentAmount + amount;
  const isAchieved = goal.targetAmount ? newAmount >= goal.targetAmount : false;

  await db
    .update(goals)
    .set({ currentAmount: newAmount, status: isAchieved ? "ACHIEVED" : goal.status, updatedAt: new Date() })
    .where(eq(goals.id, goalId));

  await trackEvent(userId, "goal_updated", { goalId, amount });
  return { newAmount, isAchieved };
}

export async function updateGoalStatus(userId: string, goalId: string, status: "ACTIVE" | "PAUSED" | "ABANDONED") {
  await db.update(goals).set({ status, updatedAt: new Date() }).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
}
