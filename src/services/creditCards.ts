import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { creditCards, bankAccounts } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import type { CreateCreditCardInput } from "@/lib/validations/creditCard";

export async function listCreditCards(userId: string) {
  return db.select().from(creditCards).where(eq(creditCards.userId, userId)).orderBy(creditCards.createdAt);
}

export async function createCreditCard(userId: string, input: CreateCreditCardInput) {
  const [account] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.userId, userId)))
    .limit(1);
  if (!account) throw new Error("Conta não encontrada");

  const [card] = await db
    .insert(creditCards)
    .values({
      userId,
      bankAccountId: account.id,
      nickname: input.nickname,
      brand: input.brand || null,
      lastFourDigits: input.lastFourDigits || null,
      limitAmount: input.limitAmount ?? null,
      closingDay: input.closingDay ?? null,
      dueDay: input.dueDay ?? null,
    })
    .returning();

  await trackEvent(userId, "credit_card_created", { bankAccountId: account.id });
  await logFinancialEvent(userId, "credit_card_created", { creditCardId: card.id, nickname: card.nickname });
  return card;
}

export async function deleteCreditCard(userId: string, creditCardId: string) {
  await db.delete(creditCards).where(and(eq(creditCards.id, creditCardId), eq(creditCards.userId, userId)));
  await logFinancialEvent(userId, "credit_card_deleted", { creditCardId });
}
