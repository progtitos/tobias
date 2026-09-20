import { requireOnboardedUser } from "@/lib/auth/guards";
import { getUserCategories } from "@/services/categorization";
import {
  ensureCurrentMonthGenerated,
  listIncomeSources,
  listFixedExpenses,
  listPendingConfirmations,
  getIncomeExpenseSummary,
} from "@/services/incomeExpenseSources";
import { RendaDespesasClient } from "./RendaDespesasClient";

// Reserva de emergência propositalmente NÃO entra nessa tela: ela é um
// pilar de patrimônio (um "cofre" que se acompanha e se aporta), não uma
// renda ou despesa — mora em Patrimônio → Sonhos, calculada ao vivo por
// withLiveEmergencyFundAmount/computeEmergencyReserve (ver
// services/aggregations.ts). Um card próprio já existiu aqui com um alvo
// inventado (totalFixedExpenses * 6, sem relação com a meta real de
// Patrimônio) e foi removido por gerar um número sem sentido e duplicar a
// fonte da verdade (Thiago, 2026-09-20).
export default async function RendaDespesasPage() {
  const user = await requireOnboardedUser();

  // Garante que o mês corrente já tem um lançamento previsto pra cada fonte
  // ativa antes de listar — ver comentário em ensureCurrentMonthGenerated.
  await ensureCurrentMonthGenerated(user.id);

  const [sources, fixedExpenses, pending, summary, categories] = await Promise.all([
    listIncomeSources(user.id),
    listFixedExpenses(user.id),
    listPendingConfirmations(user.id),
    getIncomeExpenseSummary(user.id),
    getUserCategories(user.id),
  ]);

  const incomeCategories = categories.filter((c) => c.type === "INCOME" && !c.parentId);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE" && !c.parentId);

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
    />
  );
}
