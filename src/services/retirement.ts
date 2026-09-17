// ============================================================================
// Retirement Agent — deterministic math only. No AI involved here: every
// number the "Curva de Aposentadoria" shows must be reproducible and
// auditable, per the product rule that projections are estimates, never
// AI-generated facts. AIService.simulateRetirement wraps this with an
// optional narrative sentence, but the numbers always come from here.
//
// All values are computed in TODAY's purchasing power (real terms): nominal
// scenario returns are deflated by expected inflation, and the required nest
// egg uses a fixed 4%/year safe withdrawal rate. This avoids showing
// frightening/meaningless large nominal numbers decades out.
// ============================================================================

export type RetirementInputs = {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number;
  monthlyContribution: number;
  desiredMonthlyIncome: number;
  expectedReturnConservative: number; // nominal annual, e.g. 0.04
  expectedReturnBase: number;
  expectedReturnAggressive: number;
  expectedInflation: number; // nominal annual, e.g. 0.04
  /**
   * Renda garantida mensal (INSS/previdência privada) que cobre parte da
   * renda desejada sem depender do patrimônio investido — metodologia dos
   * "4 pilares" (ver claude/analise-metodologia-ameriprise.md, "cobrir o
   * essencial com renda garantida"). Opcional e default 0 (mantém o
   * comportamento anterior a essa mudança: 100% de `desiredMonthlyIncome`
   * tratado como saindo do patrimônio). Calculada por
   * services/inss.ts + retirementPlan.ts, nunca estimada aqui.
   */
  guaranteedMonthlyIncome?: number;
};

export type ScenarioPoint = { age: number; value: number };

export type ScenarioResult = {
  label: "conservador" | "base" | "agressivo";
  annualRealReturn: number;
  finalValueAtTargetAge: number;
  series: ScenarioPoint[];
  yearsToTarget: number | null; // years from now until the required nest egg is reached (may exceed the horizon)
  onTrack: boolean;
};

export type RetirementSimulation = {
  requiredNetWorth: number;
  conservative: ScenarioResult;
  base: ScenarioResult;
  aggressive: ScenarioResult;
};

const SAFE_WITHDRAWAL_RATE = 0.04;
const MAX_PROJECTION_YEARS = 60;

function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/**
 * Único lugar onde `requiredNetWorth` é calculado — antes desta mudança
 * essa mesma linha estava duplicada em `simulateRetirementCurve`,
 * `estimateTargetAge` e `requiredMonthlyContribution`, o que já causou uma
 * regra ficar desatualizada em relação às outras duas ao mudar só uma.
 *
 * gapEssencial = max(0, rendaDesejada − rendaGarantida): só a parte da
 * renda desejada que NÃO é coberta por INSS/previdência precisa sair do
 * patrimônio investido a uma taxa de retirada segura de 4%/ano.
 */
function computeRequiredNetWorth(desiredMonthlyIncome: number, guaranteedMonthlyIncome: number): number {
  const monthlyGap = Math.max(0, desiredMonthlyIncome - guaranteedMonthlyIncome);
  return (monthlyGap * 12) / SAFE_WITHDRAWAL_RATE;
}

function projectScenario(
  label: ScenarioResult["label"],
  currentAge: number,
  targetAge: number,
  currentNetWorth: number,
  monthlyContribution: number,
  annualReal: number,
  requiredNetWorth: number,
  monthlyDrawdown: number
): ScenarioResult {
  const monthlyRate = Math.pow(1 + annualReal, 1 / 12) - 1;
  const monthsToTarget = Math.max(0, Math.round((targetAge - currentAge) * 12));

  const series: ScenarioPoint[] = [{ age: currentAge, value: currentNetWorth }];
  let value = currentNetWorth;
  let yearsToTarget: number | null = null;

  // Two phases: before the target age, contributions accumulate; from the
  // target age on, the person has (notionally) stopped working and is
  // drawing the desired income out of the balance instead. This is what
  // makes the curve rise then fall around retirement, rather than climbing
  // (or sinking) forever — a nest egg that's short of `requiredNetWorth` at
  // retirement visibly runs down over time, which is the whole point of
  // showing "Requer ajuste".
  const maxMonths = MAX_PROJECTION_YEARS * 12;
  for (let m = 1; m <= maxMonths; m++) {
    value = m <= monthsToTarget ? value * (1 + monthlyRate) + monthlyContribution : value * (1 + monthlyRate) - monthlyDrawdown;
    if (m % 12 === 0) {
      series.push({ age: currentAge + m / 12, value });
    }
    if (yearsToTarget === null && m <= monthsToTarget && value >= requiredNetWorth) {
      yearsToTarget = Math.round((m / 12) * 10) / 10;
    }
    if (m === monthsToTarget && monthsToTarget % 12 !== 0) {
      // capture the exact target-age value even if it doesn't land on a whole year
      series.push({ age: targetAge, value });
    }
  }

  const finalValueAtTargetAge =
    series.find((p) => Math.abs(p.age - targetAge) < 0.01)?.value ?? currentNetWorth;

  return {
    label,
    annualRealReturn: annualReal,
    finalValueAtTargetAge,
    series: series.sort((a, b) => a.age - b.age),
    yearsToTarget,
    onTrack: finalValueAtTargetAge >= requiredNetWorth,
  };
}

