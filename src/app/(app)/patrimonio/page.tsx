import { requireOnboardedUser } from "@/lib/auth/guards";
import { listGoals } from "@/services/goals";
import { computeNetWorth } from "@/services/aggregations";
import { computeEmergencyFundTarget } from "@/services/incomeExpenseSources";
import { listAssets } from "@/services/assets";
import { listDebts } from "@/services/debts";
import { PatrimonioClient } from "./PatrimonioClient";

export default async function PatrimonioPage() {
  const user = await requireOnboardedUser();
  const [goals, netWorth, emergencyFundSuggestion, assets, debts] = await Promise.all([
    listGoals(user.id),
    computeNetWorth(user.id),
    computeEmergencyFundTarget(user.id),
    listAssets(user.id),
    listDebts(user.id),
  ]);

  return (
    <PatrimonioClient
      goals={goals.map((g) => ({
        ...g,
        targetDate: g.targetDate?.toISOString() ?? null,
      }))}
      netWorth={netWorth}
      emergencyFundSuggestion={emergencyFundSuggestion}
      assets={assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        estimatedValue: a.estimatedValue,
        acquiredAt: a.acquiredAt?.toISOString() ?? null,
        notes: a.notes,
      }))}
      debts={debts
        .filter((d) => d.isActive)
        .map((d) => ({
          id: d.id,
          description: d.description,
          type: d.type,
          totalAmount: d.totalAmount,
          remainingAmount: d.remainingAmount,
          interestRateMonthly: d.interestRateMonthly,
          installmentAmount: d.installmentAmount,
          installmentsRemaining: d.installmentsRemaining,
          dueDay: d.dueDay,
        }))}
    />
  );
}
