import { requireOnboardedUser } from "@/lib/auth/guards";
import { getUserCategories } from "@/services/categorization";
import {
  ensureCurrentMonthGenerated,
  listIncomeSources,
  listFixedExpenses,
  listPendingConfirmations,
  getIncomeExpenseSummary,
} from "@/services/incomeExpenseSources";
import { computeEmergencyReserve } from "@/services/aggregations";
import { listGoals } from "@/services/goals";
import { RendaDespesasClient } from "./RendaDespesasClient";

export default async function RendaDespesasPage() {
  const user = await requireOnboardedUser();

  // Garante que o mês corrente já tem um lançamento previsto pra cada fonte
  // ativa antes de listar — ver comentário em ensureCurrentMonthGenerated.
  await ensureCurrentMonthGenerated(user.id);

  const [sources, fixedExpenses, pending, summary, categories, reserve, goals] = await Promise.all([
    listIncomeSources(user.id),
    listFixedExpenses(user.id),
    listPendingConfirmations(user.id),
    getIncomeExpenseSummary(user.id),
    getUserCategories(user.id),
    computeEmergencyReserve(user.id),
    listGoals(user.id),
  ]);

  const incomeCategories = categories.filter((c) => c.type === "INCOME" && !c.parentId);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE" && !c.parentId);
  const emergencyGoal = goals.find((g) => g.type === "EMERGENCY_FUND" && g.status === "ACTIVE") ?? null;

  return (
    <RendaDespesasClient
      sources={sources.map((s) => ({
        id: s.id,
        description: s.description,
        amount: Number(s.amount),
        deductionAmount: s.deductionAmount !== null ? Number(s.deductionAmount) : null,
        category: s.category,
        categoryId: s.categoryId,
        deductionCategoryId: s.deductionCategoryId,
        dayOfMonth: s.dayOfMonth,
        isActive: s.isActive,
      }))}
      fixedExpenses={fixedExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        categoryId: e.categoryId,
        dayOfMonth: e.dayOfMonth,
        isActive: e.isActive,
      }))}
      pending={pending.map((p) => ({
        id: p.id,
        date: p.date.toISOString(),
        description: p.description,
        amount: Number(p.amount),
        type: p.type,
      }))}
      summary={summary}
      incomeCategories={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
      expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
      reserve={reserve}
      emergencyGoal={emergencyGoal ? { id: emergencyGoal.id, targetAmount: emergencyGoal.targetAmount, currentAmount: emergencyGoal.currentAmount } : null}
    />
  );
}
