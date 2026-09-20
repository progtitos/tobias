import { describe, it, expect } from "vitest";
import {
  simulateInssBenefit,
  computeAverageSalaryFromHistory,
  computeGuaranteedMonthlyIncome,
  TETO_INSS_2026,
  PISO_INSS_2026,
  type InssProfile,
} from "./inss";
import { ULTIMO_ANO_FECHADO as ULTIMO_ANO_FECHADO_TEST } from "./inpcIndex";

const REFORM_DATE = new Date(Date.UTC(2019, 10, 13));

function birthDateForAge(evalDate: Date, age: number): Date {
  const d = new Date(evalDate);
  d.setUTCFullYear(d.getUTCFullYear() - age);
  return d;
}

describe("simulateInssBenefit", () => {
  it("regra geral: elegível sozinha para quem não contribuía antes da reforma", () => {
    const evalDate = new Date(Date.UTC(2050, 0, 1));
    const profile: InssProfile = {
      gender: "M",
      // 66 em vez de exatamente 65: `yearsBetween` usa 365,25 dias/ano como
      // aproximação (documentado no próprio helper), então uma idade EXATA
      // no limiar pode cair uma fração de dia abaixo por causa de anos
      // bissextos reais vs. a média — margem de 1 ano evita esse ruído.
      birthDate: birthDateForAge(evalDate, 66),
      averageMonthlySalary: 6000,
      // contributionYearsAsOfDate = evalDate ⇒ contribAtReform vira bem negativo
      // (2050 é ~30 anos depois da reforma) ⇒ nenhuma regra de transição some.
      contributionYearsToDate: 20,
      contributionYearsAsOfDate: evalDate,
    };

    const sim = simulateInssBenefit(profile, evalDate);

    expect(sim.wasContributingBeforeReform).toBe(false);
    const geral = sim.rules.find((r) => r.rule === "GERAL")!;
    expect(geral.eligible).toBe(true);
    expect(geral.coefficient).toBeCloseTo(0.6, 5); // exatamente no limiar (20 anos), sem excedente
    expect(geral.monthlyBenefit).toBeCloseTo(6000 * 0.6, 2);

    for (const rule of ["PONTOS", "IDADE_PROGRESSIVA", "PEDAGIO_50", "PEDAGIO_100"] as const) {
      expect(sim.rules.find((r) => r.rule === rule)!.eligible).toBe(false);
    }

    expect(sim.bestRule?.rule).toBe("GERAL");
    expect(sim.estimatedMonthlyBenefit).toBeCloseTo(6000 * 0.6, 2);
  });

  it("regra de pontos: elegível com pontuação exata do ano de avaliação, coeficiente integral", () => {
    // 2026: 93 pontos exigidos (mulher). idade 55 + contribuição 38 = 93.
    const evalDate = new Date(Date.UTC(2026, 5, 15));
    const profile: InssProfile = {
      gender: "F",
      birthDate: birthDateForAge(evalDate, 55),
      averageMonthlySalary: 5000,
      // asOfDate = evalDate ⇒ contribAtEval = 38 exatamente (sem deriva pela
      // projeção). contribAtReform = 38 − anos entre a reforma e evalDate
      // (≈6,6) ≈ 31,4 — acima do mínimo de transição (30), então a pessoa
      // "já contribuía antes da reforma".
      contributionYearsToDate: 38,
      contributionYearsAsOfDate: evalDate,
    };

    const sim = simulateInssBenefit(profile, evalDate);

    expect(sim.wasContributingBeforeReform).toBe(true);
    const pontos = sim.rules.find((r) => r.rule === "PONTOS")!;
    expect(pontos.eligible).toBe(true);
    // 38 anos >= 35 (integral mulher) ⇒ coeficiente 100%.
    expect(pontos.coefficient).toBeCloseTo(1, 5);
    expect(pontos.monthlyBenefit).toBeCloseTo(5000, 2);

    // Regra geral não deveria valer ainda (62 anos exigidos, ela tem 55).
    expect(sim.rules.find((r) => r.rule === "GERAL")!.eligible).toBe(false);
  });

  it("pedágio de 100%: paga integral e vence o pedágio de 50% quando ambos elegíveis", () => {
    // Logo após a reforma (dez/2019): contribuição de 36 anos, 61 anos de
    // idade (margem sobre o limiar de 60 — ver comentário no 1º teste),
    // faltava 0 em 13/11/2019 para completar os 35 mínimos ⇒ pedágio de 100%
    // exige só 35 (bate) e paga 100%, contra ~92% da regra de pontos/pedágio 50%.
    const evalDate = new Date(Date.UTC(2019, 11, 1));
    const profile: InssProfile = {
      gender: "M",
      birthDate: birthDateForAge(evalDate, 61),
      averageMonthlySalary: 7000,
      contributionYearsToDate: 36,
      contributionYearsAsOfDate: REFORM_DATE,
    };

    const sim = simulateInssBenefit(profile, evalDate);

    const pedagio100 = sim.rules.find((r) => r.rule === "PEDAGIO_100")!;
    expect(pedagio100.eligible).toBe(true);
    expect(pedagio100.coefficient).toBe(1);
    expect(pedagio100.monthlyBenefit).toBeCloseTo(7000, 2);

    expect(sim.bestRule?.rule).toBe("PEDAGIO_100");
    expect(sim.estimatedMonthlyBenefit).toBeCloseTo(7000, 2);
  });

  it("nenhuma regra elegível ⇒ estimatedMonthlyBenefit é zero, não negativo nem null implícito", () => {
    const evalDate = new Date(Date.UTC(2026, 0, 1));
    const profile: InssProfile = {
      gender: "M",
      birthDate: birthDateForAge(evalDate, 40), // idade bem abaixo de qualquer regra
      averageMonthlySalary: 4000,
      contributionYearsToDate: 10,
      contributionYearsAsOfDate: evalDate,
    };

    const sim = simulateInssBenefit(profile, evalDate);
    expect(sim.bestRule).toBeNull();
    expect(sim.estimatedMonthlyBenefit).toBe(0);
  });

  it("clampBeneficio respeita piso e teto do INSS 2026", () => {
    const evalDate = new Date(Date.UTC(2050, 0, 1));
    const baixaRenda: InssProfile = {
      gender: "M",
      birthDate: birthDateForAge(evalDate, 70), // margem acima do limiar, ver comentário no primeiro teste
      averageMonthlySalary: 500, // abaixo do piso mesmo com coeficiente 100%
      contributionYearsToDate: 40,
      contributionYearsAsOfDate: evalDate,
    };
    const altaRenda: InssProfile = {
      ...baixaRenda,
      averageMonthlySalary: 50000, // muito acima do teto
    };

    expect(simulateInssBenefit(baixaRenda, evalDate).estimatedMonthlyBenefit).toBeCloseTo(PISO_INSS_2026, 2);
    expect(simulateInssBenefit(altaRenda, evalDate).estimatedMonthlyBenefit).toBeCloseTo(TETO_INSS_2026, 2);
  });
});

