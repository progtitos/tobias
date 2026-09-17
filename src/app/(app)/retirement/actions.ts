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

  // Campos da renda garantida (INSS) são opcionais, mas se informados
  // precisam fazer sentido — evita salvar um simulador quebrado (ex.:
  // contribuição negativa) que geraria um requiredNetWorth sem significado.
  if (input.contributionYearsToDate != null && !(input.contributionYearsToDate >= 0)) {
    throw new Error("Anos de contribuição inválidos.");
  }
  if (input.averageMonthlySalary != null && !(input.averageMonthlySalary >= 0)) {
    throw new Error("Média salarial inválida.");
  }
  if (input.guaranteedMonthlyIncomeOverride != null && !(input.guaranteedMonthlyIncomeOverride >= 0)) {
    throw new Error("Renda garantida informada inválida.");
  }

  await upsertRetirementPlan(user.id, input);
  revalidatePath("/retirement");
  revalidatePath("/dashboard");
  revalidatePath("/compass");
}
