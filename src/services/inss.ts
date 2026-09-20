/**
 * Simulador do benefício de aposentadoria do INSS (RGPS), pós-reforma da
 * previdência (EC 103/2019).
 *
 * MATEMÁTICA DETERMINÍSTICA, IGUAL A `retirement.ts` — nenhum número aqui
 * vem de IA. Todo valor tem citação da fonte no comentário da constante,
 * pra facilitar a atualização anual (teto, piso e tabelas de transição
 * mudam todo ano; ver `ANO_BASE` abaixo).
 *
 * ==========================================================================
 * AVISO IMPORTANTE DE ESCOPO — leia antes de mexer aqui
 * ==========================================================================
 * A reforma criou 5 regras coexistindo (mais aposentadoria especial e por
 * deficiência, fora de escopo — não cobertas por este produto): Regra Geral
 * (permanente), Regra de Pontos, Regra de Idade Progressiva, Pedágio de 50%
 * e Pedágio de 100%. As 3 primeiras usam o mesmo coeficiente de cálculo
 * (60% + 2%/ano de contribuição excedente a 15 anos [mulher] / 20 anos
 * [homem]); o Pedágio 100% paga 100% da média, sem redução; o Pedágio 50%
 * é o único que usa o FATOR PREVIDENCIÁRIO (fórmula da Lei 9.876/1999),
 * que depende da "expectativa de sobrevida" — uma tábua publicada
 * anualmente pelo IBGE. Essa tábua específica NÃO foi encontrada atualizada
 * para 2026 nas fontes consultadas (só tábuas de anos anteriores, com
 * calculadoras de terceiros mencionando uma defasagem de ~2 anos entre a
 * tábua do IBGE e a usada pelo INSS). `EXPECTATIVA_SOBREVIDA_APROX` abaixo
 * é uma aproximação por interpolação a partir de valores historicamente
 * publicados — é o número menos confiável deste arquivo. Qualquer resultado
 * do Pedágio 50% vem marcado com `approximate: true` na resposta.
 *
 * Este simulador também assume UMA média salarial única informada pelo
 * usuário (`averageMonthlySalary`), não um histórico mês a mês corrigido
 * pelo INPC desde jul/1994 (o que a lei realmente manda usar) — pedir isso
 * ao usuário exigiria uma tela de histórico salarial completa, fora do
 * escopo desta primeira leva. Isso é comunicado na UI como uma estimativa.
 *
 * Fontes consultadas (setembro/2026):
 * - Teto e piso do INSS 2026, regra de pontos e regra geral:
 *   https://www.barbieriadvogados.com/teto-do-inss-2026-valor-tabela-historica/
 *   https://www.ribeirocavalcante.com.br/regra-de-pontos-2026-aposentadoria-inss
 *   https://mariateixeiraadv.com.br/calculo-da-aposentadoria-2026-coeficientes-valores/
 * - As 5 regras de transição completas (tabela consolidada):
 *   https://mariateixeiraadv.com.br/regras-transicao-inss-2026-tabela-completa/
 * - Fórmula do fator previdenciário (Lei 9.876/1999):
 *   https://previdenciarista.com/calculadora-fator-previdenciario
 *
 * QUANDO ATUALIZAR: todo início de ano (a maioria das regras muda em
 * janeiro — teto, piso, +1 ponto, +6 meses de idade progressiva). Atualizar
 * só o objeto `ANO_BASE` e as tabelas de transição abaixo; o resto do
 * arquivo é lógica pura que não deveria precisar mudar até 2033 (quando a
 * última regra de transição — pontos, para mulheres — estabiliza).
 */

import { yearsBetween } from "@/lib/utils/dates";
import { corrigirPeloInpc, isCompetenciaElegivel } from "./inpcIndex";

export type Gender = "M" | "F";

/** Ano de referência dos valores monetários e das tabelas de transição abaixo. */
export const ANO_BASE = 2026;

/** Data da reforma da previdência (EC 103/2019) — marco de todas as regras de transição. */
const REFORM_DATE = new Date(Date.UTC(2019, 10, 13)); // 13/11/2019

/** Teto do INSS 2026 (Portaria Interministerial MPS/MF nº 13/2026). */
export const TETO_INSS_2026 = 8475.55;

