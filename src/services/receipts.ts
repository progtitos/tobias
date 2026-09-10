import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { receipts, receiptItems, transactions } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";
import { saveReceiptImage } from "@/lib/storage";
import { suggestCategory, learnMerchantCategory } from "./categorization";
import { trackEvent, logFinancialEvent } from "./analytics";

export const LOW_CONFIDENCE_THRESHOLD = 0.65;

export type UploadedImage = { buffer: Buffer; mimeType: string };

/**
 * ReceiptService — Document Agent. Today's implementation reads a
 * photographed receipt via Gemini vision (AI_VISION). The `extractionMethod`
 * field on Receipt is what lets a future QR-code/NFC-e lookup or a state tax
 * API slot in later without touching the rest of the pipeline (spec §6).
 */
export async function processReceiptUpload(userId: string, images: UploadedImage[]) {
  const imageUrls = await Promise.all(images.map((img) => saveReceiptImage(userId, img.buffer, img.mimeType)));

  if (!isAIConfigured()) {
    const [receipt] = await db
      .insert(receipts)
      .values({
        userId,
        imageUrls,
        status: "FAILED",
        errorMessage: "IA não configurada. Não é possível ler a nota automaticamente.",
        confidence: 0,
      })
      .returning();
    return { receipt, items: [] };
  }

  try {
    const extraction = await AIService.extractReceipt(
      images.map((img) => ({ mimeType: img.mimeType, base64: img.buffer.toString("base64") }))
    );

    // Always goes through a confirmation screen before becoming a transaction (spec §7), regardless of confidence.
    const status = "NEEDS_REVIEW" as const;
    const [receipt] = await db
      .insert(receipts)
      .values({
        userId,
        imageUrls,
        merchant: extraction.merchant,
        cnpj: extraction.cnpj,
        purchaseDate: extraction.purchaseDate ? new Date(extraction.purchaseDate) : null,
        purchaseTime: extraction.purchaseTime,
        totalAmount: extraction.totalAmount,
        paymentMethod: extraction.paymentMethod,
        status,
        extractionMethod: "AI_VISION",
        confidence: extraction.confidence,
      })
      .returning();

    let items: (typeof receiptItems.$inferSelect)[] = [];
    if (extraction.items.length > 0) {
      items = await db
        .insert(receiptItems)
        .values(
          extraction.items.map((it) => ({
            receiptId: receipt.id,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            categoryGuess: it.categoryGuess,
          }))
        )
        .returning();
    }

    await trackEvent(userId, "receipt_uploaded", { photos: images.length });
    await trackEvent(userId, "receipt_processed", { confidence: extraction.confidence, itemCount: items.length });

    return { receipt, items };
  } catch (err) {
    console.error("[receipts] extraction failed", err);
    const [receipt] = await db
      .insert(receipts)
      .values({
        userId,
        imageUrls,
        status: "FAILED",
        errorMessage: "Não consegui ler essa nota completamente. Você pode tirar outra foto ou lançar o gasto manualmente.",
        confidence: 0,
      })
      .returning();
    return { receipt, items: [] };
  }
}

export async function getReceipt(userId: string, receiptId: string) {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)))
    .limit(1);
  if (!receipt) return null;
  const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, receiptId));
  return { receipt, items };
}

/** Confirms (with optional user edits) and creates the corresponding Transaction. */
export async function confirmReceipt(
  userId: string,
  receiptId: string,
  edits: { merchant?: string; totalAmount?: number; categoryId?: string; date?: string }
) {
  const existing = await getReceipt(userId, receiptId);
  if (!existing) throw new Error("Nota não encontrada");

  const merchant = edits.merchant ?? existing.receipt.merchant ?? "Compra";
  const totalAmount = edits.totalAmount ?? existing.receipt.totalAmount ?? 0;
  const date = edits.date ? new Date(edits.date) : existing.receipt.purchaseDate ?? new Date();

  let categoryId = edits.categoryId ?? null;
  if (!categoryId) {
    const suggestion = await suggestCategory(userId, { description: merchant, merchant, amount: totalAmount });
    categoryId = suggestion.categoryId;
  } else {
    await learnMerchantCategory(userId, merchant, categoryId);
  }

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId,
      date,
      amount: totalAmount,
      type: "EXPENSE",
      categoryId,
      description: `Compra em ${merchant}`,
      merchant,
      paymentMethod: existing.receipt.paymentMethod,
      receiptId,
      source: "RECEIPT",
      confidence: existing.receipt.confidence ?? 0.8,
    })
    .returning();

  await db
    .update(receipts)
    .set({ status: "CONFIRMED", merchant, totalAmount, updatedAt: new Date() })
    .where(eq(receipts.id, receiptId));

  await trackEvent(userId, "receipt_confirmed", { amount: totalAmount });
  await logFinancialEvent(userId, "receipt_confirmed", { receiptId, amount: totalAmount });

  return transaction;
}
