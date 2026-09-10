"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { generateInitialBudget, setBudgetLimit } from "@/services/budget";

export async function recalculateBudgetAction() {
  const user = await requireOnboardedUser();
  await generateInitialBudget(user.id);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function updateBudgetLimitAction(budgetId: string, limitAmount: number) {
  const user = await requireOnboardedUser();
  if (!(limitAmount >= 0)) throw new Error("Valor inválido");
  await setBudgetLimit(user.id, budgetId, limitAmount);
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
