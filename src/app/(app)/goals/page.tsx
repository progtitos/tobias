import { requireOnboardedUser } from "@/lib/auth/guards";
import { listGoals } from "@/services/goals";
import { GoalsClient } from "./GoalsClient";

export default async function GoalsPage() {
  const user = await requireOnboardedUser();
  const goals = await listGoals(user.id);

  return (
    <GoalsClient
      goals={goals.map((g) => ({
        ...g,
        targetDate: g.targetDate?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
      }))}
    />
  );
}
