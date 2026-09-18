import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, investmentDocumentItems, investments, bankAccounts } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";
import { saveDocumentFile } from "@/lib/storage";
import { trackEvent, logFinancialEvent } from "./analytics";

export type UploadedFile = { buffer: Buffer; mimeType: string; fileName: string };

/**
 * Palpite de qual investimento já cadastrado uma linha extraída provavelmente
 * é — mesma corretora (bankAccountId) e nome parecido (substring em qualquer
 * direção, sem acento/maiúscula pra não perder por causa disso). Conservador
 * de propósito: um falso negativo aqui só custa criar um investimento
 * duplicado que a pessoa apaga na Revisão; um falso positivo sobrescreveria
 * o valor de um investimento errado sem a pessoa perceber, então só casa
 * quando o nome realmente bate.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

async function findMatchingInvestment(
  userId: string,
  bankAccountId: string,
  name: string
): Promise<string | null> {
  const existing = await db
    .select({ id: investments.id, name: investments.name })
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.bankAccountId, bankAccountId)));

  const normalizedName = normalize(name);
  const match = existing.find((inv) => {
    const normalizedExisting = normalize(inv.name);
    return normalizedExisting.includes(normalizedName) || normalizedName.includes(normalizedExisting);
  });
  return match?.id ?? null;
}

/**
 * Sobe o extrato consolidado de uma corretora (bankAccountId de uma conta
 * type=INVESTMENT), lê via IA e guarda as posições candidatas em
 * investmentDocumentItems — nada vira Investment de verdade ainda, isso só
 * acontece em confirmInvestmentStatementImport depois da tela de Revisão.
 * Sem suporte a CSV nesta primeira versão (um consolidado de investimentos
 * quase sempre chega em PDF; se isso virar um pedido real, dá pra somar um
 * parser de CSV específico depois, seguindo o mesmo modelo de
 * csvStatement.ts).
 */
export async function uploadInvestmentStatementDocument(userId: string, file: UploadedFile, bankAccountId: string) {
  const [account] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.userId, userId)))
    .limit(1);
  if (!account) throw new Error("Corretora não encontrada");

  const fileUrl = await saveDocumentFile(userId, file.buffer, file.mimeType);
  const baseValues = {
    userId,
    bankAccountId,
    fileUrl,
    fileName: file.fileName,
    mimeType: file.mimeType,
    kind: "INVESTMENT_STATEMENT" as const,
  };

  let extracted: { name: string; type: string; investedAmount: number | null; currentAmount: number; institution: string | null; liquidity: string | null }[];

  try {
    if (!isAIConfigured()) {
      throw new Error("IA não configurada. Configure a leitura por IA para processar o extrato consolidado.");
    }
    const extraction = await AIService.extractInvestmentStatement([
      { mimeType: file.mimeType, base64: file.buffer.toString("base64") },
    ]);
    extracted = extraction.holdings;
  } catch (err) {
    console.error("[investmentStatementImport] extraction failed", err);
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
      .values({ ...baseValues, status: "FAILED", errorMessage: "Não encontrei nenhum ativo neste extrato." })
      .returning();
    return { document, items: [] };
  }

  const [document] = await db
    .insert(documents)
    .values({
      ...baseValues,
      status: "NEEDS_REVIEW",
      extractedSummary: `${extracted.length} ativo${extracted.length === 1 ? "" : "s"} lido${extracted.length === 1 ? "" : "s"}`,
    })
    .returning();

  const items = await db
    .insert(investmentDocumentItems)
    .values(
      await Promise.all(
        extracted.map(async (h) => ({
          documentId: document.id,
          name: h.name,
          type: h.type as (typeof investments.$inferInsert)["type"],
          investedAmount: h.investedAmount,
          currentAmount: h.currentAmount,
          institution: h.institution,
          liquidity: h.liquidity,
          matchedInvestmentId: await findMatchingInvestment(userId, bankAccountId, h.name),
          isSelected: true,
        }))
      )
    )
    .returning();

  await trackEvent(userId, "investment_statement_uploaded", { count: items.length });
  return { document, items };
}

export async function getInvestmentStatementDocument(userId: string, documentId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!document) return null;
  const items = await db.select().from(investmentDocumentItems).where(eq(investmentDocumentItems.documentId, documentId));
  return { document, items };
}

/**
 * Confirma a importação: para cada linha selecionada, se ela já veio casada
 * com um investimento existente (matchedInvestmentId, possivelmente trocado
 * na Revisão) ATUALIZA o valor atual dele — igual a "Atualizar valor" na
 * tela de Investimentos, só que em lote — em vez de criar duplicata; senão
 * CRIA um investimento novo, ligado à mesma corretora.
 */
export async function confirmInvestmentStatementImport(
  userId: string,
  documentId: string,
  selectedItemIds: string[],
  // Pra cada linha selecionada, o investimento existente escolhido na
  // Revisão para atualizar — "" ou ausente significa "criar novo" mesmo que
  // a leitura automática tenha sugerido um palpite de match.
  matchByItem: Record<string, string> = {}
): Promise<{ createdCount: number; updatedCount: number }> {
  const existing = await getInvestmentStatementDocument(userId, documentId);
  if (!existing) throw new Error("Documento não encontrado");
  const { document, items } = existing;
  if (!document.bankAccountId) throw new Error("Documento sem corretora associada");
  const bankAccountId = document.bankAccountId;

  const selectedIds = new Set(selectedItemIds);
  const toImport = items.filter((it) => selectedIds.has(it.id));

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of toImport) {
    const matchedId = matchByItem[item.id] || item.matchedInvestmentId || null;

    if (matchedId) {
      const [updated] = await db
        .update(investments)
        .set({
          currentAmount: item.currentAmount,
          ...(item.investedAmount != null ? { investedAmount: item.investedAmount } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(investments.id, matchedId), eq(investments.userId, userId)))
        .returning();
      if (updated) {
        updatedCount++;
        await logFinancialEvent(userId, "investment_value_updated", { investmentId: updated.id, currentAmount: updated.currentAmount });
      }
    } else {
      const [created] = await db
        .insert(investments)
        .values({
          userId,
          bankAccountId,
          name: item.name,
          type: item.type,
          investedAmount: item.investedAmount ?? item.currentAmount,
          currentAmount: item.currentAmount,
          institution: item.institution,
          liquidity: item.liquidity,
          source: document.mimeType === "application/pdf" ? "PDF" : "OCR",
        })
        .returning();
      createdCount++;
      await logFinancialEvent(userId, "investment_created", { investmentId: created.id, name: created.name });
    }
  }

  await db.update(documents).set({ status: "CONFIRMED" }).where(eq(documents.id, documentId));
  await trackEvent(userId, "investment_statement_import_confirmed", { documentId, createdCount, updatedCount });

  return { createdCount, updatedCount };
}
