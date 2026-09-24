import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import type { CreateDebtInput } from "@/lib/validations/debt";

export async function listDebts(userId: string) {
  return db.select().from(debts).where(eq(debts.userId, userId)).orderBy(debts.createdAt);
}

export async function createDebt(userId: string, input: CreateDebtInput) {
  const [debt] = await db
    .insert(debts)
    .values({
      userId,
      description: input.description,
      type: input.type,
      totalAmount: input.totalAmount,
      remainingAmount: input.remainingAmount,
      interestRateMonthly: input.interestRateMonthly ?? null,
      installmentAmount: input.installmentAmount ?? null,
      installmentsRemaining: input.installmentsRemaining ?? null,
      dueDay: input.dueDay ?? null,
    })
    .returning();

  await trackEvent(userId, "debt_created", { type: input.type });
  await logFinancialEvent(userId, "debt_created", { debtId: debt.id, description: input.description });
  return debt;
}

/**
 * Abatimento do saldo devedor — antes disso não existia NENHUMA forma de
 * atualizar uma dívida depois de criada (nem via onboarding, que só faz um
 * insert único). Zerar o saldo marca a dívida como quitada (isActive=false)
 * automaticamente, então ela some da soma que entra no patrimônio líquido
 * sem precisar de uma ação separada de "excluir".
 */
export async function updateDebtRemaining(userId: string, debtId: string, remainingAmount: number) {
  const [debt] = await db
    .update(debts)
    .set({ remainingAmount, isActive: remainingAmount > 0, updatedAt: new Date() })
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .returning();

  if (debt) {
    await trackEvent(userId, "debt_updated", { debtId, remainingAmount });
    await logFinancialEvent(userId, "debt_remaining_updated", { debtId, remainingAmount });
  }
  return debt;
}

export async function deleteDebt(userId: string, debtId: string) {
  await db.delete(debts).where(and(eq(debts.id, debtId), eq(debts.userId, userId)));
  await trackEvent(userId, "debt_deleted", { debtId });
}
