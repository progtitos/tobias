import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, merchantCategoryMemories, recurringCategoryRules } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";

function normalizeMerchant(merchant: string): string {
  return merchant
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

// Mesma normalização de merchantNormalized/normalizeMerchant, mas sem tirar
// espaço nenhum caractere específico a mais — é só pra deixar acento/caixa
// consistentes tanto na hora de salvar a regra quanto na hora de comparar
// contra a descrição inteira de uma linha do extrato (que essa, ao
// contrário do nome de um merchant, pode ter números/pontuação que fazem
// parte do texto e não devem sumir, senão "quinto andar" viraria
// impossível de digitar errado mas também impossível de digitar certo).
function normalizeForContains(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

/**
 * Regras "contém" do usuário (ver recurringCategoryRules na schema) — busca
 * uma vez só antes de rodar contra todas as linhas de um extrato, em vez de
 * uma consulta por linha (mesmo motivo do userCategories em
 * confirmStatementImport).
 */
export async function getRecurringCategoryRules(userId: string) {
  return db.select().from(recurringCategoryRules).where(eq(recurringCategoryRules.userId, userId));
}

/**
 * Casa a descrição de uma linha do extrato contra as regras "contém" já
 * carregadas. Primeira regra que bater vence — na prática cada pessoa só
 * cadastra um punhado de regras (aluguel, mensalidade da escola...), então
 * colisão entre duas regras é improvável, mas se acontecer, a mais antiga
 * (ordem de criação) prevalece.
 */
export function matchRecurringCategoryRule(
  rules: { keywordNormalized: string; categoryId: string }[],
  description: string
): string | null {
  const normalizedDescription = normalizeForContains(description);
  if (!normalizedDescription) return null;
  const match = rules.find((r) => r.keywordNormalized && normalizedDescription.includes(r.keywordNormalized));
  return match?.categoryId ?? null;
}

/**
 * Salva (ou atualiza a categoria de) uma regra "contém" — chamado quando a
 * pessoa marca "categorizar automaticamente sempre" na Revisão de um
 * extrato/fatura, pra um gasto fixo mensal (aluguel, mensalidade) que
 * aparece em todo extrato com uma descrição levemente diferente.
 */
export async function saveRecurringCategoryRule(userId: string, keyword: string, categoryId: string) {
  const keywordNormalized = normalizeForContains(keyword);
  if (!keywordNormalized) return;

  const [existing] = await db
    .select()
    .from(recurringCategoryRules)
    .where(and(eq(recurringCategoryRules.userId, userId), eq(recurringCategoryRules.keywordNormalized, keywordNormalized)))
    .limit(1);

  if (existing) {
    await db.update(recurringCategoryRules).set({ categoryId, keyword }).where(eq(recurringCategoryRules.id, existing.id));
  } else {
    await db.insert(recurringCategoryRules).values({ userId, keyword, keywordNormalized, categoryId });
  }
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
