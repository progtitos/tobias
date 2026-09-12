import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, merchantCategoryMemories } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";

function normalizeMerchant(merchant: string): string {
  return merchant
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export async function getUserCategories(userId: string) {
  const global = await db.select().from(categories).where(isNull(categories.userId));
  const custom = await db.select().from(categories).where(eq(categories.userId, userId));
  return [...global, ...custom];
}

/**
 * Categorization pipeline (spec §11): first check what the user already
 * taught Tobias for this merchant (deterministic, instant, no AI call).
 * Only fall back to the AI classifier when there's no learned mapping yet,
 * and surface its confidence so the UI can ask instead of assuming when it's
 * low (spec §10).
 */
export async function suggestCategory(
  userId: string,
  input: { description: string; merchant?: string | null; amount: number }
): Promise<{ categoryId: string | null; confidence: number; source: "learned" | "ai" | "none" }> {
  if (input.merchant) {
    const normalized = normalizeMerchant(input.merchant);
    const [learned] = await db
      .select()
      .from(merchantCategoryMemories)
      .where(and(eq(merchantCategoryMemories.userId, userId), eq(merchantCategoryMemories.merchantNormalized, normalized)))
      .limit(1);
    if (learned) return { categoryId: learned.categoryId, confidence: 0.98, source: "learned" };
  }

  if (!isAIConfigured()) return { categoryId: null, confidence: 0, source: "none" };

  const userCategories = await getUserCategories(userId);
  const expenseCategories = userCategories.filter((c) => c.type === "EXPENSE" && !c.parentId);
  try {
    const result = await AIService.classifyTransaction({
      description: input.description,
      merchant: input.merchant,
      amount: input.amount,
      categories: expenseCategories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    });
    return { categoryId: result.categoryId, confidence: result.confidence, source: "ai" };
  } catch {
    return { categoryId: null, confidence: 0, source: "none" };
  }
}

/**
 * Casa um "palpite" de categoria em texto puro (já produzido pela IA na
 * hora de LER um extrato/fatura, ver AIService.extractStatement) com uma
 * categoria de verdade do usuário, sem nenhuma chamada de IA nova. Usado
 * na confirmação de importação de extrato/fatura, que pode ter 100+ linhas
 * de uma vez e não pode se dar ao luxo de mais uma chamada de IA por linha
 * ali (é exatamente isso que travava a confirmação, estourando o tempo
 * limite da função serverless da Vercel) — o palpite em texto já veio de
 * graça junto da leitura, então só falta casar com o nome certo.
 */
export function matchCategoryByGuess(
  categoriesList: { id: string; name: string; type: string }[],
  guess: string | null | undefined
): string | null {
  if (!guess) return null;
  const normalized = guess.trim().toLowerCase();
  if (!normalized) return null;
  const exact = categoriesList.find((c) => c.name.toLowerCase() === normalized);
  if (exact) return exact.id;
  const loose = categoriesList.find(
    (c) => c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase())
  );
  return loose?.id ?? null;
}

/** Called whenever a user confirms or corrects a category — this is what makes Tobias "learn" (spec §11). */
export async function learnMerchantCategory(userId: string, merchant: string, categoryId: string) {
  const normalized = normalizeMerchant(merchant);
  if (!normalized) return;

  const [existing] = await db
    .select()
    .from(merchantCategoryMemories)
    .where(and(eq(merchantCategoryMemories.userId, userId), eq(merchantCategoryMemories.merchantNormalized, normalized)))
    .limit(1);

  if (existing) {
    await db
      .update(merchantCategoryMemories)
      .set({ categoryId, timesConfirmed: existing.timesConfirmed + 1, updatedAt: new Date() })
      .where(eq(merchantCategoryMemories.id, existing.id));
  } else {
    await db.insert(merchantCategoryMemories).values({ userId, merchantNormalized: normalized, categoryId });
  }
}
