"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createBankAccountSchema, updateBankAccountBalanceSchema } from "@/lib/validations/bankAccount";
import { createInvestmentSchema, updateInvestmentValueSchema, investmentContributionSchema } from "@/lib/validations/investment";
import {
  createBankAccount,
  updateBankAccountBalance,
  toggleBankAccountActive,
  deleteBankAccount,
} from "@/services/bankAccounts";
import {
  createInvestment,
  updateInvestmentValue,
  addInvestmentContribution,
  deleteInvestment,
} from "@/services/investments";

export type PatrimonioFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/retirement");
  revalidatePath("/compass");
}

// ---------------------------------------------------------------------------
// Contas bancárias
// ---------------------------------------------------------------------------

export async function createBankAccountAction(
  _prev: PatrimonioFormState,
  formData: FormData
): Promise<PatrimonioFormState> {
  const user = await requireOnboardedUser();

  const parsed = createBankAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    bankName: (formData.get("bankName") as string) || null,
    type: String(formData.get("type") ?? "CHECKING"),
    balance: Number(formData.get("balance") ?? 0),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createBankAccount(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function updateBankAccountBalanceAction(accountId: string, balance: number) {
  const user = await requireOnboardedUser();
  const parsed = updateBankAccountBalanceSchema.safeParse({ balance });
  if (!parsed.success) return;
  await updateBankAccountBalance(user.id, accountId, parsed.data.balance);
  revalidateAll();
}

export async function toggleBankAccountActiveAction(accountId: string, isActive: boolean) {
  const user = await requireOnboardedUser();
  await toggleBankAccountActive(user.id, accountId, isActive);
  revalidateAll();
}

export async function deleteBankAccountAction(accountId: string) {
  const user = await requireOnboardedUser();
  await deleteBankAccount(user.id, accountId);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Investimentos
// ---------------------------------------------------------------------------

export async function createInvestmentAction(
  _prev: PatrimonioFormState,
  formData: FormData
): Promise<PatrimonioFormState> {
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
