import { requireOnboardedUser } from "@/lib/auth/guards";
import { getCurrentBudgetsWithActuals, generateInitialBudget } from "@/services/budget";
import { BudgetClient } from "./BudgetClient";

export default async function BudgetPage() {
  const user = await requireOnboardedUser();
  let budgets = await getCurrentBudgetsWithActuals(user.id);

  // First visit: no budget generated yet — create the initial guideline-based
  // budget now instead of showing an empty page. After this, the user
  // recalculates explicitly via the "Recalcular automaticamente" button, so
  // manual overrides are never silently overwritten on a routine page load.
  if (budgets.length === 0) {
    await generateInitialBudget(user.id);
    budgets = await getCurrentBudgetsWithActuals(user.id);
  }

  const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalActual = budgets.reduce((s, b) => s + b.actual, 0);

  return <BudgetClient budgets={budgets} totalLimit={totalLimit} totalActual={totalActual} />;
}
