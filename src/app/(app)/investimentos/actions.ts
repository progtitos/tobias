"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createInvestmentSchema, updateInvestmentValueSchema, investmentContributionSchema } from "@/lib/validations/investment";
import {
  createInvestment,
  updateInvestmentValue,
  addInvestmentContribution,
  deleteInvestment,
} from "@/services/investments";

export type InvestimentosFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/investimentos");
  // Patrimônio mostra o total investido dentro do patrimônio líquido, e um
  // aporte ligado a um objetivo pode mudar o progresso dele lá também.
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  revalidatePath("/retirement");
  revalidatePath("/compass");
}

export async function createInvestmentAction(
  _prev: InvestimentosFormState,
  formData: FormData
): Promise<InvestimentosFormState> {
  const user = await requireOnboardedUser();

  const invested = Number(formData.get("investedAmount") ?? 0);
  const parsed = createInvestmentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "OTHER"),
    investedAmount: invested,
    // Se a pessoa não souber o valor atual de cara, assume-se igual ao
    // aportado — ela ajusta depois com "Atualizar valor".
    currentAmount: formData.get("currentAmount") ? Number(formData.get("currentAmount")) : invested,
    liquidity: (formData.get("liquidity") as string) || null,
    institution: (formData.get("institution") as string) || null,
    goalId: (formData.get("goalId") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createInvestment(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function updateInvestmentValueAction(investmentId: string, currentAmount: number) {
  const user = await requireOnboardedUser();
  const parsed = updateInvestmentValueSchema.safeParse({ currentAmount });
  if (!parsed.success) return;
  await updateInvestmentValue(user.id, investmentId, parsed.data.currentAmount);
  revalidateAll();
}

export async function addInvestmentContributionAction(investmentId: string, amount: number) {
  const user = await requireOnboardedUser();
  const parsed = investmentContributionSchema.safeParse({ amount });
  if (!parsed.success) return;
  await addInvestmentContribution(user.id, investmentId, parsed.data.amount);
  revalidateAll();
}

export async function deleteInvestmentAction(investmentId: string) {
  const user = await requireOnboardedUser();
  await deleteInvestment(user.id, investmentId);
  revalidateAll();
}
