import "server-only";
import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  financialCompassSnapshots,
  financialProfiles,
  retirementPlans,
  debts,
  alerts,
  transactions,
} from "@/lib/db/schema";
import { computeNetWorth, computeEmergencyReserve, monthRange, sumExpenses, sumIncome, activeGoals } from "./aggregations";
import { getCurrentBudgetsWithActuals } from "./budget";
import { simulateRetirementCurve } from "./retirement";
import { formatBRL } from "@/lib/utils/money";

export type CompassDimensionResult = {
  dimension:
    | "EMERGENCY_RESERVE"
    | "SPENDING_CONTROL"
    | "DEBT"
    | "PROTECTION"
    | "INVESTMENTS"
    | "RETIREMENT"
    | "NET_WORTH"
    | "GOALS"
    | "BEHAVIOR";
  label: string;
  score: number;
  status: "Excelente" | "Saudável" | "Em construção" | "Atenção";
  diagnosis: string;
  nextAction: string;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function statusForScore(score: number): CompassDimensionResult["status"] {
  if (score >= 85) return "Excelente";
  if (score >= 65) return "Saudável";
  if (score >= 40) return "Em construção";
  return "Atenção";
}

/**
 * Computes all 9 "Bússola" dimensions from real data. This is intentionally
 * rule-based, not AI-generated — the numbers must be reproducible and
 * explainable. The thresholds/formulas are documented heuristics (see
 * ARCHITECTURE.md), not certified financial advice.
 */
export async function computeCompass(userId: string): Promise<CompassDimensionResult[]> {
  const { start, end } = monthRange();
  const [netWorth, reserve, monthlyExpenses, monthlyIncome, budgetsWithActuals, goals, financialProfile, retirementPlan, activeDebts, recentAlerts] =
    await Promise.all([
      computeNetWorth(userId),
      computeEmergencyReserve(userId),
      sumExpenses(userId, start, end),
      sumIncome(userId, start, end),
      getCurrentBudgetsWithActuals(userId),
      activeGoals(userId),
      db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).then((r) => r[0]),
      db.select().from(retirementPlans).where(eq(retirementPlans.userId, userId)).then((r) => r[0]),
      db.select().from(debts).where(and(eq(debts.userId, userId), eq(debts.isActive, true))),
      db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.userId, userId),
            gte(alerts.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          )
        ),
    ]);

  const income = financialProfile?.statedMonthlyIncome || monthlyIncome || 0;
  const essentialExpenses = financialProfile?.statedMonthlyExpenses || monthlyExpenses || 0;

  const results: CompassDimensionResult[] = [];

  // 1. Reserva de emergência
  const reserveMonths = essentialExpenses > 0 ? reserve / essentialExpenses : 0;
  const reserveTargetMonths = 6;
  const reserveScore = clamp((reserveMonths / reserveTargetMonths) * 100);
  results.push({
    dimension: "EMERGENCY_RESERVE",
    label: "Reserva de emergência",
    score: Math.round(reserveScore),
    status: statusForScore(reserveScore),
    diagnosis:
      essentialExpenses > 0
        ? `Você tem aproximadamente ${reserveMonths.toFixed(1)} meses de gastos guardados como reserva. A meta recomendada para o seu perfil é ${reserveTargetMonths} meses.`
        : "Ainda não temos gastos suficientes registrados para calcular sua reserva ideal.",
    nextAction:
      reserveMonths < reserveTargetMonths
        ? `Guardar mais ${formatBRL(Math.max(0, essentialExpenses * reserveTargetMonths - reserve))} completaria sua reserva ideal.`
        : "Sua reserva está no nível recomendado. Considere direcionar o excedente para investimentos.",
  });

  // 2. Controle de gastos
  const totalPlanned = budgetsWithActuals.reduce((s, b) => s + b.limitAmount, 0);
  const totalActual = budgetsWithActuals.reduce((s, b) => s + b.actual, 0);
  const spendingRatio = totalPlanned > 0 ? totalActual / totalPlanned : 1;
  const spendingScore = clamp(100 - (spendingRatio - 1) * 200);
  results.push({
    dimension: "SPENDING_CONTROL",
    label: "Controle de gastos",
    score: Math.round(spendingScore),
    status: statusForScore(spendingScore),
    diagnosis:
      totalPlanned > 0
        ? spendingRatio > 1
          ? `Você está ${(((spendingRatio - 1) * 100)).toFixed(0)}% acima do orçamento planejado este mês.`
          : `Você está dentro do orçamento planejado este mês (${(spendingRatio * 100).toFixed(0)}% utilizado).`
        : "Ainda não há um orçamento definido para comparar.",
    nextAction: spendingRatio > 1 ? "Veja quais categorias estouraram o orçamento e ajuste o que for possível." : "Continue acompanhando, está funcionando.",
  });

  // 3. Dívidas
  const totalMonthlyDebtPayments = activeDebts.reduce((s, d) => s + (d.installmentAmount ?? 0), 0);
  const debtRatio = income > 0 ? totalMonthlyDebtPayments / income : activeDebts.length > 0 ? 1 : 0;
  const debtScore = activeDebts.length === 0 ? 100 : clamp(100 - debtRatio * 300);
  results.push({
    dimension: "DEBT",
    label: "Dívidas",
    score: Math.round(debtScore),
    status: statusForScore(debtScore),
    diagnosis:
      activeDebts.length === 0
        ? "Você não tem dívidas ativas registradas."
        : `Suas parcelas de dívida somam ${formatBRL(totalMonthlyDebtPayments)}/mês, cerca de ${(debtRatio * 100).toFixed(0)}% da sua renda.`,
    nextAction: activeDebts.length === 0 ? "Continue assim." : "Priorize quitar as dívidas com juros mais altos primeiro.",
  });

  // 4. Proteção (seguros) — heuristic based on recorded insurance-related spending
  const hasProtection = budgetsWithActuals.some((b) => b.label === "Seguros" && b.actual > 0);
  const protectionScore = hasProtection ? 80 : 35;
  results.push({
    dimension: "PROTECTION",
    label: "Proteção",
    score: protectionScore,
    status: statusForScore(protectionScore),
    diagnosis: hasProtection
      ? "Você tem gastos com seguros registrados, o que indica alguma proteção patrimonial."
      : "Não identificamos gastos com seguros. Isso pode significar uma lacuna de proteção para você e sua família.",
    nextAction: hasProtection ? "Revise se as coberturas ainda fazem sentido para seu momento." : "Vale avaliar se um seguro de vida ou residencial faz sentido para o seu momento.",
  });

  // 5. Investimentos
  const investmentRatio = income > 0 ? netWorth.investedAssets / (income * 24) : 0;
  const investmentScore = clamp(investmentRatio * 100);
  results.push({
    dimension: "INVESTMENTS",
    label: "Investimentos",
    score: Math.round(investmentScore),
    status: statusForScore(investmentScore),
    diagnosis: `Você tem ${formatBRL(netWorth.investedAssets)} investidos hoje.`,
    nextAction: investmentScore < 65 ? "Aumentar o aporte mensal, mesmo que aos poucos, acelera bastante esse número no longo prazo." : "Seu ritmo de investimento está sólido.",
  });

  // 6. Aposentadoria
  let retirementScore = 0;
  let retirementDiagnosis = "Você ainda não definiu um plano de aposentadoria com o Tobias.";
  let retirementAction = "Vamos conversar sobre quando você quer se aposentar e com que renda.";
  if (retirementPlan) {
    const sim = simulateRetirementCurve({
      currentAge: retirementPlan.currentAge,
      targetRetirementAge: retirementPlan.targetRetirementAge,
      currentNetWorth: retirementPlan.currentNetWorth,
      monthlyContribution: retirementPlan.monthlyContribution,
      desiredMonthlyIncome: retirementPlan.desiredMonthlyIncome,
      expectedReturnConservative: retirementPlan.expectedReturnConservative,
      expectedReturnBase: retirementPlan.expectedReturnBase,
      expectedReturnAggressive: retirementPlan.expectedReturnAggressive,
      expectedInflation: retirementPlan.expectedInflation,
    });
    retirementScore = clamp((sim.base.finalValueAtTargetAge / sim.requiredNetWorth) * 100);
    retirementDiagnosis = sim.base.onTrack
      ? `No cenário base, você atinge o patrimônio necessário para se aposentar aos ${retirementPlan.targetRetirementAge} anos.`
      : `No ritmo atual, sua projeção fica em ${formatBRL(sim.base.finalValueAtTargetAge)} aos ${retirementPlan.targetRetirementAge} anos. O necessário é ${formatBRL(sim.requiredNetWorth)}.`;
    retirementAction = sim.base.onTrack
      ? "Continue com esse ritmo de aportes."
      : "Aumentar o aporte mensal ou revisar a idade-alvo pode fechar essa diferença. Quer simular?";
  }
  results.push({
    dimension: "RETIREMENT",
    label: "Aposentadoria",
    score: Math.round(retirementScore),
    status: statusForScore(retirementScore),
    diagnosis: retirementDiagnosis,
    nextAction: retirementAction,
  });

  // 7. Patrimônio
  const netWorthScore = income > 0 ? clamp((netWorth.netWorth / (income * 12)) * 20) : netWorth.netWorth > 0 ? 50 : 0;
  results.push({
    dimension: "NET_WORTH",
    label: "Patrimônio",
    score: Math.round(netWorthScore),
    status: statusForScore(netWorthScore),
    diagnosis: `Seu patrimônio líquido atual é ${formatBRL(netWorth.netWorth)}.`,
    nextAction: netWorthScore < 65 ? "Reduzir dívidas e aumentar investimentos são os dois jeitos mais diretos de crescer esse número." : "Seu patrimônio está em uma trajetória saudável.",
  });

  // 8. Objetivos
  const quantified = goals.filter((g) => g.isQuantified && g.targetAmount);
  const avgProgress =
    quantified.length > 0
      ? quantified.reduce((s, g) => s + Math.min(1, g.currentAmount / (g.targetAmount ?? 1)), 0) / quantified.length
      : 0;
  const goalsScore = goals.length === 0 ? 20 : clamp(avgProgress * 100);
  results.push({
    dimension: "GOALS",
    label: "Objetivos",
    score: Math.round(goalsScore),
    status: statusForScore(goalsScore),
    diagnosis: goals.length === 0 ? "Você ainda não tem objetivos ativos no Tobias." : `Você tem ${goals.length} objetivo(s) ativo(s), com progresso médio de ${(avgProgress * 100).toFixed(0)}%.`,
    nextAction: goals.length === 0 ? "Que tal me contar um sonho ou objetivo que você tem?" : "Continue registrando seus aportes para acompanhar o progresso.",
  });

  // 9. Comportamento
  const behaviorAlerts = recentAlerts.filter((a) => ["UNUSUAL_SPENDING", "DUPLICATE_CHARGE", "CARD_ABOVE_PATTERN"].includes(a.type));
  const behaviorScore = clamp(100 - behaviorAlerts.length * 15);
  results.push({
    dimension: "BEHAVIOR",
    label: "Comportamento financeiro",
    score: Math.round(behaviorScore),
    status: statusForScore(behaviorScore),
    diagnosis: behaviorAlerts.length === 0 ? "Nenhum padrão fora do comum identificado nos últimos 30 dias." : `${behaviorAlerts.length} padrão(ões) fora do comum identificado(s) nos últimos 30 dias.`,
    nextAction: behaviorAlerts.length === 0 ? "Continue assim." : "Vale revisar os alertas recentes.",
  });

  return results;
}

