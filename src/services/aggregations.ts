import "server-only";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  transactions,
  investments,
  assets,
  debts,
  bankAccounts,
  goals,
  categories,
} from "@/lib/db/schema";
import { nowInBrazil } from "@/lib/utils/dates";

// `nowInBrazil()`, não `new Date()`: o servidor (Vercel) roda em UTC, e sem
// isso o "mês atual" virava setembro ~3h antes da meia-noite de verdade no
// Brasil (21h-23h59 em Brasília já é dia seguinte em UTC) — transações do
// fim do mês apareciam agrupadas no mês seguinte por causa disso.
//
// Além disso, os limites do intervalo em si precisam ser a meia-noite EM
// BRASÍLIA, não meia-noite UTC: `new Date(ano, mes, 1)` num servidor UTC
// produz "01/mês 00:00 UTC", que na verdade é "31/mês-anterior 21:00" no
// Brasil. Qualquer transação com horário real (não só data, ex.: um
// lançamento antigo salvo com `new Date("2026-09-01")` antes do fix do
// parseDateOnly) cai entre 00:00 e 03:00 UTC do dia 1º e ficava incluída no
// mês novo mesmo sendo, pelo relógio de Brasília, ainda o dia 31 do mês
// anterior — exatamente o "transação de 31/08 aparecendo em setembro"
// visto em produção. Como o Brasil fica fixo em UTC-3 (sem horário de
// verão desde 2019), meia-noite em Brasília é sempre 03:00 UTC.
export function monthRange(date = nowInBrazil()) {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 3, 0, 0, 0));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 1, 3, 0, 0, 0));
  return { start, end };
}

/** Sum of all EXPENSE transactions for a user in a date range, in cents-free reais. */
export async function sumExpenses(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );
  return Number(rows[0]?.total ?? 0);
}

export async function sumIncome(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "INCOME"),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );
  return Number(rows[0]?.total ?? 0);
}

export async function sumInvestmentContributions(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "INVESTMENT_CONTRIBUTION"),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );
  return Number(rows[0]?.total ?? 0);
}

/** Expense total per category for a date range — powers the dashboard breakdown and budget comparison. */
export async function expensesByCategory(userId: string, start: Date, end: Date) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .groupBy(transactions.categoryId, categories.name)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? "Sem categoria",
    total: Number(r.total),
  }));
}

/** Net worth = bank balances + investments (current value) + assets - debts (remaining). */
export async function computeNetWorth(userId: string) {
  const [accountsSum, investmentsSum, assetsSum, debtsSum] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${bankAccounts.balance}), 0)` })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isActive, true))),
    db
      .select({ total: sql<string>`coalesce(sum(${investments.currentAmount}), 0)` })
      .from(investments)
      .where(eq(investments.userId, userId)),
    db
      .select({ total: sql<string>`coalesce(sum(${assets.estimatedValue}), 0)` })
      .from(assets)
      .where(eq(assets.userId, userId)),
    db
      .select({ total: sql<string>`coalesce(sum(${debts.remainingAmount}), 0)` })
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.isActive, true))),
  ]);

  const liquidAssets = Number(accountsSum[0]?.total ?? 0);
  const investedAssets = Number(investmentsSum[0]?.total ?? 0);
  const otherAssets = Number(assetsSum[0]?.total ?? 0);
  const totalDebt = Number(debtsSum[0]?.total ?? 0);

  return {
    liquidAssets,
    investedAssets,
    otherAssets,
    totalDebt,
    netWorth: liquidAssets + investedAssets + otherAssets - totalDebt,
  };
}

/** Emergency reserve = liquid + highly-liquid investments (fixed income tagged as reserve-like). For the MVP we treat bank balances + investments with liquidity containing "D+0"/"D+1" as the reserve. */
export async function computeEmergencyReserve(userId: string) {
  const accs = await db
    .select({ total: sql<string>`coalesce(sum(${bankAccounts.balance}), 0)` })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isActive, true)));

  const liquidInvestments = await db
    .select({ total: sql<string>`coalesce(sum(${investments.currentAmount}), 0)` })
    .from(investments)
    .where(
      and(
        eq(investments.userId, userId),
        sql`(${investments.liquidity} ilike '%d+0%' or ${investments.liquidity} ilike '%d+1%' or ${investments.liquidity} ilike '%diária%')`
      )
    );

  return Number(accs[0]?.total ?? 0) + Number(liquidInvestments[0]?.total ?? 0);
}

export async function activeGoals(userId: string) {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "ACTIVE")))
    .orderBy(goals.priority);
  return withLiveEmergencyFundAmount(userId, rows);
}

/**
 * A goal of type EMERGENCY_FUND isn't something you "aportar" into by hand —
 * it's just your liquid savings, which the Bússola/Ponteiro already computes
 * independently via computeEmergencyReserve. If we displayed the goal's own
 * `currentAmount` column instead, it'd drift from that number the moment a
 * bank balance changes without a matching manual contribution, showing two
 * different "reserve" figures in different corners of the app. So wherever
 * goals are read for display, we override that one type's amount with the
 * live computation instead of trusting the stored column.
 */
export async function withLiveEmergencyFundAmount<T extends { type: string; currentAmount: number }>(
  userId: string,
  rows: T[]
): Promise<T[]> {
  if (!rows.some((g) => g.type === "EMERGENCY_FUND")) return rows;
  const reserve = await computeEmergencyReserve(userId);
  return rows.map((g) => (g.type === "EMERGENCY_FUND" ? { ...g, currentAmount: reserve } : g));
}
