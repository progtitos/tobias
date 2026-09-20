import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getCnisDocument } from "@/services/cnisImport";
import { CnisReviewClient } from "./CnisReviewClient";

export default async function CnisReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  const existing = await getCnisDocument(user.id, id);
  if (!existing) notFound();
  const { document, items } = existing;

  return (
    <CnisReviewClient
      documentId={document.id}
      status={document.status}
      errorMessage={document.errorMessage}
      items={items.map((it) => ({
        id: it.id,
        competencia: it.competencia.toISOString(),
        employerName: it.employerName,
        salaryAmount: it.salaryAmount,
        isSelected: it.isSelected,
      }))}
    />
  );
}
