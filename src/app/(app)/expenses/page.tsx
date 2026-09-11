import { requireOnboardedUser } from "@/lib/auth/guards";
import { listTransactions } from "@/services/transactions";
import { getUserCategories } from "@/services/categorization";
import { listGoals } from "@/services/goals";
import { ExpensesClient } from "./ExpensesClient";

export default async function ExpensesPage() {
  const user = await requireOnboardedUser();
  const [transactions, categories, goals] = await Promise.all([
    listTransactions(user.id, { limit: 200 }),
    getUserCategories(user.id),
    listGoals(user.id),
  ]);

  return (
    <ExpensesClient
      transactions={transactions.map((t) => ({ ...t, date: t.date.toISOString() }))}
      categories={categories
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, name: c.name, type: c.type }))}
      // A contribution to the Reserva de Emergência isn't logged by hand — its
      // amount is always the live bank/investment total (see
      // withLiveEmergencyFundAmount) — so it doesn't belong in this picker.
      goals={goals
        .filter((g) => g.status === "ACTIVE" && g.type !== "EMERGENCY_FUND")
        .map((g) => ({ id: g.id, title: g.title }))}
    />
  );
}
