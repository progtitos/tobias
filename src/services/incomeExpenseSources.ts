import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { incomes, recurringExpenses, transactions } from "@/lib/db/schema";
import { monthRange } from "./aggregations";

/**
 * Aba "Renda e Despesas" (Thiago, 2026-09-20): fontes de renda e gastos
 * fixos que a pessoa cadastra uma vez — salário, Uber, Airbnb, aluguel,
 * pensão — e o Tobias lança sozinho todo mês, como um lançamento "previsto"
 * (`needsConfirmation = true`) que a pessoa confirma ou ajusta em vez de
 * digitar do zero. `incomes`/`recurring_expenses` já existiam na tabela
 * desde o início do projeto mas nunca tinham sido usadas por nenhuma tela.
 */

export type IncomeSourceKind = "SALARY" | "FREELANCE" | "RENTAL" | "BUSINESS" | "BENEFIT" | "OTHER";

// Fontes em que o valor cadastrado normalmente vem "bruto", com uma segunda
// perna que sai antes de virar dinheiro na conta: descontos do salário
// (INSS/IR) ou despesas de uma renda autônoma (combustível do Uber, limpeza
// do Airbnb). Só controla os rótulos mostrados na tela ("Descontos" vs
// "Despesas") — o lançamento das duas pernas é sempre igual.
export const INCOME_KINDS_WITH_SECOND_LEG: IncomeSourceKind[] = ["SALARY", "FREELANCE", "RENTAL", "BUSINESS"];

export async function listIncomeSources(userId: string) {
  return db.select().from(incomes).where(eq(incomes.userId, userId)).orderBy(incomes.createdAt);
}

export async function listFixedExpenses(userId: string) {
  return db.select().from(recurringExpenses).where(eq(recurringExpenses.userId, userId)).orderBy(recurringExpenses.createdAt);
}

export async function createIncomeSource(
  userId: string,
  input: {
    description: string;
    amount: number;
    deductionAmount?: number | null;
    category: IncomeSourceKind;
    categoryId?: string | null;
    deductionCategoryId?: string | null;
    dayOfMonth?: number | null;
  }
) {
  const [row] = await db
    .insert(incomes)
    .values({
      userId,
      description: input.description,
      amount: input.amount,
      deductionAmount: input.deductionAmount ?? null,
      category: input.category,
      categoryId: input.categoryId ?? null,
      deductionCategoryId: input.deductionCategoryId ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
    })
    .returning();
  return row;
}

export async function updateIncomeSource(
  userId: string,
  id: string,
  input: Partial<{
    description: string;
    amount: number;
    deductionAmount: number | null;
    categoryId: string | null;
    deductionCategoryId: string | null;
    dayOfMonth: number | null;
    isActive: boolean;
  }>
) {
  await db
    .update(incomes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
}

export async function createFixedExpense(
  userId: string,
  input: { description: string; amount: number; categoryId?: string | null; dayOfMonth?: number | null }
) {
  const [row] = await db
    .insert(recurringExpenses)
    .values({
      userId,
      description: input.description,
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
    })
    .returning();
  return row;
}

export async function updateFixedExpense(
  userId: string,
  id: string,
  input: Partial<{ description: string; amount: number; categoryId: string | null; dayOfMonth: number | null; isActive: boolean }>
) {
  await db
    .update(recurringExpenses)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}

export async function listPendingConfirmations(userId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.needsConfirmation, true)))
    .orderBy(transactions.date);
}

/**
 * Confirma um lançamento previsto — se `adjustedAmount` vier preenchido (a
 * pessoa editou o valor sugerido), grava esse valor em vez do original.
 *
 * Além de confirmar o lançamento do mês, o valor final também vira o novo
 * "valor esperado" da fonte que o gerou (renda, desconto/despesa ou gasto
 * fixo) — é assim que uma renda variável (Uber, Airbnb, freelance) se
 * ajusta mês a mês sem a pessoa precisar editar o cadastro da fonte à
 * parte: ela só confirma/ajusta o valor real de cada mês aqui, e a próxima
 * previsão já nasce a partir desse número (Thiago, 2026-09-20 — "o correto
 * seria setar o total a cada mês, assim também seta as despesas dessas
 * rendas extras"). Pra salário fixo isso também é útil (ex: depois de um
 * reajuste), só não muda nada pra quem confirma sempre o mesmo valor.
 */