/** Piso do INSS 2026 = salário mínimo (Art. 201, §2º da Constituição). */
export const PISO_INSS_2026 = 1621.0;

/** Limiar de anos de contribuição para o coeficiente 60% + 2%/ano (Regra Geral, Pontos, Idade Progressiva). */
const LIMIAR_COEFICIENTE: Record<Gender, number> = { F: 15, M: 20 };

/** Anos de contribuição para chegar a 100% do coeficiente (35 mulher / 40 homem). */
const ANOS_PARA_COEFICIENTE_INTEGRAL: Record<Gender, number> = { F: 35, M: 40 };

/** Tempo mínimo de contribuição da Regra Geral/permanente (Art. 19 — quem entrou no RGPS após 13/11/2019). */
const TEMPO_MINIMO_GERAL: Record<Gender, number> = { F: 15, M: 20 };

/** Idade mínima da Regra Geral/permanente em 2026 (já estabilizada desde 2023 para mulher, 2027 para homem — ver `idadeMinimaProgressiva`). */
const IDADE_MINIMA_GERAL: Record<Gender, number> = { F: 62, M: 65 };

/** Tempo mínimo de contribuição para QUALQUER regra de transição (Pontos, Idade Progressiva, Pedágios). */
const TEMPO_MINIMO_TRANSICAO: Record<Gender, number> = { F: 30, M: 35 };

/**
 * Regra de Pontos (Art. 15): pontos = idade + tempo de contribuição, ambos
 * em anos fracionários, na data de avaliação. Base 2019 + 1 ponto/ano até
 * congelar. Conferido contra o valor publicado de 2026 (93 mulher / 103
 * homem) — bate com base 86/96 + 7 anos.
 */
const PONTOS_BASE_2019: Record<Gender, number> = { F: 86, M: 96 };
const PONTOS_TETO: Record<Gender, number> = { F: 100, M: 105 }; // mulher congela em 2033, homem em 2028
function pontosExigidos(ano: number, gender: Gender): number {
  const incremento = Math.max(0, ano - 2019);
  return Math.min(PONTOS_BASE_2019[gender] + incremento, PONTOS_TETO[gender]);
}

/**
 * Regra de Idade Progressiva (Art. 16): +6 meses/ano desde 2019. Conferido
 * contra o valor publicado de 2026 (59,5 mulher / 64,5 homem) — bate com
 * base 56/61 + 3,5 anos (7 incrementos de 0,5).
 */
const IDADE_PROGRESSIVA_BASE_2019: Record<Gender, number> = { F: 56, M: 61 };
const IDADE_PROGRESSIVA_TETO: Record<Gender, number> = { F: 62, M: 65 }; // mulher congela em 2031, homem em 2027
function idadeMinimaProgressiva(ano: number, gender: Gender): number {
  const incremento = 0.5 * Math.max(0, ano - 2019);
  return Math.min(IDADE_PROGRESSIVA_BASE_2019[gender] + incremento, IDADE_PROGRESSIVA_TETO[gender]);
}

/**
 * Pedágio de 100% (Art. 20): idade fixa (não progressiva) + dobrar o tempo
 * que faltava em 13/11/2019 para completar o tempo mínimo de transição
 * (30 mulher / 35 homem). Único que paga 100% da média, sem redutor.
 */
const PEDAGIO_100_IDADE: Record<Gender, number> = { F: 57, M: 60 };

/**
 * Expectativa de sobrevida aproximada (anos), por idade — ver aviso no
 * topo do arquivo sobre a falta de uma tábua IBGE oficial atualizada nas
 * fontes consultadas. Interpolação linear entre os pontos. Valores
 * aproximados a partir de tábuas históricas do IBGE, com pequeno ajuste
 * para cima refletindo o aumento de expectativa de vida reportado em 2025
 * (76,6 anos ao nascer). NÃO usar para decisão jurídica — só para dar uma
 * ordem de grandeza do Pedágio 50% no simulador.
 */
