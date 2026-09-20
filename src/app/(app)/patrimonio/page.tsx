import { requireOnboardedUser } from "@/lib/auth/guards";
import { listGoals } from "@/services/goals";
import { computeNetWorth } from "@/services/aggregations";
import { computeEmergencyFundTarget } from "@/services/incomeExpenseSources";
import { PatrimonioClient } from "./PatrimonioClient";

export default async function PatrimonioPage() {
  const user = await requireOnboardedUser();
  const [goals, netWorth, emergencyFundSuggestion] = await Promise.all([
    listGoals(user.id),
    computeNetWorth(user.id),
    computeEmergencyFundTarget(user.id),
  ]);

  return (
    <PatrimonioClient
      goals={goals.map((g) => ({
        ...g,
        targetDate: g.targetDate?.toISOString() ?? null,
      }))}
      netWorth={netWorth}
      emergencyFundSuggestion={emergencyFundSuggestion}
    />
  );
}
