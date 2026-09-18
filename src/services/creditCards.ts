import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { creditCards, bankAccounts, transactions } from "@/lib/db/schema";
import { trackEvent, logFinancialEvent } from "./analytics";
import { nowInBrazil } from "@/lib/utils/dates";
import type { CreateCreditCardInput } from "@/lib/validations/creditCard";

export async function listCreditCards(userId: string) {
  return db.select().from(creditCards).where(eq(creditCards.userId, userId)).orderBy(creditCards.createdAt);
}

/**
 * Início da fatura ATUAL (em aberto) de um cartão, a partir do dia de
 * fechamento — mesmo raciocínio de `monthRange`, mas alinhado ao ciclo do
 * cartão em vez do calendário. Sem `closingDay` cadastrado, cai pro mês
 * corrente (mesmo período que o resto do Dashboard já usa) — degrada, nunca
 * quebra.
 */
function currentCycleStart(closingDay: number | null, now = nowInBrazil()): Date {
  if (!closingDay) {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 3, 0, 0, 0));
  }
  // Se ainda não passamos do dia de fechamento deste mês, o ciclo aberto
  // começou no fechamento do mês ANTERIOR; se já passamos, começou no
  // fechamento deste mês.
  const day = now.getDate();
  const cycleMonth = day > closingDay ? now.getMonth() : now.getMonth() - 1;
  return new Date(Date.UTC(now.getFullYear(), cycleMonth, closingDay, 3, 0, 0, 0));
}

export type CreditCardUsage = {
  id: string;
  nickname: string;
  brand: string | null;
  lastFourDigits: string | null;
  limitAmount: number | null;
  dueDay: number | null;
  currentCycleSpend: number;
  usagePct: number | null; // null quando o cartão não tem limite cadastrado
};

/**
 * Uso do ciclo aberto de cada cartão ativo — soma das compras (EXPENSE,
 * paymentMethod CREDIT_CARD) desde o último fechamento até agora. Não lê a
 * tabela `invoices` (existe no schema mas nunca foi preenchida por nenhum
 * fluxo do produto ainda) — calcula direto de `transactions`, a mesma fonte
 * que todo o resto do app já usa.
 */
export async function getCreditCardsUsage(userId: string): Promise<CreditCardUsage[]> {
  const cards = await db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.userId, userId), eq(creditCards.isActive, true)));

  const now = nowInBrazil();
  return Promise.all(
    cards.map(async (card) => {
      const cycleStart = currentCycleStart(card.closingDay, now);
      const rows = await db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.creditCardId, card.id),
            eq(transactions.type, "EXPENSE"),
            gte(transactions.date, cycleStart),
            lt(transactions.date, now)
          )
        );
      const currentCycleSpend = Number(rows[0]?.total ?? 0);
      return {
        id: card.id,
        nickname: card.nickname,
        brand: card.brand,
        lastFourDigits: card.lastFourDigits,
        limitAmount: card.limitAmount,
        dueDay: card.dueDay,
        currentCycleSpend,
        usagePct: card.limitAmount && card.limitAmount > 0 ? (currentCycleSpend / card.limitAmount) * 100 : null,
      };
    })
  );
}

/**
 * O cartão que "precisa de atenção" quando há mais de um: o de maior % do
 * limite usado no ciclo aberto (decisão do Thiago). Cartões sem limite
 * cadastrado não entram nesse ranking (não dá pra saber o quão preocupante é
 * um gasto sem saber o limite) — só aparecem se forem o único cartão ativo.
 */
export function pickCardNeedingAttention(cards: CreditCardUsage[]): CreditCardUsage | null {
  if (cards.length === 0) return null;
  const withLimit = cards.filter((c) => c.usagePct != null);
  if (withLimit.length === 0) return cards[0];
  return [...withLimit].sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0))[0];
}

export async function createCreditCard(userId: string, input: CreateCreditCardInput) {
  const [account] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.userId, userId)))
    .limit(1);
  if (!account) throw new Error("Conta não encontrada");

  const [card] = await db
    .insert(creditCards)
    .values({
      userId,
      bankAccountId: account.id,
      nickname: input.nickname,
      brand: input.brand || null,
      lastFourDigits: input.lastFourDigits || null,
      limitAmount: input.limitAmount ?? null,
      closingDay: input.closingDay ?? null,
      dueDay: input.dueDay ?? null,
    })
    .returning();

  await trackEvent(userId, "credit_card_created", { bankAccountId: account.id });
  await logFinancialEvent(userId, "credit_card_created", { creditCardId: card.id, nickname: card.nickname });
  return card;
}

export async function deleteCreditCard(userId: string, creditCardId: string) {
  await db.delete(creditCards).where(and(eq(creditCards.id, creditCardId), eq(creditCards.userId, userId)));
  await logFinancialEvent(userId, "credit_card_deleted", { creditCardId });
}