const EXPECTATIVA_SOBREVIDA_APROX: Array<[idade: number, anos: number]> = [
  [40, 37.5],
  [45, 33.2],
  [50, 29.0],
  [55, 25.0],
  [56, 24.2],
  [57, 23.4],
  [58, 22.6],
  [59, 21.8],
  [60, 21.0],
  [61, 20.3],
  [62, 19.6],
  [63, 18.9],
  [64, 18.2],
  [65, 17.5],
  [70, 14.2],
  [75, 11.2],
  [80, 8.6],
];
function expectativaSobrevidaAprox(idade: number): number {
  const tabela = EXPECTATIVA_SOBREVIDA_APROX;
  if (idade <= tabela[0][0]) return tabela[0][1];
  if (idade >= tabela[tabela.length - 1][0]) return tabela[tabela.length - 1][1];
  for (let i = 0; i < tabela.length - 1; i++) {
    const [idadeA, valorA] = tabela[i];
    const [idadeB, valorB] = tabela[i + 1];
    if (idade >= idadeA && idade <= idadeB) {
      const fracao = (idade - idadeA) / (idadeB - idadeA);
      return valorA + fracao * (valorB - valorA);
    }
  }
  return tabela[tabela.length - 1][1];
}

/** Alíquota fixa da fórmula do fator previdenciário (Lei 9.876/1999, art. 7º). */
const ALIQUOTA_FATOR_PREVIDENCIARIO = 0.31;

/**
 * Fator previdenciário: f = (Tc × a / Es) × [1 + (Id + Tc × a) / 100]
 * Tc = tempo de contribuição (anos fracionários), Id = idade (anos
 * fracionários), Es = expectativa de sobrevida na idade Id, a = 0,31.
 */
function fatorPrevidenciario(tempoContribuicao: number, idade: number): number {
  const es = expectativaSobrevidaAprox(idade);
  const tcA = tempoContribuicao * ALIQUOTA_FATOR_PREVIDENCIARIO;
  return (tcA / es) * (1 + (idade + tcA) / 100);
}

/** Coeficiente-padrão 60% + 2%/ano acima do limiar, capado em 100%. */
function coeficientePadrao(tempoContribuicao: number, gender: Gender): number {
  const limiar = LIMIAR_COEFICIENTE[gender];
  const integral = ANOS_PARA_COEFICIENTE_INTEGRAL[gender];
  if (tempoContribuicao >= integral) return 1;
  const anosExcedentes = Math.max(0, tempoContribuicao - limiar);
  return Math.min(1, 0.6 + 0.02 * anosExcedentes);
}

function clampBeneficio(valor: number): number {
  return Math.min(TETO_INSS_2026, Math.max(PISO_INSS_2026, valor));
}

export type InssProfile = {
  gender: Gender;
  /** Data de nascimento. */
  birthDate: Date;
  /** Média mensal (já corrigida) dos salários de contribuição — estimativa informada pelo usuário. */
  averageMonthlySalary: number;
  /** Anos de contribuição já acumulados até `contributionYearsAsOfDate`. */
  contributionYearsToDate: number;
  /** Data de referência de `contributionYearsToDate` (normalmente: a data em que o plano foi salvo). */
  contributionYearsAsOfDate: Date;
};

export type InssRuleId = "GERAL" | "PONTOS" | "IDADE_PROGRESSIVA" | "PEDAGIO_50" | "PEDAGIO_100";

export type InssRuleResult = {
  rule: InssRuleId;
  label: string;
  eligible: boolean;
  coefficient: number | null;
  monthlyBenefit: number | null;
  /** true só para PEDAGIO_50 — ver aviso de escopo no topo do arquivo. */
  approximate: boolean;
  /** Só relevante para as regras de transição: false se o perfil não tinha contribuição antes da reforma (13/11/2019). */
  requiresPreReformContribution: boolean;
};

export type InssSimulation = {
  evalDate: Date;
  ageAtEval: number;
  contributionYearsAtEval: number;
  wasContributingBeforeReform: boolean;
  rules: InssRuleResult[];
  /** A regra elegível de maior benefício na data avaliada, ou null se nenhuma regra for elegível ainda. */
  bestRule: InssRuleResult | null;
  /** 0 se `bestRule` for null (a pessoa se aposentaria antes de ter direito a qualquer regra do INSS). */
  estimatedMonthlyBenefit: number;
};

