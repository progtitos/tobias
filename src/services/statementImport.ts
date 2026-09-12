import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentItems, transactions, bankAccounts, creditCards } from "@/lib/db/schema";
import { AIService, isAIConfigured } from "@/lib/ai/AIService";
import { saveDocumentFile } from "@/lib/storage";
import { parseCsvStatement } from "@/lib/utils/csvStatement";
import { getUserCategories, matchCategoryByGuess, matchRecurringCategoryRule, getRecurringCategoryRules, learnRecurringCategoryRule } from "./categorization";
import { trackEvent, logFinancialEvent } from "./analytics";
import { adjustBankAccountBalance } from "./bankAccounts";
import { parseDateOnly } from "@/lib/utils/dates";

export type UploadedFile = { buffer: Buffer; mimeType: string; fileName: string };
export type ImportTarget = { bankAccountId: string } | { creditCardId: string };

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);

function documentKindFor(target: ImportTarget) {
  return "bankAccountId" in target ? ("BANK_STATEMENT" as const) : ("INVOICE_STATEMENT" as const);
}

/**
 * Duplicata simples e propositalmente conservadora: mesma conta/cartão,
 * mesma data (dia exato) e mesmo valor já lançado. Descrição não entra na
 * comparação — o texto de um extrato quase nunca bate literalmente com o
 * que a pessoa digitou à mão ("Uber *Trip Sao Paulo" vs. "Uber"), então
 * exigir isso deixaria passar duplicata de verdade. Falso positivo aqui só
 * custa um clique a mais pra selecionar a linha; falso negativo custa um
 * gasto lançado em dobro.
 */
async function findExistingDuplicate(
  userId: string,
  target: ImportTarget,
  date: Date,
  amount: number
): Promise<boolean> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const targetCondition =
    "bankAccountId" in target
      ? eq(transactions.bankAccountId, target.bankAccountId)
      : eq(transactions.creditCardId, target.creditCardId);

  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), targetCondition, gte(transactions.date, dayStart), lte(transactions.date, dayEnd), eq(transactions.amount, amount))
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Sobe o arquivo, lê (IA pra PDF/foto, parser local pra CSV) e já guarda as
 * linhas candidatas em documentItems — nada vira Transaction real ainda,
 * isso só acontece em confirmStatementImport depois da tela de Revisão.
 */
export async function uploadStatementDocument(userId: string, file: UploadedFile, target: ImportTarget) {
  if ("bankAccountId" in target) {
    const [account] = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, target.bankAccountId), eq(bankAccounts.userId, userId)))
      .limit(1);
    if (!account) throw new Error("Conta não encontrada");
  } else {
    const [card] = await db
      .select({ id: creditCards.id })
      .from(creditCards)
      .where(and(eq(creditCards.id, target.creditCardId), eq(creditCards.userId, userId)))
      .limit(1);
    if (!card) throw new Error("Cartão não encontrado");
  }

  const kind = documentKindFor(target);
  const fileUrl = await saveDocumentFile(userId, file.buffer, file.mimeType);

  const baseValues = {
    userId,
    ...("bankAccountId" in target ? { bankAccountId: target.bankAccountId } : { creditCardId: target.creditCardId }),
    fileUrl,
    fileName: file.fileName,
    mimeType: file.mimeType,
    kind,
  };

  let extracted: { date: string; description: string; amount: number; type: "EXPENSE" | "INCOME"; categoryGuess?: string | null; installmentNumber?: number | null; installmentTotal?: number | null }[];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  try {
    if (CSV_MIME_TYPES.has(file.mimeType) || file.fileName.toLowerCase().endsWith(".csv")) {
      const result = parseCsvStatement(file.buffer.toString("utf-8"), kind);
      if ("error" in result) throw new Error(result.error);
      extracted = result.rows;
    } else if (!isAIConfigured()) {
      throw new Error("IA não configurada. Envie um CSV, ou configure a leitura por IA para PDF/foto.");
    } else {
      const extraction = await AIService.extractStatement([{ mimeType: file.mimeType, base64: file.buffer.toString("base64") }], kind);
      extracted = extraction.transactions;
      periodStart = extraction.periodStart;
      periodEnd = extraction.periodEnd;
    }
  } catch (err) {
    console.error("[statementImport] extraction failed", err);
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
      .values({ ...baseValues, status: "FAILED", errorMessage: "Não encontrei nenhuma transação neste arquivo." })
      .returning();
    return { document, items: [] };
  }

  const [document] = await db
    .insert(documents)
    .values({
      ...baseValues,
      status: "NEEDS_REVIEW",
      periodStart: periodStart ? parseDateOnly(periodStart) : null,
      periodEnd: periodEnd ? parseDateOnly(periodEnd) : null,
      extractedSummary: `${extracted.length} transações lidas`,
    })
    .returning();

  const items = await db
    .insert(documentItems)
    .values(
      await Promise.all(
        extracted.map(async (t) => {
          const isDuplicate = await findExistingDuplicate(userId, target, parseDateOnly(t.date), t.amount);
          return {
            documentId: document.id,
            date: parseDateOnly(t.date),
            description: t.description,
            amount: t.amount,
            type: t.type,
            categoryGuess: t.categoryGuess ?? null,
            installmentNumber: t.installmentNumber ?? null,
            installmentTotal: t.installmentTotal ?? null,
            isDuplicate,
            isSelected: !isDuplicate,
          };
        })
      )
    )
    .returning();

  await trackEvent(userId, "statement_uploaded", { kind, count: items.length });
  return { document, items };
}

