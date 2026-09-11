import { requireOnboardedUser } from "@/lib/auth/guards";
import { listTransactions } from "@/services/transactions";
import { getUserCategories } from "@/services/categorization";
import { getCurrentBudgetsWithActuals, generateInitialBudget } from "@/services/budget";
import { listGoals } from "@/services/goals";
import { listBankAccounts } from "@/services/bankAccounts";
import { monthRange } from "@/services/aggregations";
import { LancamentosClient } from "./LancamentosClient";

// "2026-09" -> 1º de setembro de 2026. Qualquer coisa que não bata nesse
// formato (ou não exista, tipo mês 13) cai no mês corrente em vez de quebrar
// a página com uma data inválida.
function parseMonthParam(month: string | undefined): Date {
  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const date = new Date(year, monthIndex, 1);
      if (!Number.isNaN(date.getTime()) && date.getMonth() === monthIndex) return date;
    }
  }
  return new Date();
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { month } = await searchParams;
  const referenceDate = parseMonthParam(month);
  const { start, end } = monthRange(referenceDate);

  let budgets = await getCurrentBudgetsWithActuals(user.id, referenceDate);
  // Primeira visita: ainda não existe orçamento gerado — cria a sugestão
  // inicial baseada em renda/objetivos agora, em vez de mostrar a aba vazia.
  // Depois disso, só recalcula quando a pessoa pedir explicitamente.
  if (budgets.length === 0) {
    await generateInitialBudget(user.id);
    budgets = await getCurrentBudgetsWithActuals(user.id, referenceDate);
  }

  const [transactions, categories, goals, accounts] = await Promise.all([
    listTransactions(user.id, { start, end, limit: 200 }),
    getUserCategories(user.id),
    listGoals(user.id),
    listBankAccounts(user.id),
  ]);

  return (
    <LancamentosClient
      month={`${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`}
      transactions={transactions.map((t) => ({ ...t, date: t.date.toISOString() }))}
      categories={categories
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon }))}
      // Aporte para a Reserva de Emergência não é lançado à mão — o valor
      // dela é sempre o total real de contas/investimentos (ver
      // withLiveEmergencyFundAmount) — então não faz sentido no seletor.
      goals={goals
        .filter((g) => g.status === "ACTIVE" && g.type !== "EMERGENCY_FUND")
        .map((g) => ({ id: g.id, title: g.title }))}
      // Só contas ativas, igual ao filtro que o próprio Patrimônio usa pro
      // patrimônio líquido — uma conta pausada/fechada não devia ser
      // selecionável para um lançamento novo.
      accounts={accounts
        .filter((a) => a.isActive)
        .map((a) => ({ id: a.id, name: a.name, bankName: a.bankName }))}
      budgets={budgets}
      totalLimit={budgets.reduce((s, b) => s + b.limitAmount, 0)}
      totalActual={budgets.reduce((s, b) => s + b.actual, 0)}
    />
  );
}
