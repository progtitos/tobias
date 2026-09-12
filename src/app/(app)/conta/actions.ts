"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createBankAccountSchema, updateBankAccountBalanceSchema } from "@/lib/validations/bankAccount";
import { createCreditCardSchema } from "@/lib/validations/creditCard";
import {
  createBankAccount,
  updateBankAccountBalance,
  toggleBankAccountActive,
  deleteBankAccount,
} from "@/services/bankAccounts";
import { createCreditCard, deleteCreditCard } from "@/services/creditCards";

export type ContaFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/conta");
  revalidatePath("/dashboard");
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

// ---------------------------------------------------------------------------
// Cartão de crédito — sempre nasce vinculado a uma conta já existente (a
// conta que paga a fatura), aberto de dentro do card dessa conta em Contas.
// ---------------------------------------------------------------------------

export type CreditCardFormState = { error?: string; success?: boolean } | undefined;

export async function createCreditCardAction(
  _prev: CreditCardFormState,
  formData: FormData
): Promise<CreditCardFormState> {
  const user = await requireOnboardedUser();

  const parsed = createCreditCardSchema.safeParse({
    bankAccountId: String(formData.get("bankAccountId") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    brand: (formData.get("brand") as string) || null,
    lastFourDigits: (formData.get("lastFourDigits") as string) || null,
    limitAmount: formData.get("limitAmount") ? Number(formData.get("limitAmount")) : null,
    closingDay: formData.get("closingDay") ? Number(formData.get("closingDay")) : null,
    dueDay: formData.get("dueDay") ? Number(formData.get("dueDay")) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createCreditCard(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function deleteCreditCardAction(creditCardId: string) {
  const user = await requireOnboardedUser();
  await deleteCreditCard(user.id, creditCardId);
  revalidateAll();
}
