import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { budgets, categories, financialProfiles, goals } from "@/lib/db/schema";
import { monthRange, sumIncome, expensesByCategory } from "./aggregations";

// ----------------------------------------------------------------------------
// Dynamic budget engine (spec §18).
// ----------------------------------------------------------------------------
// The initial budget is a simple, transparent percent-of-income guideline —
// not a fixed spreadsheet. It's recomputed whenever the user's stated income
// or active goals change meaningfully (see recalculateBudgetIfStale), and any
// row can be overridden by the user (isAutoCalculated flips to false).
// ----------------------------------------------------------------------------

const GUIDELINE_PCT_OF_INCOME: Record<string, number> = {
  Moradia: 0.25,
  Alimentação: 0.15,
  Transporte: 0.1,
  Saúde: 0.05,
  Educação: 0.05,
  Lazer: 0.05,
  Viagens: 0.03,
  Compras: 0.05,
  Família: 0.03,
  Seguros: 0.02,
  Assinaturas: 0.02,
  Outros: 0.03,
};

async function resolveMonthlyIncomeBaseline(userId: string): Promise<number> {
  const [fp] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
  if (fp?.statedMonthlyIncome && fp.statedMonthlyIncome > 0) return fp.statedMonthlyIncome;

  const { start, end } = monthRange();
  const computed = await sumIncome(userId, start, end);
  return computed;
}

async function resolveSavingsTarget(userId: string, income: number): Promise<number> {
  const [fp] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
  if (fp?.savingsCapacityPerMonth && fp.savingsCapacityPerMonth >= 0) return fp.savingsCapacityPerMonth;

  const activeGoalContributions = await db
    .select({ monthlyContribution: goals.monthlyContribution })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "ACTIVE")));
  const fromGoals = activeGoalContributions.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0);
  if (fromGoals > 0) return fromGoals;

  return income * 0.15; // fallback guideline: 15% of income
}

export async function generateInitialBudget(userId: string) {
  const income = await resolveMonthlyIncomeBaseline(userId);
  if (income <= 0) return { created: 0 };

  const savingsTarget = await resolveSavingsTarget(userId, income);
  const allCategories = await db.select().from(categories).where(isNull(categories.userId));
  const byName = new Map(allCategories.filter((c) => !c.parentId).map((c) => [c.name, c] as const));

  // Close out any previous auto-calculated budgets before creating fresh ones.
  await db
    .update(budgets)
    .set({ effectiveTo: new Date() })
    .where(and(eq(budgets.userId, userId), eq(budgets.isAutoCalculated, true), isNull(budgets.effectiveTo)));

  const rows: (typeof budgets.$inferInsert)[] = [];
  for (const [name, pct] of Object.entries(GUIDELINE_PCT_OF_INCOME)) {
    const category = byName.get(name);
    rows.push({
      userId,
      categoryId: category?.id ?? null,
      label: name,
      limitAmount: Math.round(income * pct * 100) / 100,
      isAutoCalculated: true,
    });
  }

  const investmentsCategory = byName.get("Investimentos");
  rows.push({
    userId,
    categoryId: investmentsCategory?.id ?? null,
    label: "Investimentos",
    limitAmount: savingsTarget,
    isAutoCalculated: true,
  });

  await db.insert(budgets).values(rows);
  return { created: rows.length };
}

export async function setBudgetLimit(userId: string, budgetId: string, limitAmount: number) {
  await db
    .update(budgets)
    .set({ limitAmount, isAutoCalculated: false })
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId), isNull(budgets.effectiveTo)));
}

export async function getCurrentBudgetsWithActuals(userId: string) {
  const active = await db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      label: budgets.label,
      limitAmount: budgets.limitAmount,
      isAutoCalculated: budgets.isAutoCalculated,
    })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), isNull(budgets.effectiveTo)));

  const { start, end } = monthRange();
  const actuals = await expensesByCategory(userId, start, end);
  const actualByCategory = new Map(actuals.map((a) => [a.categoryId, a.total] as const));
  const actualByLabel = new Map(actuals.map((a) => [a.categoryName, a.total] as const));

  return active.map((b) => {
    const actual = b.categoryId ? actualByCategory.get(b.categoryId) ?? actualByLabel.get(b.label) ?? 0 : actualByLabel.get(b.label) ?? 0;
    const pctUsed = b.limitAmount > 0 ? actual / b.limitAmount : 0;
    return { ...b, actual, pctUsed, isOverrun: pctUsed > 1 };
  });
}