function projectedContributionYears(profile: InssProfile, evalDate: Date): number {
  return profile.contributionYearsToDate + yearsBetween(profile.contributionYearsAsOfDate, evalDate);
}

function contributionYearsAtReform(profile: InssProfile): number {
  return profile.contributionYearsToDate - yearsBetween(REFORM_DATE, profile.contributionYearsAsOfDate);
}

/**
 * Simula o benefício do INSS na data `evalDate` (tipicamente: a data em
 * que o usuário planeja se aposentar), avaliando as 5 regras e escolhendo
 * a mais vantajosa entre as que a pessoa já cumpriria naquela data.
 */
export function simulateInssBenefit(profile: InssProfile, evalDate: Date): InssSimulation {
  const ageAtEval = yearsBetween(profile.birthDate, evalDate);
  const contribAtEval = projectedContributionYears(profile, evalDate);
  const contribAtReform = contributionYearsAtReform(profile);
  const wasContributingBeforeReform = contribAtReform > 0;
  const evalYear = evalDate.getUTCFullYear();
  const { gender, averageMonthlySalary } = profile;

  const rules: InssRuleResult[] = [];

  // 1) Regra Geral / permanente (Art. 19) — sempre avaliável, não exige filiação pré-reforma.
  {
    const eligible = ageAtEval >= IDADE_MINIMA_GERAL[gender] && contribAtEval >= TEMPO_MINIMO_GERAL[gender];
    const coefficient = coeficientePadrao(contribAtEval, gender);
    rules.push({
      rule: "GERAL",
      label: "Regra Geral (permanente)",
      eligible,
      coefficient: eligible ? coefficient : null,
      monthlyBenefit: eligible ? clampBeneficio(averageMonthlySalary * coefficient) : null,
      approximate: false,
      requiresPreReformContribution: false,
    });
  }

  // As 4 regras abaixo só existem para quem já contribuía antes de 13/11/2019.
  const transicaoDisponivel = wasContributingBeforeReform;

  // 2) Regra de Pontos (Art. 15)
  {
    const pontos = ageAtEval + contribAtEval;
    const pontosNecessarios = pontosExigidos(evalYear, gender);
    const eligible = transicaoDisponivel && contribAtEval >= TEMPO_MINIMO_TRANSICAO[gender] && pontos >= pontosNecessarios;
    const coefficient = coeficientePadrao(contribAtEval, gender);
    rules.push({
      rule: "PONTOS",
      label: `Regra de Pontos (${pontosNecessarios} pontos em ${evalYear})`,
      eligible,
      coefficient: eligible ? coefficient : null,
      monthlyBenefit: eligible ? clampBeneficio(averageMonthlySalary * coefficient) : null,
      approximate: false,
      requiresPreReformContribution: true,
    });
  }

  // 3) Regra de Idade Progressiva (Art. 16)
  {
    const idadeNecessaria = idadeMinimaProgressiva(evalYear, gender);
    const eligible = transicaoDisponivel && contribAtEval >= TEMPO_MINIMO_TRANSICAO[gender] && ageAtEval >= idadeNecessaria;
    const coefficient = coeficientePadrao(contribAtEval, gender);
    rules.push({
      rule: "IDADE_PROGRESSIVA",
      label: `Idade Progressiva (${idadeNecessaria.toFixed(1)} anos em ${evalYear})`,
      eligible,
      coefficient: eligible ? coefficient : null,
      monthlyBenefit: eligible ? clampBeneficio(averageMonthlySalary * coefficient) : null,
      approximate: false,
      requiresPreReformContribution: true,
    });
  }

  // 4) Pedágio de 50% (Art. 17) — usa fator previdenciário, aproximado.
  {
    const faltavaEm2019 = Math.max(0, TEMPO_MINIMO_TRANSICAO[gender] - contribAtReform);
    const tempoNecessario = TEMPO_MINIMO_TRANSICAO[gender] + 0.5 * faltavaEm2019;
    const eligible = transicaoDisponivel && contribAtEval >= tempoNecessario;
    const fator = eligible ? fatorPrevidenciario(contribAtEval, ageAtEval) : null;
    rules.push({
      rule: "PEDAGIO_50",
      label: "Pedágio de 50%",
      eligible,
      coefficient: fator,
      monthlyBenefit: eligible && fator !== null ? clampBeneficio(averageMonthlySalary * fator) : null,
      approximate: true,
      requiresPreReformContribution: true,
    });
  }

  // 5) Pedágio de 100% (Art. 20) — 100% da média, sem redutor.
  {
    const faltavaEm2019 = Math.max(0, TEMPO_MINIMO_TRANSICAO[gender] - contribAtReform);
    const tempoNecessario = TEMPO_MINIMO_TRANSICAO[gender] + 1.0 * faltavaEm2019;
    const eligible = transicaoDisponivel && contribAtEval >= tempoNecessario && ageAtEval >= PEDAGIO_100_IDADE[gender];
    rules.push({
      rule: "PEDAGIO_100",
      label: "Pedágio de 100%",
      eligible,
      coefficient: eligible ? 1 : null,
      monthlyBenefit: eligible ? clampBeneficio(averageMonthlySalary) : null,
      approximate: false,
      requiresPreReformContribution: true,
    });
  }

  const elegiveis = rules.filter((r) => r.eligible && r.monthlyBenefit !== null);
  const bestRule = elegiveis.length > 0
    ? elegiveis.reduce((best, r) => (r.monthlyBenefit! > best.monthlyBenefit! ? r : best))
    : null;

  return {
    evalDate,
    ageAtEval,
    contributionYearsAtEval: contribAtEval,
    wasContributingBeforeReform,
    rules,
    bestRule,
    estimatedMonthlyBenefit: bestRule?.monthlyBenefit ?? 0,
  };
}

