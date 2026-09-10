"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { upsertRetirementPlan, type RetirementPlanInput } from "@/services/retirementPlan";

export async function saveRetirementPlanAction(input: RetirementPlanInput) {
  const user = await requireOnboardedUser();

  if (
    !(input.currentAge > 0) ||
    !(input.targetRetirementAge > input.currentAge) ||
    !(input.desiredMonthlyIncome > 0) ||
    !(input.monthlyContribution >= 0)
  ) {
    throw new Error("Valores inválidos para o plano de aposentadoria.");
  }

  await upsertRetirementPlan(user.id, input);
  revalidatePath("/retirement");
  revalidatePath("/dashboard");
  revalidatePath("/compass");
}