export async function confirmPendingTransaction(userId: string, transactionId: string, adjustedAmount?: number) {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), eq(transactions.needsConfirmation, true)))
    .limit(1);
  if (!tx) return null;

  const finalAmount = adjustedAmount !== undefined && adjustedAmount >= 0 ? adjustedAmount : Number(tx.amount);

  await db
    .update(transactions)
    .set({ amount: finalAmount, needsConfirmation: false, confidence: 1.0, updatedAt: new Date() })
    .where(eq(transactions.id, transactionId));

  if (tx.incomeSourceId) {
    // A perna de renda e a de desconto/despesa da mesma fonte viram
    // lançamentos separados (ver ensureCurrentMonthGenerated) — o `type` da
    // transação diz qual das duas esse valor confirmado atualiza.
    await db
      .update(incomes)
      .set(tx.type === "INCOME" ? { amount: finalAmount } : { deductionAmount: finalAmount })
      .where(and(eq(incomes.id, tx.incomeSourceId), eq(incomes.userId, userId)));
  } else if (tx.recurringExpenseId) {
    await db
      .update(recurringExpenses)
      .set({ amount: finalAmount })
      .where(and(eq(recurringExpenses.id, tx.recurringExpenseId), eq(recurringExpenses.userId, userId)));
  }

  return true;
}

/** A pessoa descarta o lançamento previsto do mês (ex: não recebeu aluguel
 * esse mês) — some da lista, sem virar uma transação de verdade. */
export async function dismissPendingTransaction(userId: string, transactionId: string) {
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), eq(transactions.needsConfirmation, true)));
}

/**
 * Garante que o mês corrente já tem um lançamento previsto pra cada fonte
 * ativa — chamado sempre que a pessoa abre a aba "Renda e Despesas" (sem
 * cron: o próprio carregamento da tela cobre o mês, mesmo truque que o
 * Ponteiro usava antes de virar cálculo ao vivo). Idempotente: uma fonte já
 * gerada nesse mês (`lastGeneratedAt`/`lastChargedAt` dentro do mês
 * corrente) não gera de novo.
 *
 * Fontes com uma segunda perna (`INCOME_KINDS_WITH_SECOND_LEG`) geram DOIS
 * lançamentos — a renda bruta e o desconto/despesa separados — em vez de um
 * valor líquido só, porque a ideia é que as duas pernas apareçam nas
 * transações/categorias (ex: o desconto do salário categorizado em
 * "Impostos", a despesa do Uber em "Combustível"), não que uma suma dentro
 * da outra.
 */
export async function ensureCurrentMonthGenerated(userId: string) {
  const { start } = monthRange();
  const day = (d: number | null | undefined) => Math.min(Math.max(d ?? 5, 1), 28);
  const dateFor = (d: number | null | undefined) => new Date(start.getFullYear(), start.getMonth(), day(d));

  const sources = await listIncomeSources(userId);
  for (const src of sources) {
    if (!src.isActive) continue;
    if (src.lastGeneratedAt && src.lastGeneratedAt >= start) continue;

    const date = dateFor(src.dayOfMonth);
    const hasSecondLeg = INCOME_KINDS_WITH_SECOND_LEG.includes(src.category as IncomeSourceKind) && Number(src.deductionAmount) > 0;
    const rows: (typeof transactions.$inferInsert)[] = [
      {
        userId,
        date,
        amount: Number(src.amount),
        type: "INCOME",
        categoryId: src.categoryId,
        description: `${src.description} (previsto)`,
        source: "MANUAL",
        confidence: 0.9,
        needsConfirmation: true,
        incomeSourceId: src.id,
      },
    ];
    if (hasSecondLeg) {
      rows.push({
        userId,
        date,
        amount: Number(src.deductionAmount),
        type: "EXPENSE",
        categoryId: src.deductionCategoryId,
        description: `Desconto/despesa de ${src.description} (previsto)`,
        source: "MANUAL",
        confidence: 0.9,
        needsConfirmation: true,
        incomeSourceId: src.id,
      });
    }
    await db.insert(transactions).values(rows);
    await db.update(incomes).set({ lastGeneratedAt: new Date() }).where(eq(incomes.id, src.id));
  }

  const expenses = await listFixedExpenses(userId);
  for (const exp of expenses) {
    if (!exp.isActive) continue;
    if (exp.lastChargedAt && exp.lastChargedAt >= start) continue;

    await db.insert(transactions).values({
      userId,
      date: dateFor(exp.dayOfMonth),
      amount: Number(exp.amount),
      type: "EXPENSE",
      categoryId: exp.categoryId,
      description: `${exp.description} (previsto)`,
      source: "MANUAL",
      confidence: 0.9,
      needsConfirmation: true,
      recurringExpenseId: exp.id,
    });
    await db.update(recurringExpenses).set({ lastChargedAt: new Date() }).where(eq(recurringExpenses.id, exp.id));
  }
}

