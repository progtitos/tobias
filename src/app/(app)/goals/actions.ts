"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createGoal, addGoalContribution, updateGoalStatus } from "@/services/goals";

export type GoalFormState = { error?: string } | undefined;

export async function createGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireOnboardedUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Dê um nome para o seu objetivo." };

  await createGoal(user.id, {
    title,
    type: (formData.get("type") as never) ?? "DREAM",
    targetAmount: formData.get("targetAmount") ? Number(formData.get("targetAmount")) : undefined,
    targetDate: (formData.get("targetDate") as string) || undefined,
    monthlyContribution: formData.get("monthlyContribution") ? Number(formData.get("monthlyContribution")) : undefined,
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function addContributionAction(goalId: string, amount: number) {
  const user = await requireOnboardedUser();
  await addGoalContribution(user.id, goalId, amount);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function updateGoalStatusAction(goalId: string, status: "ACTIVE" | "PAUSED" | "ABANDONED") {
  const user = await requireOnboardedUser();
  await updateGoalStatus(user.id, goalId, status);
  revalidatePath("/goals");
}
