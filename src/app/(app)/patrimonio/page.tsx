import { requireOnboardedUser } from "@/lib/auth/guards";
import { listGoals } from "@/services/goals";
import { computeNetWorth } from "@/services/aggregations";
import { PatrimonioClient } from "./PatrimonioClient";

export default async function PatrimonioPage() {
  const user = await requireOnboardedUser();
  const [goals, netWorth] = await Promise.all([listGoals(user.id), computeNetWorth(user.id)]);

  return (
    <PatrimonioClient
      goals={goals.map((g) => ({
        ...g,
        targetDate: g.targetDate?.toISOString() ?? null,
      }))}
      netWorth={netWorth}
    />
  );
}
