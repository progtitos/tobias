"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { createAssetSchema, updateAssetValueSchema } from "@/lib/validations/asset";
import { createDebtSchema, updateDebtRemainingSchema } from "@/lib/validations/debt";
import { createAsset, updateAssetValue, deleteAsset } from "@/services/assets";
import { createDebt, updateDebtRemaining, deleteDebt } from "@/services/debts";

// Este arquivo era, até 2026-09-20, uma cópia morta das actions de
// investimento (que na prática vivem em investimentos/actions.ts — nada aqui
// era importado por ninguém). Reaproveitado agora pras actions de "Outros
// bens" e "Dívidas": a lacuna real que o Thiago apontou ("patrimônio líquido
// não faz sentido, isso é só fluxo de caixa entrando e saindo") — o cálculo
// em computeNetWorth já somava assets.estimatedValue e debts.remainingAmount,
// mas não existia NENHUMA forma de cadastrar um bem nem de mexer numa dívida
// depois de criada. Ver claude/backlog.md.
export type PatrimonioFormState = { error?: string; success?: boolean } | undefined;

function revalidateAll() {
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  revalidatePath("/compass");
}

// ---------------------------------------------------------------------------
// Outros bens (assets)
// ---------------------------------------------------------------------------

export async function createAssetAction(_prev: PatrimonioFormState, formData: FormData): Promise<PatrimonioFormState> {
  const user = await requireOnboardedUser();

  const parsed = createAssetSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "OTHER"),
    estimatedValue: Number(formData.get("estimatedValue") ?? 0),
    acquiredAt: (formData.get("acquiredAt") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createAsset(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function updateAssetValueAction(assetId: string, estimatedValue: number) {
  const user = await requireOnboardedUser();
  const parsed = updateAssetValueSchema.safeParse({ estimatedValue });
  if (!parsed.success) return;
  await updateAssetValue(user.id, assetId, parsed.data.estimatedValue);
  revalidateAll();
}

export async function deleteAssetAction(assetId: string) {
  const user = await requireOnboardedUser();
  await deleteAsset(user.id, assetId);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Dívidas
// ---------------------------------------------------------------------------

export async function createDebtAction(_prev: PatrimonioFormState, formData: FormData): Promise<PatrimonioFormState> {
  const user = await requireOnboardedUser();

  const totalAmount = Number(formData.get("totalAmount") ?? 0);
  const parsed = createDebtSchema.safeParse({
    description: String(formData.get("description") ?? ""),
    type: String(formData.get("type") ?? "OTHER"),
    totalAmount,
    // Se a pessoa não souber quanto já pagou, assume que a dívida está
    // inteira em aberto ainda — ela ajusta depois em "Atualizar saldo".
    remainingAmount: formData.get("remainingAmount") ? Number(formData.get("remainingAmount")) : totalAmount,
    interestRateMonthly: formData.get("interestRateMonthly") ? Number(formData.get("interestRateMonthly")) : null,
    installmentAmount: formData.get("installmentAmount") ? Number(formData.get("installmentAmount")) : null,
    installmentsRemaining: formData.get("installmentsRemaining") ? Number(formData.get("installmentsRemaining")) : null,
    dueDay: formData.get("dueDay") ? Number(formData.get("dueDay")) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await createDebt(user.id, parsed.data);
  revalidateAll();
  return { success: true };
}

export async function updateDebtRemainingAction(debtId: string, remainingAmount: number) {
  const user = await requireOnboardedUser();
  const parsed = updateDebtRemainingSchema.safeParse({ remainingAmount });
  if (!parsed.success) return;
  await updateDebtRemaining(user.id, debtId, parsed.data.remainingAmount);
  revalidateAll();
}

export async function deleteDebtAction(debtId: string) {
  const user = await requireOnboardedUser();
  await deleteDebt(user.id, debtId);
  revalidateAll();
}
