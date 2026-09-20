import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, cnisDocumentItems, salaryContributionRecords } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";
import { saveDocumentFile } from "@/lib/storage";
import { trackEvent, logFinancialEvent } from "./analytics";
import { parseDateOnly } from "@/lib/utils/dates";

export type UploadedFile = { buffer: Buffer; mimeType: string; fileName: string };

/**
 * Sobe o Extrato do CNIS (PDF do Meu INSS), lê via IA e guarda as
 * competências candidatas em cnisDocumentItems — nada vira histórico
 * permanente ainda, isso só acontece em confirmCnisImport depois da tela de
 * Revisão. Sem suporte a CSV (o Meu INSS só exporta em PDF).
 */
export async function uploadCnisDocument(userId: string, file: UploadedFile) {
  const fileUrl = await saveDocumentFile(userId, file.buffer, file.mimeType);
  const baseValues = {
    userId,
    fileUrl,
    fileName: file.fileName,
    mimeType: file.mimeType,
    kind: "CNIS_EXTRACT" as const,
  };

  let extracted: { competencia: string; employerName: string | null; salaryAmount: number }[];

  try {
    if (!isAIConfigured()) {
      throw new Error("IA não configurada. Configure a leitura por IA para processar o Extrato do CNIS.");
    }
    const extraction = await AIService.extractCnisStatement([
      { mimeType: file.mimeType, base64: file.buffer.toString("base64") },
    ]);
    extracted = extraction.records;
  } catch (err) {
    console.error("[cnisImport] extraction failed", err);
    const [document] = await db
      .insert(documents)
      .values({
        ...baseValues,
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Não consegui ler este arquivo.",
      })
      .returning();
    return { document, items: [] };
  }

  if (extracted.length === 0) {
    const [document] = await db
      .insert(documents)
      .values({ ...baseValues, status: "FAILED", errorMessage: "Não encontrei nenhuma competência neste extrato." })
      .returning();
    return { document, items: [] };
  }

  const [document] = await db
    .insert(documents)
    .values({
      ...baseValues,
      status: "NEEDS_REVIEW",
      extractedSummary: `${extracted.length} competência${extracted.length === 1 ? "" : "s"} lida${extracted.length === 1 ? "" : "s"}`,
    })
    .returning();

  const items = await db
    .insert(cnisDocumentItems)
    .values(
      extracted.map((r) => ({
        documentId: document.id,
        competencia: parseDateOnly(r.competencia),
        employerName: r.employerName,
        salaryAmount: r.salaryAmount,
        isSelected: true,
      }))
    )
    .returning();

  await trackEvent(userId, "cnis_statement_uploaded", { count: items.length });
  return { document, items };
}

export async function getCnisDocument(userId: string, documentId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!document) return null;
  const items = await db
    .select()
    .from(cnisDocumentItems)
    .where(eq(cnisDocumentItems.documentId, documentId))
    .orderBy(cnisDocumentItems.competencia);
  return { document, items };
}

/**
 * Confirma a importação: SUBSTITUI todo o histórico salarial anterior do
 * usuário pelas linhas selecionadas agora. Faz sentido só porque o Extrato
 * do CNIS, por natureza, já é o histórico completo desde o início da
 * contribuição — reimportar (ex.: uma versão mais atualizada, baixada meses
 * depois) deve refletir o extrato novo inteiro, não empilhar competências
 * em cima de uma importação antiga que pode ter linhas desmarcadas
 * diferente desta vez. A tela de Revisão avisa isso antes de confirmar.
 */
export async function confirmCnisImport(
  userId: string,
  documentId: string,
  selectedItemIds: string[],
  // Valor corrigido na tela de Revisão, por item (ex.: OCR leu "1.800,00"
  // como "18.000,00") — ausente ou não numérico mantém o valor lido pela IA.
  amountByItem: Record<string, number> = {}
): Promise<{ count: number }> {
  const existing = await getCnisDocument(userId, documentId);
  if (!existing) throw new Error("Documento não encontrado");
  const { document, items } = existing;

  const selectedIds = new Set(selectedItemIds);
  const toInsert = items.filter((it) => selectedIds.has(it.id));
  if (toInsert.length === 0) throw new Error("Selecione ao menos uma competência para confirmar.");

  await db.delete(salaryContributionRecords).where(eq(salaryContributionRecords.userId, userId));
  await db.insert(salaryContributionRecords).values(
    toInsert.map((item) => ({
      userId,
      competencia: item.competencia,
      employerName: item.employerName,
      salaryAmount: amountByItem[item.id] != null && amountByItem[item.id] > 0 ? amountByItem[item.id] : item.salaryAmount,
      sourceDocumentId: document.id,
    }))
  );

  await db.update(documents).set({ status: "CONFIRMED" }).where(eq(documents.id, documentId));
  await trackEvent(userId, "cnis_import_confirmed", { documentId, count: toInsert.length });
  await logFinancialEvent(userId, "cnis_import_confirmed", { documentId, count: toInsert.length });

  return { count: toInsert.length };
}

export async function getSalaryHistory(userId: string) {
  return db
    .select()
    .from(salaryContributionRecords)
    .where(eq(salaryContributionRecords.userId, userId))
    .orderBy(salaryContributionRecords.competencia);
}

export async function clearSalaryHistory(userId: string): Promise<void> {
  await db.delete(salaryContributionRecords).where(eq(salaryContributionRecords.userId, userId));
  await trackEvent(userId, "cnis_history_cleared");
}
