import { requireOnboardedUser } from "@/lib/auth/guards";
import { listInvestments } from "@/services/investments";
import { listGoals } from "@/services/goals";
import { computeNetWorth } from "@/services/aggregations";
import { PatrimonioClient } from "./PatrimonioClient";

export default async function PatrimonioPage() {
  const user = await requireOnboardedUser();
  const [investments, goals, netWorth] = await Promise.all([
    listInvestments(user.id),
    listGoals(user.id),
    computeNetWorth(user.id),
  ]);

  return (
    <PatrimonioClient
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