export type EmergencyFundSuggestion = {
  months: number;
  monthlyEssentialExpenses: number;
  suggestedTarget: number;
  reason: string;
};

/**
 * Sugestão de meta de reserva de emergência — antes o Tobias não tinha
 * NENHUMA resposta pra "quanto eu preciso guardar pra me manter num aperto",
 * só mostrava o valor já guardado sem alvo nenhum (Thiago, 2026-09-20: "o
 * tobias precisa entender o quanto de reserva de emergência o cliente tem
 * que ter"). Aplica a recomendação da Ameriprise (3 a 6 meses de despesas
 * essenciais, mais pra quem tem renda única ou variável — ver
 * claude/analise-metodologia-ameriprise.md, lacuna 4) em cima do que a
 * pessoa já cadastrou aqui: usa os gastos fixos obrigatórios como
 * aproximação de "essencial" (a categorização fina essencial/estilo-de-vida
 * de todo o orçamento é uma fase futura, não uma dependência desta conta) e
 * o perfil de renda cadastrado (única/variável vs. dupla e estável) pra
 * decidir 6 ou 3 meses. Retorna null quando não há gasto fixo cadastrado
 * ainda — nesse caso não dá pra sugerir nada de concreto.
 */
export async function computeEmergencyFundTarget(userId: string): Promise<EmergencyFundSuggestion | null> {
  const [sources, expenses] = await Promise.all([listIncomeSources(userId), listFixedExpenses(userId)]);
  const monthlyEssentialExpenses = expenses.filter((e) => e.isActive).reduce((s, e) => s + Number(e.amount), 0);
  if (monthlyEssentialExpenses <= 0) return null;

  const activeSources = sources.filter((s) => s.isActive);
  const stableSalaryCount = activeSources.filter((s) => s.category === "SALARY").length;
  const hasVariableIncome = activeSources.some((s) => s.category !== "SALARY" && s.category !== "BENEFIT");

  let months: number;
  let reason: string;
  if (hasVariableIncome) {
    months = 6;
    reason = "você tem renda variável ou autônoma cadastrada (Uber, aluguel, freelance...), que pede uma reserva maior";
  } else if (stableSalaryCount >= 2) {
    months = 3;
    reason = "duas rendas fixas cadastradas cobrem uma reserva menor (ex: casal com dois salários)";
  } else {
    months = 6;
    reason = "com uma única fonte de renda cadastrada, a recomendação é uma reserva maior";
  }

  return { months, monthlyEssentialExpenses, suggestedTarget: monthlyEssentialExpenses * months, reason };
}

/** Resumo do mês corrente pras fontes cadastradas — usado no gráfico da
 * aba: renda esperada por fonte vs. gastos fixos esperados, além do total
 * de descontos/despesas associados a cada renda. Não depende de o mês já
 * ter sido gerado (`ensureCurrentMonthGenerated`) — é sempre o valor
 * cadastrado, pra o gráfico não ficar vazio antes do primeiro lançamento. */
export async function getIncomeExpenseSummary(userId: string) {
  const [sources, expenses] = await Promise.all([listIncomeSources(userId), listFixedExpenses(userId)]);
  const activeSources = sources.filter((s) => s.isActive);
  const activeExpenses = expenses.filter((e) => e.isActive);

  const income = activeSources.map((s) => ({
    id: s.id,
    label: s.description,
    gross: Number(s.amount),
    deduction: Number(s.deductionAmount ?? 0),
    net: Number(s.amount) - Number(s.deductionAmount ?? 0),
  }));
  const fixedExpenses = activeExpenses.map((e) => ({ id: e.id, label: e.description, amount: Number(e.amount) }));

  const totalGrossIncome = income.reduce((s, i) => s + i.gross, 0);
  const totalDeductions = income.reduce((s, i) => s + i.deduction, 0);
  const totalFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);

  return {
    income,
    fixedExpenses,
    totalGrossIncome,
    totalDeductions,
    totalNetIncome: totalGrossIncome - totalDeductions,
    totalFixedExpenses,
  };
}
