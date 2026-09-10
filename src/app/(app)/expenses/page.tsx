import { requireOnboardedUser } from "@/lib/auth/guards";
import { listTransactions } from "@/services/transactions";
import { getUserCategories } from "@/services/categorization";
import { ExpensesClient } from "./ExpensesClient";

export default async function ExpensesPage() {
  const user = await requireOnboardedUser();
  const [transactions, categories] = await Promise.all([
    listTransactions(user.id, { limit: 200 }),
    getUserCategories(user.id),
  ]);

  return (
    <ExpensesClient
      transactions={transactions.map((t) => ({ ...t, date: t.date.toISOString() }))}
      categories={categories
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, name: c.name, type: c.type }))}
    />
  );
}
