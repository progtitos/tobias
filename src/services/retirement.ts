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

function projectScenario(
  label: ScenarioResult["label"],
  currentAge: number,
  targetAge: number,
  currentNetWorth: number,
  monthlyContribution: number,
  annualReal: number,
  requiredNetWorth: number
): ScenarioResult {
  const monthlyRate = Math.pow(1 + annualReal, 1 / 12) - 1;
  const monthsToTarget = Math.max(0, Math.round((targetAge - currentAge) * 12));

  const series: ScenarioPoint[] = [{ age: currentAge, value: currentNetWorth }];
  let value = currentNetWorth;
  let yearsToTarget: number | null = null;

  const maxMonths = MAX_PROJECTION_YEARS * 12;
  for (let m = 1; m <= maxMonths; m++) {
    value = value * (1 + monthlyRate) + monthlyContribution;
    if (m % 12 === 0) {
      series.push({ age: currentAge + m / 12, value });
    }
    if (yearsToTarget === null && value >= requiredNetWorth) {
      yearsToTarget = Math.round((m / 12) * 10) / 10;
    }
    if (m === monthsToTarget) {
      // capture the exact target-age value even if it doesn't land on a whole year
      if (monthsToTarget % 12 !== 0) series.push({ age: targetAge, value });
    }
    if (m > monthsToTarget && yearsToTarget !== null) break; // enough data to answer both questions
  }

  const finalValueAtTargetAge =
    series.find((p) => Math.abs(p.age - targetAge) < 0.01)?.value ?? series[series.length - 1].value;

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
  const requiredNetWorth = (inputs.desiredMonthlyIncome * 12) / SAFE_WITHDRAWAL_RATE;

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
      requiredNetWorth
    )
  );

  return { requiredNetWorth, conservative, base, aggressive };
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
  const requiredNetWorth = (inputs.desiredMonthlyIncome * 12) / SAFE_WITHDRAWAL_RATE;

  // Future value of a lump sum + an annuity of contribution C:
  // FV = PV*(1+r)^n + C * (((1+r)^n - 1) / r)
  // Solve for C given target FV = requiredNetWorth.
  const growth = Math.pow(1 + monthlyRate, months);
  const annuityFactor = monthlyRate === 0 ? months : (growth - 1) / monthlyRate;
  const neededFromContributions = requiredNetWorth - inputs.currentNetWorth * growth;
  return Math.max(0, neededFromContributions / annuityFactor);
}