/**
 * Busca (por incrementos mensais, até 40 anos à frente) a primeira data em
 * que QUALQUER regra passaria a ser elegível — usado para avisar o usuário
 * quando a idade-alvo de aposentadoria escolhida é anterior a qualquer
 * elegibilidade do INSS (nesse caso `simulateInssBenefit` na idade-alvo
 * retorna `estimatedMonthlyBenefit: 0`, mas a pessoa não ficará sem INSS
 * pra sempre — só a partir de outra data).
 */
export function findEarliestInssEligibility(profile: InssProfile, searchFrom: Date): InssSimulation | null {
  const MAX_MONTHS = 40 * 12;
  for (let m = 0; m <= MAX_MONTHS; m++) {
    const d = new Date(searchFrom);
    d.setUTCMonth(d.getUTCMonth() + m);
    const sim = simulateInssBenefit(profile, d);
    if (sim.bestRule) return sim;
  }
  return null;
}

/**
 * Formato mínimo de um plano (linha de `retirement_plans`, ou os inputs
 * ainda não salvos do formulário) necessário para calcular a renda
 * garantida. Sem `import "server-only"` de propósito — usado tanto no
 * servidor (compass.ts, dashboard.ts) quanto no client (RetirementClient,
 * pra mostrar a estimativa em tempo real enquanto a pessoa preenche o
 * formulário, antes de salvar).
 */
export type GuaranteedIncomeInput = {
  targetRetirementAge: number;
  birthDate?: Date | null;
  gender?: Gender | null;
  contributionYearsToDate?: number | null;
  contributionYearsAsOfDate?: Date | null;
  averageMonthlySalary?: number | null;
  guaranteedMonthlyIncomeOverride?: number | null;
  /** Usado como fallback de `contributionYearsAsOfDate` quando o plano ainda não foi salvo com uma data própria. */
  updatedAt?: Date | null;
  /**
   * Histórico salarial real importado do Extrato do CNIS (ver
   * services/cnisImport.ts). Quando presente e não-vazio, a média calculada
   * a partir dele (corrigida pelo INPC, ver computeAverageSalaryFromHistory
   * abaixo) VENCE `averageMonthlySalary` — o campo manual continua existindo
   * só como estimativa pra quem ainda não importou o extrato.
   */
  salaryHistory?: SalaryHistoryRecord[] | null;
};

export type SalaryHistoryRecord = { competencia: Date; salaryAmount: number };

