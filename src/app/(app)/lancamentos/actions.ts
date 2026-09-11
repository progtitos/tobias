"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createTransactionSchema } from "@/lib/validations/transaction";
import { createManualTransaction, updateTransactionCategory, deleteTransaction } from "@/services/transactions";
import { generateInitialBudget, setBudgetLimit } from "@/services/budget";

export type LancamentosFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/patrimonio");
  // Uma transação ligada a uma conta muda o saldo dela (ver
  // adjustBankAccountBalance em services/transactions.ts) — a tela Conta
  // precisa refletir isso.
  revalidatePath("/conta");
}

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

export async function createTransactionAction(
  _prev: LancamentosFormState,
  formData: FormData
): Promise<LancamentosFormState> {
  const user = await requireOnboardedUser();

  const raw = {
    date: String(formData.get("date") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    type: String(formData.get("type") ?? "EXPENSE"),
    categoryId: (formData.get("categoryId") as string) || null,
    goalId: (formData.get("goalId") as string) || null,
    bankAccountId: (formData.get("bankAccountId") as string) || null,
    description: String(formData.get("description") ?? ""),
    merchant: (formData.get("merchant") as string) || null,
    paymentMethod: (formData.get("paymentMethod") as string) || null,
    installmentTotal: formData.get("installmentTotal") ? Number(formData.get("installmentTotal")) : undefined,
    notes: null,
  };

  const parsed = createTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await createManualTransaction(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function updateCategoryAction(transactionId: string, categoryId: string) {
  const user = await requireOnboardedUser();
  await updateTransactionCategory(user.id, transactionId, categoryId);
  revalidateAll();
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await requireOnboardedUser();
  await deleteTransaction(user.id, transactionId);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------

export async function recalculateBudgetAction() {
  const user = await requireOnboardedUser();
  await generateInitialBudget(user.id);
  revalidateAll();
}

export async function updateBudgetLimitAction(budgetId: string, limitAmount: number) {
  const user = await requireOnboardedUser();
  if (!(limitAmount >= 0)) throw new Error("Valor inválido");
  await setBudgetLimit(user.id, budgetId, limitAmount);
  revalidateAll();
}
