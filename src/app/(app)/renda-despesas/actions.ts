"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import {
  createIncomeSource,
  updateIncomeSource,
  createFixedExpense,
  updateFixedExpense,
  confirmPendingTransaction,
  dismissPendingTransaction,
  type IncomeSourceKind,
} from "@/services/incomeExpenseSources";

export type RendaDespesasFormState = { error?: string } | undefined;

function revalidateAll() {
  revalidatePath("/renda-despesas");
  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
}

export async function createIncomeSourceAction(
  _prev: RendaDespesasFormState,
  formData: FormData
): Promise<RendaDespesasFormState> {
  const user = await requireOnboardedUser();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  if (!description) return { error: "Dê um nome pra essa fonte de renda." };
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };

  await createIncomeSource(user.id, {
    description,
    amount,
    deductionAmount: formData.get("deductionAmount") ? Number(formData.get("deductionAmount")) : null,
    category: (formData.get("category") as IncomeSourceKind) ?? "OTHER",
    categoryId: (formData.get("categoryId") as string) || null,
    deductionCategoryId: (formData.get("deductionCategoryId") as string) || null,
    dayOfMonth: formData.get("dayOfMonth") ? Number(formData.get("dayOfMonth")) : null,
  });
  revalidateAll();
}

export async function updateIncomeSourceAction(id: string, isActive: boolean) {
  const user = await requireOnboardedUser();
  await updateIncomeSource(user.id, id, { isActive });
  revalidateAll();
}

export async function createFixedExpenseAction(
  _prev: RendaDespesasFormState,
  formData: FormData
): Promise<RendaDespesasFormState> {
  const user = await requireOnboardedUser();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  if (!description) return { error: "Dê um nome pra esse gasto fixo." };
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };

  await createFixedExpense(user.id, {
    description,
    amount,
    categoryId: (formData.get("categoryId") as string) || null,
    dayOfMonth: formData.get("dayOfMonth") ? Number(formData.get("dayOfMonth")) : null,
  });
  revalidateAll();
}

export async function updateFixedExpenseAction(id: string, isActive: boolean) {
  const user = await requireOnboardedUser();
  await updateFixedExpense(user.id, id, { isActive });
  revalidateAll();
}

export async function confirmPendingTransactionAction(transactionId: string, adjustedAmount?: number) {
  const user = await requireOnboardedUser();
  await confirmPendingTransaction(user.id, transactionId, adjustedAmount);
  revalidateAll();
}

export async function dismissPendingTransactionAction(transactionId: string) {
  const user = await requireOnboardedUser();
  await dismissPendingTransaction(user.id, transactionId);
  revalidateAll();
}
