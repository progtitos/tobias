import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getStatementDocument } from "@/services/statementImport";
import { getUserCategories, getRecurringCategoryRules, matchRecurringCategoryRule, matchCategoryByGuess } from "@/services/categorization";
import { db } from "@/lib/db/client";
import { bankAccounts, creditCards } from "@/lib/db/schema";
import { ImportReviewClient } from "./ImportReviewClient";

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  const existing = await getStatementDocument(user.id, id);
  if (!existing) notFound();
  const { document, items } = existing;

  let targetLabel = "";
  if (document.bankAccountId) {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, document.bankAccountId)).limit(1);
    targetLabel = account?.name ?? "Conta";
  } else if (document.creditCardId) {
    const [card] = await db.select().from(creditCards).where(eq(creditCards.id, document.creditCardId)).limit(1);
    targetLabel = card?.nickname ?? "Cartão";
  }

  // Pré-seleciona a categoria de cada linha antes de mostrar a tela de
  // Revisão: uma regra "contém" que a pessoa já cadastrou (ex: "quinto
  // andar" -> Moradia) vale mais que o palpite da IA, já que é algo que ela
  // mesma confirmou de propósito pra esse gasto fixo. Sem regra, cai no
  // palpite de sempre.
  const [userCategories, recurringRules] = await Promise.all([getUserCategories(user.id), getRecurringCategoryRules(user.id)]);
  const expenseCategories = userCategories.filter((c) => c.type === "EXPENSE" && !c.parentId);
  const suggestedCategoryByItem = new Map(
    items.map((it) => [
      it.id,
      matchRecurringCategoryRule(recurringRules, it.description) ?? matchCategoryByGuess(expenseCategories, it.categoryGuess),
    ])
  );

  return (
    <ImportReviewClient
      documentId={document.id}
      status={document.status}
      errorMessage={document.errorMessage}
      targetLabel={targetLabel}
      kind={document.kind}
      periodStart={document.periodStart ? document.periodStart.toISOString() : null}
      periodEnd={document.periodEnd ? document.periodEnd.toISOString() : null}
      categories={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((it) => ({
        id: it.id,
        date: it.date.toISOString(),
        description: it.description,
        amount: it.amount,
        type: it.type,
        categoryGuess: it.categoryGuess,
        suggestedCategoryId: suggestedCategoryByItem.get(it.id) ?? null,
        installmentNumber: it.installmentNumber,
        installmentTotal: it.installmentTotal,
        isDuplicate: it.isDuplicate,
        isSelected: it.isSelected,
      }))}
    />
  );
}