describe("computeAverageSalaryFromHistory", () => {
  it("retorna null sem competências elegíveis", () => {
    expect(computeAverageSalaryFromHistory([])).toBeNull();
    expect(computeAverageSalaryFromHistory([{ competencia: new Date(Date.UTC(1994, 0, 1)), salaryAmount: 1000 }])).toBeNull();
  });

  it("soma vínculos concorrentes na mesma competência antes de corrigir", () => {
    const competencia = new Date(Date.UTC(ULTIMO_ANO_FECHADO_TEST, 0, 1));
    const semConcorrencia = computeAverageSalaryFromHistory([{ competencia, salaryAmount: 3000 }]);
    const comConcorrencia = computeAverageSalaryFromHistory([
      { competencia, salaryAmount: 2000 },
      { competencia, salaryAmount: 1000 },
    ]);
    expect(comConcorrencia).toBeCloseTo(semConcorrencia!, 5);
  });

  it("capa cada competência no teto atual do INSS", () => {
    const competencia = new Date(Date.UTC(ULTIMO_ANO_FECHADO_TEST, 0, 1));
    const media = computeAverageSalaryFromHistory([{ competencia, salaryAmount: 999999 }]);
    expect(media).toBeCloseTo(TETO_INSS_2026, 2);
  });

  it("corrige competências antigas para cima antes de tirar a média", () => {
    const antiga = computeAverageSalaryFromHistory([{ competencia: new Date(Date.UTC(2010, 0, 1)), salaryAmount: 1000 }]);
    const recente = computeAverageSalaryFromHistory([{ competencia: new Date(Date.UTC(ULTIMO_ANO_FECHADO_TEST, 0, 1)), salaryAmount: 1000 }]);
    expect(antiga!).toBeGreaterThan(recente!);
  });
});

describe("computeGuaranteedMonthlyIncome com histórico do CNIS", () => {
  it("a média do histórico vence o campo manual quando ambos estão presentes", () => {
    const evalDate = new Date(Date.UTC(2050, 0, 1));
    const birthDate = birthDateForAge(evalDate, 66);

    const comHistorico = computeGuaranteedMonthlyIncome({
      targetRetirementAge: 66,
      birthDate,
      gender: "M",
      contributionYearsToDate: 20,
      contributionYearsAsOfDate: evalDate,
      averageMonthlySalary: 1000, // deveria ser ignorado
      salaryHistory: [{ competencia: new Date(Date.UTC(2024, 0, 1)), salaryAmount: 6000 }],
    });
    expect(comHistorico.averageSalarySource).toBe("cnis");

    const soManual = computeGuaranteedMonthlyIncome({
      targetRetirementAge: 66,
      birthDate,
      gender: "M",
      contributionYearsToDate: 20,
      contributionYearsAsOfDate: evalDate,
      averageMonthlySalary: 1000,
      salaryHistory: [],
    });
    expect(soManual.averageSalarySource).toBe("manual");
    expect(comHistorico.guaranteedMonthlyIncome).toBeGreaterThan(soManual.guaranteedMonthlyIncome);
  });
});
