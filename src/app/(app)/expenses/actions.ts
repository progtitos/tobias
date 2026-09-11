"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createTransactionSchema } from "@/lib/validations/transaction";
import { createManualTransaction, updateTransactionCategory, deleteTransaction } from "@/services/transactions";

export type ExpenseFormState = { error?: string; success?: boolean } | undefined;

export async function createTransactionAction(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const user = await requireOnboardedUser();

  const raw = {
    date: String(formData.get("date") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    type: String(formData.get("type") ?? "EXPENSE"),
    categoryId: (formData.get("categoryId") as string) || null,
    goalId: (formData.get("goalId") as string) || null,
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
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  return { success: true };
}

export async function updateCategoryAction(transactionId: string, categoryId: string) {
  const user = await requireOnboardedUser();
  await updateTransactionCategory(user.id, transactionId, categoryId);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await requireOnboardedUser();
  await deleteTransaction(user.id, transactionId);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
}