export async function getStatementDocument(userId: string, documentId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!document) return null;
  const items = await db.select().from(documentItems).where(eq(documentItems.documentId, documentId));
  return { document, items };
}

/**
 * Confirma a importação: cria uma Transaction de verdade por linha marcada
 * como selecionada (as demais são só descartadas, não excluídas de algum
 * outro jeito — nunca existiram como Transaction). Cada linha já é uma
 * ocorrência específica com data e valor próprios — diferente do lançamento
 * manual parcelado, aqui não há nada pra projetar/dividir.
 */
export async function confirmStatementImport(
  userId: string,
  documentId: string,
  selectedItemIds: string[],
  // Categoria escolhida na tela de Revisão para cada linha (id -> categoryId)
  // — a Revisão já mostra um seletor por linha, pré-preenchido com a melhor
  // sugestão disponível (regra "contém" ou palpite da IA), então o valor que
  // chega aqui é sempre a categoria final, não mais um palpite a reconferir.
  categoryByItem: Record<string, string> = {},
  // Palavra-chave só presente nas linhas marcadas "categorizar assim
  // sempre" na Revisão — vira uma regra permanente (ver
  // recurringCategoryRules) pra um gasto fixo mensal (aluguel, mensalidade)
  // que aparece em todo extrato com uma descrição levemente diferente.
  keywordByItem: Record<string, string> = {}
): Promise<{ count: number }> {
  const existing = await getStatementDocument(userId, documentId);
  if (!existing) throw new Error("Documento não encontrado");
  const { document, items } = existing;

  const target: ImportTarget =
    document.bankAccountId ? { bankAccountId: document.bankAccountId } : { creditCardId: document.creditCardId! };
  const selectedIds = new Set(selectedItemIds);
  const toInsert = items.filter((it) => selectedIds.has(it.id));

  // Fallback só entra em jogo se por algum motivo a linha chegar sem
  // categoria escolhida no formulário (ex: chamada antiga/direta da action).
  // Casa o `categoryGuess` (texto) que a IA já produziu na hora de LER o
  // extrato/fatura com as categorias reais do usuário — sem nenhuma chamada
  // de IA nova aqui. Uma importação pode ter 100+ linhas de uma vez; chamar
  // a IA de novo por linha (como antes, via suggestCategory) estourava o
  // tempo limite da função serverless da Vercel e travava a confirmação sem
  // erro visível. Uma única leitura das categorias antes do loop, em vez de
  // uma consulta por linha.
  const userCategories = await getUserCategories(userId);
  let recurringRules = await getRecurringCategoryRules(userId);

  let insertedCount = 0;
  for (const item of toInsert) {
    const categoryId =
      categoryByItem[item.id] ||
      matchRecurringCategoryRule(recurringRules, item.description) ||
      matchCategoryByGuess(userCategories, item.categoryGuess);

    const [inserted] = await db
      .insert(transactions)
      .values({
        userId,
        date: item.date,
        amount: item.amount,
        type: item.type,
        categoryId,
        description: item.description,
        paymentMethod: "creditCardId" in target ? "CREDIT_CARD" : null,
        bankAccountId: "bankAccountId" in target ? target.bankAccountId : null,
        creditCardId: "creditCardId" in target ? target.creditCardId : null,
        installmentNumber: item.installmentNumber,
        installmentTotal: item.installmentTotal,
        source: document.mimeType.includes("csv") ? "CSV" : document.mimeType === "application/pdf" ? "PDF" : "OCR",
        confidence: 0.85,
      })
      .returning();
    insertedCount++;

    // Sem "aprender" o merchant aqui: a descrição crua de um extrato ("UBER
    // *TRIP SAO PAULO 09/09") é ruidosa demais pra virar memória confiável
    // de categorização, ao contrário do nome limpo que a pessoa digita à
    // mão — aprender com isso faria mais mal que bem a lançamentos futuros.
    // A regra explícita "categorizar assim sempre" (abaixo) é o jeito
    // pensado pra isso em extrato/fatura, com uma palavra-chave escolhida à
    // mão em vez de aprendida automaticamente do texto cru.
    const keyword = keywordByItem[item.id];
    if (keyword && categoryId) {
      await learnRecurringCategoryRule(userId, keyword, categoryId);
      // Atualiza a lista em memória pra já valer pras próximas linhas deste
      // mesmo lote (ex: o mesmo aluguel aparecendo duas vezes no extrato).
      recurringRules = await getRecurringCategoryRules(userId);
    }

    // Só extrato de CONTA move o saldo dela (mesma regra do lançamento
    // manual) — compra de cartão só afeta a conta quando a fatura for paga,
    // o que é um lançamento à parte, não a compra em si.
    if ("bankAccountId" in target) {
      const delta = inserted.type === "INCOME" ? inserted.amount : -inserted.amount;
      await adjustBankAccountBalance(userId, target.bankAccountId, delta);
    }
  }

  await db.update(documents).set({ status: "CONFIRMED" }).where(eq(documents.id, documentId));
  await trackEvent(userId, "statement_import_confirmed", { documentId, count: insertedCount });
  await logFinancialEvent(userId, "statement_import_confirmed", { documentId, count: insertedCount });

  return { count: insertedCount };
}