/**
 * Média real dos salários de contribuição, a partir do histórico do Extrato
 * do CNIS — substitui a estimativa de um único campo digitado à mão. Duas
 * aproximações deliberadas, documentadas (mesmo espírito do resto deste
 * arquivo):
 *
 * 1) Vínculos concorrentes no mesmo mês (duas competências iguais, dois
 *    empregadores) são SOMADOS antes de aplicar o teto — corrigido para o
 *    teto ATUAL (TETO_INSS_2026), não o teto histórico daquele ano (que não
 *    está tabelado aqui), então o resultado tende a superestimar levemente
 *    competências muito antigas cujo teto real era mais baixo em termos
 *    proporcionais.
 * 2) A lei manda descartar os 20% menores salários só na regra de transição
 *    "antiga" (pré-existente à reforma), que este simulador não modela — a
 *    Regra Geral/Pontos/Idade Progressiva já implementadas aqui usam 100%
 *    do histórico, sem descarte, então mantemos a mesma premissa aqui.
 *
 * Retorna `null` se não houver nenhuma competência elegível (a partir de
 * jul/1994 — ver inpcIndex.ts) no histórico informado.
 */
export function computeAverageSalaryFromHistory(records: SalaryHistoryRecord[]): number | null {
  const byCompetencia = new Map<number, number>();
  for (const r of records) {
    if (!isCompetenciaElegivel(r.competencia)) continue;
    const key = Date.UTC(r.competencia.getUTCFullYear(), r.competencia.getUTCMonth(), 1);
    byCompetencia.set(key, (byCompetencia.get(key) ?? 0) + r.salaryAmount);
  }
  if (byCompetencia.size === 0) return null;

  let sum = 0;
  for (const [key, total] of byCompetencia) {
    const capped = Math.min(total, TETO_INSS_2026);
    sum += corrigirPeloInpc(capped, new Date(key));
  }
  return sum / byCompetencia.size;
}

/**
 * Renda garantida mensal (INSS/previdência) a ser usada na curva. Prioridade:
 * 1. `guaranteedMonthlyIncomeOverride`, se preenchido (a pessoa informou um
 *    valor conhecido — Rota 2 do backlog, disponível como escape hatch).
 * 2. Estimativa deste simulador na idade-alvo de aposentadoria, se os 4
 *    campos necessários estiverem preenchidos.
 * 3. Zero (comportamento anterior a esta mudança).
 */
export function computeGuaranteedMonthlyIncome(plan: GuaranteedIncomeInput): {
  guaranteedMonthlyIncome: number;
  inssEstimate: InssSimulation | null;
  /** De onde veio a média usada: histórico importado do CNIS, campo manual, ou nenhuma das duas (null). */
  averageSalarySource: "cnis" | "manual" | null;
} {
  if (plan.guaranteedMonthlyIncomeOverride != null) {
    return { guaranteedMonthlyIncome: plan.guaranteedMonthlyIncomeOverride, inssEstimate: null, averageSalarySource: null };
  }

  const historyAverage =
    plan.salaryHistory && plan.salaryHistory.length > 0 ? computeAverageSalaryFromHistory(plan.salaryHistory) : null;
  const averageMonthlySalary = historyAverage ?? plan.averageMonthlySalary ?? null;

  if (!plan.birthDate || !plan.gender || plan.contributionYearsToDate == null || averageMonthlySalary == null) {
    return { guaranteedMonthlyIncome: 0, inssEstimate: null, averageSalarySource: null };
  }

  const contributionYearsAsOfDate = plan.contributionYearsAsOfDate ?? plan.updatedAt ?? new Date();
  const evalDate = new Date(plan.birthDate);
  evalDate.setFullYear(evalDate.getFullYear() + plan.targetRetirementAge);

  const sim = simulateInssBenefit(
    {
      gender: plan.gender,
      birthDate: plan.birthDate,
      averageMonthlySalary,
      contributionYearsToDate: plan.contributionYearsToDate,
      contributionYearsAsOfDate,
    },
    evalDate
  );
  return {
    guaranteedMonthlyIncome: sim.estimatedMonthlyBenefit,
    inssEstimate: sim,
    averageSalarySource: historyAverage != null ? "cnis" : "manual",
  };
}
