import { requireOnboardedUser } from "@/lib/auth/guards";
import { listInvestments, listInvestmentAccounts } from "@/services/investments";
import { listGoals } from "@/services/goals";
import { InvestimentosClient } from "./InvestimentosClient";

export default async function InvestimentosPage() {
  const user = await requireOnboardedUser();
  const [investments, goals, accounts] = await Promise.all([
    listInvestments(user.id),
    listGoals(user.id),
    listInvestmentAccounts(user.id),
  ]);

  return (
    <InvestimentosClient
      investments={investments.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        investedAmount: i.investedAmount,
        currentAmount: i.currentAmount,
        liquidity: i.liquidity,
        institution: i.institution,
        goalId: i.goalId,
        goalTitle: goals.find((g) => g.id === i.goalId)?.title ?? null,
        bankAccountId: i.bankAccountId,
      }))}
      goals={goals
        .filter((g) => g.status === "ACTIVE" && g.type !== "EMERGENCY_FUND")
        .map((g) => ({ id: g.id, title: g.title }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, bankName: a.bankName }))}
    />
  );
}
