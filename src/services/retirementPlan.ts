import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { retirementPlans } from "@/lib/db/schema";
import { computeNetWorth } from "./aggregations";
import { trackEvent } from "./analytics";
import { computeGuaranteedMonthlyIncome, type Gender, type GuaranteedIncomeInput } from "./inss";
import type { RetirementInputs } from "./retirement";

export { computeGuaranteedMonthlyIncome };

export type RetirementPlanInput = {
  currentAge: number;
  targetRetirementAge: number;
  desiredMonthlyIncome: number;
  monthlyContribution: number;
  expectedReturnConservative: number;
  expectedReturnBase: number;
  expectedReturnAggressive: number;
  expectedInflation: number;

  // --- Curva por pilares (Ameriprise) + INSS — todos opcionais -----------
  // Um plano sem esses 4 campos preenchidos (birthDate/gender/
  // contributionYearsToDate/averageMonthlySalary) simplesmente não tem
  // renda garantida calculada (guaranteedMonthlyIncome = 0), voltando ao
  // comportamento anterior a essa mudança. Ver services/inss.ts.
  birthDate?: Date | null;
  gender?: Gender | null;
  contributionYearsToDate?: number | null;
  averageMonthlySalary?: number | null;
  /** Vence a estimativa calculada, se a pessoa já souber o valor exato (Meu INSS, previdência privada). */
  guaranteedMonthlyIncomeOverride?: number | null;
};

/** Formato mínimo de uma linha de `retirement_plans` necessário para calcular a renda garantida. Alias de `GuaranteedIncomeInput` (services/inss.ts) para quem já importa daqui. */
export type RetirementPlanRow = GuaranteedIncomeInput;

export async function getRetirementPlan(userId: string) {
  const [plan] = await db.select().from(retirementPlans).where(eq(retirementPlans.userId, userId)).limit(1);
  return plan ?? null;
}

/**
 * Monta o `RetirementInputs` completo (incluindo `guaranteedMonthlyIncome`)
 * a partir de uma linha de `retirement_plans` + o patrimônio atual real.
 * Único ponto de montagem — antes desta mudança essa mesma conversão
 * estava duplicada em `compass.ts`, `dashboard.ts` e na página de
 * Aposentadoria, o que já era um risco de dessincronia (ver relatório de
 * exploração desta mudança).
 */
export function buildRetirementInputs(
  plan: RetirementPlanRow & Pick<RetirementInputs, "currentAge" | "desiredMonthlyIncome" | "monthlyContribution" | "expectedReturnConservative" | "expectedReturnBase" | "expectedReturnAggressive" | "expectedInflation">,
  currentNetWorth: number
): RetirementInputs {
  const { guaranteedMonthlyIncome } = computeGuaranteedMonthlyIncome(plan);
  return {
    currentAge: plan.currentAge,
    targetRetirementAge: plan.targetRetirementAge,
    currentNetWorth,
    monthlyContribution: plan.monthlyContribution,
    desiredMonthlyIncome: plan.desiredMonthlyIncome,
    expectedReturnConservative: plan.expectedReturnConservative,
    expectedReturnBase: plan.expectedReturnBase,
    expectedReturnAggressive: plan.expectedReturnAggressive,
    expectedInflation: plan.expectedInflation,
    guaranteedMonthlyIncome,
  };
}

/**
 * currentNetWorth is intentionally never taken from user input on this page —
 * it's always refreshed from real transaction/account data, so the curve's
 * starting point can't drift from what the rest of the app shows.
 */
export async function upsertRetirementPlan(userId: string, input: RetirementPlanInput) {
  const netWorth = await computeNetWorth(userId);
  const existing = await getRetirementPlan(userId);
  const now = new Date();

  // Sempre que os anos de contribuição são (re)enviados, a data de
  // referência é "agora" — é o que permite `computeGuaranteedMonthlyIncome`
  // projetar contribuição futura corretamente a partir do último valor
  // informado, sem exigir que a pessoa recalcule à mão a cada visita.
  const values = {
    ...input,
    contributionYearsAsOfDate: input.contributionYearsToDate != null ? now : null,
    currentNetWorth: netWorth.netWorth,
  };

  if (existing) {
    await db
      .update(retirementPlans)
      .set({ ...values, updatedAt: now })
      .where(eq(retirementPlans.userId, userId));
  } else {
    await db.insert(retirementPlans).values({ userId, ...values });
    await trackEvent(userId, "retirement_plan_created");
  }

  return getRetirementPlan(userId);
}
