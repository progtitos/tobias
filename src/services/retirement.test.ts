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
  // A partir de 03/10/2026 o 5º argumento é a TAXA real anual do cenário
  // atual da pessoa (não mais o aporte, que agora é calculado por dentro) —
  // ver comentário completo na função. Usamos a mesma taxa em todo o describe
  // só por simplicidade dos testes estruturais; o valor em si não importa
  // pra eles, exceto onde indicado.
  const annualRate = 0.06;
  const base = {
    currentAge: 35,
    targetAge: 65,
    currentNetWorth: 10_000,
    currentInvestedNetWorth: 10_000,
    requiredNetWorth: 1_000_000,
  };

  it("sem lifeExpectancyAge/monthlyDrawdown, para na idade-alvo e bate a meta por construção", () => {
    const result = buildIdealTrajectory(
      base.currentAge,
      base.targetAge,
      base.currentNetWorth,
      base.currentInvestedNetWorth,
      annualRate,
      base.requiredNetWorth
    );
    expect(result).not.toBeNull();
    expect(result!.annualRate).toBe(annualRate);
    expect(result!.monthlyContribution).toBeGreaterThan(0);
    const lastAge = result!.series[result!.series.length - 1].age;
    expect(lastAge).toBe(base.targetAge);
    // O aporte é resolvido justamente pra bater a meta exatamente na
    // idade-alvo — ao contrário do comportamento antigo (resolver a taxa),
    // isso nunca falha por "inatingível".
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
      annualRate,
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
      annualRate,
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
    const result = buildIdealTrajectory(35, 65, 2_000_000, 2_000_000, annualRate, 1_000_000);
    expect(result).toBeNull();
  });

  it("nunca retorna null por falta de aporte/patrimônio investido — bug relatado: 'quando deixo o aporte zerado a curva da aposentadoria some'", () => {
    // Exatamente o cenário reportado: nada investido ainda, e o aporte não é
    // mais um parâmetro de entrada (deixou de existir a noção de "taxa
    // inatingível" que fazia a curva sumir nesse caso).
    const result = buildIdealTrajectory(30, 60, 0, 0, 0.05, 500_000);
    expect(result).not.toBeNull();
    expect(result!.monthlyContribution).toBeGreaterThan(0);
    const lastPoint = result!.series[result!.series.length - 1];
    expect(lastPoint.age).toBe(60);
    expect(lastPoint.value).toBeCloseTo(500_000, 0);
  });

  it("embute o custo de um objetivo com prazo antes da aposentadoria no aporte ideal, e desconta a curva na idade certa", () => {
    // Taxa 0% real só pra deixar a aritmética exata e fácil de prever à mão
    // (mesmo espírito dos testes de goalWithdrawals de simulateRetirementCurve
    // abaixo) — o mecanismo em si não depende disso.
    const result = buildIdealTrajectory(30, 60, 0, 0, 0, 120_000, undefined, undefined, [
      { id: "carro", age: 40, amount: 12_000 },
    ]);
    expect(result).not.toBeNull();
    // 360 meses até a meta, mais o custo do objetivo (12.000, sem juros a
    // 0% real) embutido: aporte = (120.000 + 12.000) / 360.
    expect(result!.monthlyContribution).toBeCloseTo(132_000 / 360, 5);
    expect(result!.goalOutcomes).toHaveLength(1);
    expect(result!.goalOutcomes[0].covered).toBe(true);
    expect(result!.goalOutcomes[0].investedBefore).toBeCloseTo((132_000 / 360) * 120, 2);
    // Batendo exatamente o custo embutido do objetivo, a curva volta a
    // encontrar a meta original (sem o objetivo) na idade-alvo.
    const lastPoint = result!.series[result!.series.length - 1];
    expect(lastPoint.age).toBe(60);
    expect(lastPoint.value).toBeCloseTo(120_000, 0);
  });
});

