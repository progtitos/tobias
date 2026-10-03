import { describe, it, expect } from "vitest";
import {
  buildIdealTrajectory,
  buildPrincipalSeries,
  findDepletionAge,
  simulateRetirementCurve,
  type RetirementInputs,
} from "./retirement";

describe("buildPrincipalSeries", () => {
  it("cresce só com aportes (sem rendimento) até a idade-alvo e fica parada depois", () => {
    // 1000 hoje + 200/mês até os 40 (5 anos = 12.000) = 13.000 na idade-alvo,
    // e deve continuar em 13.000 até o fim do horizonte (65) — "principal
    // investido" é sobre quanto entrou, não um saldo que se mexe sozinho.
    const series = buildPrincipalSeries(35, 40, 65, 1000, 200);

    expect(series[0]).toEqual({ age: 35, value: 1000 });
    const atTarget = series.find((p) => p.age === 40)!;
    expect(atTarget.value).toBeCloseTo(1000 + 200 * 12 * 5, 5);
    const atHorizon = series[series.length - 1];
    expect(atHorizon.age).toBe(65);
    expect(atHorizon.value).toBeCloseTo(atTarget.value, 5);
  });
});

describe("findDepletionAge", () => {
  it("acha a primeira idade depois de afterAge em que o saldo zera", () => {
    const series = [
      { age: 60, value: 500_000 },
      { age: 70, value: 200_000 },
      { age: 80, value: 0 },
      { age: 90, value: 0 },
    ];
    expect(findDepletionAge(series, 60)).toBe(80);
  });

  it("retorna null quando a série nunca esgota depois de afterAge", () => {
    const series = [
      { age: 60, value: 500_000 },
      { age: 90, value: 300_000 },
    ];
    expect(findDepletionAge(series, 60)).toBeNull();
  });

  it("ignora um ponto zerado que já está em afterAge ou antes", () => {
    const series = [
      { age: 60, value: 0 },
      { age: 70, value: 100_000 },
    ];
    expect(findDepletionAge(series, 60)).toBeNull();
  });
});

describe("buildIdealTrajectory", () => {
  const base = {
    currentAge: 35,
    targetAge: 65,
    currentNetWorth: 10_000,
    currentInvestedNetWorth: 10_000,
    monthlyContribution: 500,
    requiredNetWorth: 1_000_000,
  };

  it("sem lifeExpectancyAge/monthlyDrawdown, para na idade-alvo (comportamento antigo)", () => {
    const result = buildIdealTrajectory(
      base.currentAge,
      base.targetAge,
      base.currentNetWorth,
      base.currentInvestedNetWorth,
      base.monthlyContribution,
      base.requiredNetWorth
    );
    expect(result).not.toBeNull();
    const lastAge = result!.series[result!.series.length - 1].age;
    expect(lastAge).toBe(base.targetAge);
    // bate (aproximadamente) a meta exatamente na idade-alvo, por construção
    expect(result!.series[result!.series.length - 1].value).toBeCloseTo(base.requiredNetWorth, 0);
  });

  it("com lifeExpectancyAge além da idade-alvo, continua sacando monthlyDrawdown na mesma taxa", () => {
    const lifeExpectancyAge = 85;
    const monthlyDrawdown = 4000; // ~4%/ano do 1.000.000 batido na meta
    const result = buildIdealTrajectory(
      base.currentAge,
      base.targetAge,
      base.currentNetWorth,
      base.currentInvestedNetWorth,
      base.monthlyContribution,
      base.requiredNetWorth,
      lifeExpectancyAge,
      monthlyDrawdown
    );
    expect(result).not.toBeNull();
    const lastPoint = result!.series[result!.series.length - 1];
    expect(lastPoint.age).toBe(lifeExpectancyAge);
    // Deve existir um ponto exatamente na idade-alvo marcando a virada de fase.
    expect(result!.series.some((p) => p.age === base.targetAge)).toBe(true);
  });

  it("nunca fica negativo durante a fase de retirada, mesmo sacando por muito tempo", () => {
    const result = buildIdealTrajectory(
      base.currentAge,
      base.targetAge,
      base.currentNetWorth,
      base.currentInvestedNetWorth,
      base.monthlyContribution,
      base.requiredNetWorth,
      110, // horizonte propositalmente exagerado pra forçar o esgotamento
      50_000 // saque mensal propositalmente alto
    );
    expect(result).not.toBeNull();
    for (const p of result!.series) {
      expect(p.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("retorna null quando a meta já está coberta pelo patrimônio de hoje", () => {
    const result = buildIdealTrajectory(35, 65, 2_000_000, 2_000_000, 500, 1_000_000);
    expect(result).toBeNull();
  });
});

describe("simulateRetirementCurve — fase de retirada nunca fica negativa", () => {
  it("zera e permanece em zero depois de esgotar, em vez de ir abaixo de zero", () => {
    const inputs: RetirementInputs = {
      currentAge: 60,
      targetRetirementAge: 61,
      currentNetWorth: 10_000,
      currentInvestedNetWorth: 10_000,
      monthlyContribution: 0,
      desiredMonthlyIncome: 50_000, // saque mensal muito maior que o patrimônio, esgota rápido
      expectedReturnConservative: 0.02,
      expectedReturnBase: 0.02,
      expectedReturnAggressive: 0.02,
      expectedInflation: 0.04,
    };
    const sim = simulateRetirementCurve(inputs);
    for (const p of sim.base.series) {
      expect(p.value).toBeGreaterThanOrEqual(0);
    }
    // depois de esgotado, deve ficar parado em zero (não voltar a crescer nem oscilar)
    const tail = sim.base.series.slice(-5).map((p) => p.value);
    expect(tail.every((v) => v === 0)).toBe(true);
  });
});
