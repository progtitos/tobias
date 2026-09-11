import { requireOnboardedUser } from "@/lib/auth/guards";
import { listBankAccounts } from "@/services/bankAccounts";
import { listInvestments } from "@/services/investments";
import { listGoals } from "@/services/goals";
import { computeNetWorth } from "@/services/aggregations";
import { PatrimonioClient } from "./PatrimonioClient";

export default async function PatrimonioPage() {
  const user = await requireOnboardedUser();
  const [accounts, investments, goals, netWorth] = await Promise.all([
    listBankAccounts(user.id),
    listInvestments(user.id),
    listGoals(user.id),
    computeNetWorth(user.id),
  ]);

  return (
    <PatrimonioClient
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        type: a.type,
        balance: a.balance,
        isActive: a.isActive,
      }))}
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
      }))}
      goals={goals
        .filter((g) => g.status === "ACTIVE" && g.type !== "EMERGENCY_FUND")
        .map((g) => ({ id: g.id, title: g.title }))}
      netWorth={netWorth}
    />
  );
}
