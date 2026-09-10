import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { transactions, categories } from "@/lib/db/schema";
import type { CreateTransactionInput } from "@/lib/validations/transaction";
import { suggestCategory, learnMerchantCategory } from "./categorization";
import { trackEvent, logFinancialEvent } from "./analytics";
import { monthRange } from "./aggregations";

export async function createManualTransaction(userId: string, input: CreateTransactionInput) {
  let categoryId = input.categoryId ?? null;
  let confidence = 1.0;
  let source: typeof transactions.$inferInsert.source = "MANUAL";

  if (!categoryId && input.type === "EXPENSE") {
    const suggestion = await suggestCategory(userId, {
      description: input.description,
      merchant: input.merchant,
      amount: input.amount,
    });
    if (suggestion.categoryId && suggestion.confidence >= 0.6) {
      categoryId = suggestion.categoryId;
      confidence = suggestion.confidence;
      source = suggestion.source === "ai" ? "AI_INFERENCE" : "MANUAL";
    }
  }

  const installmentTotal = input.installmentTotal && input.installmentTotal > 1 ? input.installmentTotal : 1;
  const baseDate = new Date(input.date);
  const groupId = installmentTotal > 1 ? createId() : null;
  const perInstallment = Math.round((input.amount / installmentTotal) * 100) / 100;
  const rounding = Math.round((input.amount - perInstallment * installmentTotal) * 100) / 100;

  const rows: (typeof transactions.$inferInsert)[] = [];
  for (let i = 0; i < installmentTotal; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);
    rows.push({
      userId,
      date,
      amount: i === installmentTotal - 1 ? perInstallment + rounding : perInstallment,
      type: input.type,
      categoryId,
      description: input.description,
      merchant: input.merchant,
      paymentMethod: input.paymentMethod,
      installmentGroupId: groupId,
      installmentNumber: installmentTotal > 1 ? i + 1 : null,
      installmentTotal: installmentTotal > 1 ? installmentTotal : null,
      source,
      confidence,
      notes: input.notes,
    });
  }

  const inserted = await db.insert(transactions).values(rows).returning();
  await trackEvent(userId, "expense_created", { type: input.type, amount: input.amount, installments: installmentTotal });
  await logFinancialEvent(userId, "transaction_created", { count: inserted.length, amount: input.amount });

  return inserted;
}

export async function listTransactions(
  userId: string,
  filters: { start?: Date; end?: Date; categoryId?: string; limit?: number } = {}
) {
  const defaultRange = monthRange();
  const start = filters.start ?? defaultRange.start;
  const end = filters.end ?? defaultRange.end;
  const conditions = [eq(transactions.userId, userId), gte(transactions.date, start), lte(transactions.date, end)];
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));

  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type,
      description: transactions.description,
      merchant: transactions.merchant,
      paymentMethod: transactions.paymentMethod,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      source: transactions.source,
      confidence: transactions.confidence,
      installmentNumber: transactions.installmentNumber,
      installmentTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(filters.limit ?? 200);
}

export async function updateTransactionCategory(userId: string, transactionId: string, categoryId: string) {
  const [tx] = await db
    .update(transactions)
    .set({ categoryId, confidence: 1.0, source: "MANUAL", updatedAt: new Date() })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .returning();

  if (tx?.merchant) await learnMerchantCategory(userId, tx.merchant, categoryId);
  return tx;
}

export async function deleteTransaction(userId: string, transactionId: string) {
  await db.delete(transactions).where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
}