export function simulateRetirementCurve(inputs: RetirementInputs): RetirementSimulation {
  const guaranteedMonthlyIncome = inputs.guaranteedMonthlyIncome ?? 0;
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, guaranteedMonthlyIncome);
  const monthlyDrawdown = Math.max(0, inputs.desiredMonthlyIncome - guaranteedMonthlyIncome);

  const scenarios: [ScenarioResult["label"], number][] = [
    ["conservador", realReturn(inputs.expectedReturnConservative, inputs.expectedInflation)],
    ["base", realReturn(inputs.expectedReturnBase, inputs.expectedInflation)],
    ["agressivo", realReturn(inputs.expectedReturnAggressive, inputs.expectedInflation)],
  ];

  const [conservative, base, aggressive] = scenarios.map(([label, annualReal]) =>
    projectScenario(
      label,
      inputs.currentAge,
      inputs.targetRetirementAge,
      inputs.currentNetWorth,
      inputs.monthlyContribution,
      annualReal,
      requiredNetWorth,
      monthlyDrawdown
    )
  );

  return { requiredNetWorth, conservative, base, aggressive };
}

/**
 * Estimates a target retirement/financial-independence age from the real
 * numbers, instead of relying on a stated or AI-guessed age. This is what
 * onboarding uses for a goal like "independência financeira" (which has no
 * inherent target age, unlike a literal "quero me aposentar aos 60") or
 * whenever a stated age turns out to be implausible (e.g. not after the
 * person's current age).
 *
 * It's the age at which the base-scenario projection first covers the
 * required nest egg (desiredMonthlyIncome at the 4% safe withdrawal rate),
 * given the person's current net worth and monthly contribution. Falls back
 * to currentAge + 25 only if the projection never gets there within
 * MAX_PROJECTION_YEARS (e.g. zero savings capacity) — same conservative
 * default used elsewhere, kept only as a last resort.
 */
export function estimateTargetAge(
  inputs: Pick<
    RetirementInputs,
    "currentAge" | "currentNetWorth" | "monthlyContribution" | "desiredMonthlyIncome"
  > &
    Partial<Pick<RetirementInputs, "expectedReturnBase" | "expectedInflation" | "guaranteedMonthlyIncome">>
): number {
  const expectedReturnBase = inputs.expectedReturnBase ?? 0.06;
  const expectedInflation = inputs.expectedInflation ?? 0.04;
  const guaranteedMonthlyIncome = inputs.guaranteedMonthlyIncome ?? 0;
  const horizonAge = inputs.currentAge + MAX_PROJECTION_YEARS;
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, guaranteedMonthlyIncome);
  const monthlyDrawdown = Math.max(0, inputs.desiredMonthlyIncome - guaranteedMonthlyIncome);
  const annualReal = realReturn(expectedReturnBase, expectedInflation);

  const projection = projectScenario(
    "base",
    inputs.currentAge,
    horizonAge,
    inputs.currentNetWorth,
    inputs.monthlyContribution,
    annualReal,
    requiredNetWorth,
    monthlyDrawdown
  );

  if (projection.yearsToTarget !== null) {
    return Math.min(horizonAge, Math.ceil(inputs.currentAge + projection.yearsToTarget));
  }
  return inputs.currentAge + 25;
}

/** How much the monthly contribution would need to change to reach the goal at the target age, holding everything else constant (binary search). */
export function requiredMonthlyContribution(inputs: RetirementInputs, scenario: "conservative" | "base" | "aggressive" = "base"): number {
  const rate =
    scenario === "conservative"
      ? inputs.expectedReturnConservative
      : scenario === "aggressive"
        ? inputs.expectedReturnAggressive
        : inputs.expectedReturnBase;
  const annualReal = realReturn(rate, inputs.expectedInflation);
  const monthlyRate = Math.pow(1 + annualReal, 1 / 12) - 1;
  const months = Math.max(1, Math.round((inputs.targetRetirementAge - inputs.currentAge) * 12));
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, inputs.guaranteedMonthlyIncome ?? 0);

  // Future value of a lump sum + an annuity of contribution C:
  // FV = PV*(1+r)^n + C * (((1+r)^n - 1) / r)
  // Solve for C given target FV = requiredNetWorth.
  const growth = Math.pow(1 + monthlyRate, months);
  const annuityFactor = monthlyRate === 0 ? months : (growth - 1) / monthlyRate;
  const neededFromContributions = requiredNetWorth - inputs.currentNetWorth * growth;
  return Math.max(0, neededFromContributions / annuityFactor);
}
