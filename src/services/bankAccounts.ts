import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccounts } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import type { CreateBankAccountInput } from "@/lib/validations/bankAccount";

export async function listBankAccounts(userId: string) {
  return db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).orderBy(bankAccounts.createdAt);
}

export async function createBankAccount(userId: string, input: CreateBankAccountInput) {
  const [account] = await db
    .insert(bankAccounts)
    .values({
      userId,
      name: input.name,
      bankName: input.bankName || null,
      type: input.type,
      balance: input.balance,
    })
    .returning();

  await trackEvent(userId, "bank_account_created", { type: input.type });
  await logFinancialEvent(userId, "bank_account_created", { accountId: account.id, name: input.name });
  return account;
}

/**
 * A bank balance here is self-reported (there's no Open Finance connection
 * yet — the enum value is reserved in the schema but unimplemented), so the
 * only way it moves is the person telling Tobias what it actually is right
 * now. That flows straight into computeNetWorth/computeEmergencyReserve, so
 * this is the one place a balance changes for a manually-tracked account.
 */
export async function updateBankAccountBalance(userId: string, accountId: string, balance: number) {
  const [account] = await db
    .update(bankAccounts)
    .set({ balance, updatedAt: new Date() })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId)))
    .returning();

  if (account) {
    await trackEvent(userId, "bank_account_updated", { accountId, balance });
    await logFinancialEvent(userId, "bank_account_balance_updated", { accountId, balance });
  }
  return account;
}

/**
 * Inactive accounts (a closed checking account, an old wallet) drop out of
 * computeNetWorth/computeEmergencyReserve's SUM(...) WHERE isActive filters
 * automatically — no separate "archive" cleanup needed elsewhere.
 */
export async function toggleBankAccountActive(userId: string, accountId: string, isActive: boolean) {
  await db
    .update(bankAccounts)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId)));
  await trackEvent(userId, "bank_account_updated", { accountId, isActive });
}

export async function deleteBankAccount(userId: string, accountId: string) {
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId)));
}