export async function saveCompassSnapshot(userId: string) {
  const results = await computeCompass(userId);
  await db.insert(financialCompassSnapshots).values(
    results.map((r) => ({
      userId,
      dimension: r.dimension,
      score: r.score,
      status: r.status,
      diagnosis: r.diagnosis,
      nextAction: r.nextAction,
    }))
  );
  return results;
}

export async function getLatestCompass(userId: string): Promise<CompassDimensionResult[]> {
  const rows = await db
    .select()
    .from(financialCompassSnapshots)
    .where(eq(financialCompassSnapshots.userId, userId))
    .orderBy(desc(financialCompassSnapshots.computedAt))
    .limit(50);

  const seen = new Set<string>();
  const latest: CompassDimensionResult[] = [];
  for (const row of rows) {
    if (seen.has(row.dimension)) continue;
    seen.add(row.dimension);
    latest.push({
      dimension: row.dimension,
      label: dimensionLabel(row.dimension),
      score: row.score,
      status: row.status as CompassDimensionResult["status"],
      diagnosis: row.diagnosis,
      nextAction: row.nextAction,
    });
  }
  return latest;
}

function dimensionLabel(dim: CompassDimensionResult["dimension"]): string {
  const map: Record<CompassDimensionResult["dimension"], string> = {
    EMERGENCY_RESERVE: "Reserva de emergência",
    SPENDING_CONTROL: "Controle de gastos",
    DEBT: "Dívidas",
    PROTECTION: "Proteção",
    INVESTMENTS: "Investimentos",
    RETIREMENT: "Aposentadoria",
    NET_WORTH: "Patrimônio",
    GOALS: "Objetivos",
    BEHAVIOR: "Comportamento financeiro",
  };
  return map[dim];
}
