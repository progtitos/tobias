"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createBankAccountSchema, updateBankAccountBalanceSchema } from "@/lib/validations/bankAccount";
import {
  createBankAccount,
  updateBankAccountBalance,
  toggleBankAccountActive,
  deleteBankAccount,
} from "@/services/bankAccounts";

export type ContaFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/conta");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/retirement");
  revalidatePath("/compass");
  revalidatePath("/patrimonio");
  // A conta escolhida ao criar/editar uma transação em Lançamentos vem dessa
  // mesma lista, então uma conta nova ou desativada precisa refletir lá.
  revalidatePath("/lancamentos");
}

export async function createBankAccountAction(
  _prev: ContaFormState,
  formData: FormData
): Promise<ContaFormState> {
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
