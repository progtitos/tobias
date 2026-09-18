import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getInvestmentStatementDocument } from "@/services/investmentStatementImport";
import { listInvestments } from "@/services/investments";
import { db } from "@/lib/db/client";
import { bankAccounts } from "@/lib/db/schema";
import { InvestmentImportReviewClient } from "./InvestmentImportReviewClient";

export default async function InvestmentImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  const existing = await getInvestmentStatementDocument(user.id, id);
  if (!existing) notFound();
  const { document, items } = existing;

  let targetLabel = "";
  if (document.bankAccountId) {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, document.bankAccountId)).limit(1);
    targetLabel = account?.name ?? "Corretora";
  }

  const existingInvestments = await listInvestments(user.id);
  const sameAccountInvestments = existingInvestments.filter((inv) => inv.bankAccountId === document.bankAccountId);

  return (
    <InvestmentImportReviewClient
      documentId={document.id}
      status={document.status}
      errorMessage={document.errorMessage}
      targetLabel={targetLabel}
      existingInvestments={sameAccountInvestments.map((inv) => ({ id: inv.id, name: inv.name }))}
      items={items.map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        investedAmount: it.investedAmount,
        currentAmount: it.currentAmount,
        institution: it.institution,
        liquidity: it.liquidity,
        matchedInvestmentId: it.matchedInvestmentId,
        isSelected: it.isSelected,
      }))}
    />
  );
}