describe("simulateRetirementCurve — goalWithdrawals (objetivos descontam da curva)", () => {
  // Retorno real 0% (expectedReturnBase === expectedInflation) só pra deixar
  // a aritmética exata e fácil de prever à mão nos testes abaixo — o
  // mecanismo em si (projectScenario) não depende disso.
  const zeroRealReturnInputs: Omit<RetirementInputs, "goalWithdrawals"> = {
    currentAge: 30,
    targetRetirementAge: 60,
    currentNetWorth: 50_000,
    currentInvestedNetWorth: 50_000,
    monthlyContribution: 1000,
    desiredMonthlyIncome: 0, // sem renda desejada: foco só no efeito dos objetivos, não da fase de retirada
    expectedReturnConservative: 0.04,
    expectedReturnBase: 0.04,
    expectedReturnAggressive: 0.04,
    expectedInflation: 0.04,
  };

  it("desconta o valor do objetivo da curva quando dá pra pagar à vista", () => {
    // Aos 35 anos (60 meses): 50.000 + 1.000×60 = 110.000 acumulado — dá pra
    // pagar um objetivo de 50.000 à vista.
    const sim = simulateRetirementCurve({
      ...zeroRealReturnInputs,
      goalWithdrawals: [{ id: "carro", age: 35, amount: 50_000 }],
    });

    expect(sim.base.goalOutcomes).toEqual([
      { id: "carro", age: 35, amount: 50_000, investedBefore: 110_000, covered: true },
    ]);
    const atGoalAge = sim.base.series.find((p) => p.age === 35)!;
    expect(atGoalAge.value).toBeCloseTo(60_000, 5); // 110.000 − 50.000
  });

  it("não desconta (e marca covered: false) quando o patrimônio investido ainda não chega lá", () => {
    // Aos 31 anos (12 meses): 50.000 + 1.000×12 = 62.000 — não cobre um
    // objetivo de 200.000; o objetivo simplesmente não acontece nesse cenário.
    const sim = simulateRetirementCurve({
      ...zeroRealReturnInputs,
      goalWithdrawals: [{ id: "casa", age: 31, amount: 200_000 }],
    });

    expect(sim.base.goalOutcomes).toEqual([
      { id: "casa", age: 31, amount: 200_000, investedBefore: 62_000, covered: false },
    ]);
    const atGoalAge = sim.base.series.find((p) => p.age === 31)!;
    expect(atGoalAge.value).toBeCloseTo(62_000, 5); // intocado, objetivo não "aconteceu"
  });

  it("aplica dois objetivos no mesmo mês em sequência, um podendo faltar depois do outro pagar", () => {
    // Mesmo ponto de partida do primeiro teste: 110.000 aos 35 anos.
    // Objetivo A (60.000) cabe; sobra 50.000; objetivo B (60.000) não cabe mais.
    const sim = simulateRetirementCurve({
      ...zeroRealReturnInputs,
      goalWithdrawals: [
        { id: "A", age: 35, amount: 60_000 },
        { id: "B", age: 35, amount: 60_000 },
      ],
    });

    expect(sim.base.goalOutcomes).toEqual([
      { id: "A", age: 35, amount: 60_000, investedBefore: 110_000, covered: true },
      { id: "B", age: 35, amount: 60_000, investedBefore: 50_000, covered: false },
    ]);
    const atGoalAge = sim.base.series.find((p) => p.age === 35)!;
    expect(atGoalAge.value).toBeCloseTo(50_000, 5);
  });

  it("ignora objetivo com prazo já vencido (idade <= idade atual) e com valor zero/negativo", () => {
    const sim = simulateRetirementCurve({
      ...zeroRealReturnInputs,
      goalWithdrawals: [
        { id: "vencido", age: 30, amount: 10_000 }, // idade <= currentAge
        { id: "zero", age: 40, amount: 0 },
        { id: "negativo", age: 40, amount: -500 },
      ],
    });

    expect(sim.base.goalOutcomes).toEqual([]);
  });

  it("sem goalWithdrawals, mantém o comportamento de antes (goalOutcomes vazio, curva intocada)", () => {
    const sim = simulateRetirementCurve(zeroRealReturnInputs);
    expect(sim.base.goalOutcomes).toEqual([]);
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
