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
  /** Patrimônio líquido total de hoje (contas + investido + outros bens −
   * dívidas) — usado só para exibição ("patrimônio atual"); a simulação em
   * si usa `currentInvestedNetWorth` como semente que compõe e trata o
   * resto (`currentNetWorth - currentInvestedNetWorth`, tipicamente saldo
   * em conta + outros bens) como uma base parada, que não rende sozinha
   * (decisão do Thiago, 03/10/2026: "saldo em conta deveria ser levado como
   * patrimônio [que rende]? se não é nada de concreto" — só o que está de
   * fato investido compõe à taxa de retorno esperado; aportes novos também
   * compõem, porque presume-se que viram investimento). */
  currentNetWorth: number;
  /** Fatia de `currentNetWorth` que está de fato investida (`investments`)
   * — é essa parte, e só essa, que compõe à taxa de retorno esperado em
   * cada cenário. Nunca maior que `currentNetWorth`. */
  currentInvestedNetWorth: number;
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
  /**
   * Sonhos/Objetivos com valor e prazo — cada um vira um saque pontual de
   * verdade na idade do prazo, em vez de só um ícone de referência que a
   * curva ignorava (pedido do Thiago, 03/10/2026: "objetivos, sonhos não
   * estão entrando no cálculo da curva"). Opcional e default `[]` (mantém o
   * comportamento anterior: nenhum objetivo afeta a curva). Ver
   * `ScenarioGoalOutcome` sobre a regra de "só desconta se der pra pagar".
   */
  goalWithdrawals?: GoalWithdrawal[];
};

export type ScenarioPoint = { age: number; value: number };

/** Um Sonho/Objetivo com valor e prazo, já convertido pra idade — formato de
 * entrada pro desconto na curva (ver `RetirementInputs.goalWithdrawals`). */
export type GoalWithdrawal = { id: string; age: number; amount: number };

/**
 * O que aconteceu, num cenário específico, quando a curva chegou na idade de
 * um objetivo com prazo — devolvido por `projectScenario` pra quem precisar
 * saber se aquele objetivo específico "se pagou" nesse cenário (ex.: o selo
 * "no caminho certo"/"requer ajuste" por objetivo em RetirementClient, e o
 * aro do ícone no gráfico), sem ter que reconstruir a mesma conta por fora
 * com `valueAtAge` (que já não bateria depois que a curva passou a descontar
 * objetivos — ver `covered` abaixo).
 */
export type ScenarioGoalOutcome = {
  id: string;
  age: number;
  amount: number;
  /** Quanto havia no patrimônio INVESTIDO (não conta o saldo parado —
   * mesma regra do saque de aposentadoria via `monthlyDrawdown`: só o que
   * compõe é "gasto correntemente disponível") um instante antes deste saque. */
  investedBefore: number;
  /** Só desconta da curva quando dá pra pagar à vista nesse ritmo — se não
   * dá, o objetivo simplesmente NÃO acontece nesse cenário (a curva não é
   * forçada a zerar nem a ficar "no vermelho" por causa de um objetivo que,
   * nesse ritmo, ainda não se pagou). `false` aqui é o que acende o selo
   * "requer ajuste" daquele objetivo específico. */
  covered: boolean;
};

export type ScenarioResult = {
  label: "conservador" | "base" | "agressivo";
  annualRealReturn: number;
  finalValueAtTargetAge: number;
  series: ScenarioPoint[];
  yearsToTarget: number | null; // years from now until the required nest egg is reached (may exceed the horizon)
  onTrack: boolean;
  /** Um item por objetivo de `goalWithdrawals` que de fato caiu dentro do
   * horizonte simulado (idade > currentAge) — ver `ScenarioGoalOutcome`. */
  goalOutcomes: ScenarioGoalOutcome[];
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
  investedSeed: number,
  staticBase: number,
  monthlyContribution: number,
  annualReal: number,
  requiredNetWorth: number,
  monthlyDrawdown: number,
  goalWithdrawals?: GoalWithdrawal[]
): ScenarioResult {
  const monthlyRate = Math.pow(1 + annualReal, 1 / 12) - 1;
  const monthsToTarget = Math.max(0, Math.round((targetAge - currentAge) * 12));

  // Agrupa cada objetivo no mês em que seu prazo cai (pode haver mais de um
  // no mesmo mês) — pedido do Thiago, 03/10/2026: "objetivos, sonhos não
  // estão entrando no cálculo da curva". Um objetivo cujo prazo já passou
  // (ou é agora) não gera saque: não tem sentido simular um gasto retroativo
  // nem dividir por um número de meses <= 0.
  const goalsByMonth = new Map<number, GoalWithdrawal[]>();
  for (const goal of goalWithdrawals ?? []) {
    if (goal.amount <= 0) continue;
    const monthIndex = Math.round((goal.age - currentAge) * 12);
    if (monthIndex <= 0) continue;
    const bucket = goalsByMonth.get(monthIndex);
    if (bucket) bucket.push(goal);
    else goalsByMonth.set(monthIndex, [goal]);
  }

  // `invested` é a única parte que compõe (juros + aporte); `staticBase`
  // (saldo em conta + outros bens, tipicamente) é somada por fora em cada
  // ponto, sem render nada sozinha — ver comentário de
  // `currentInvestedNetWorth` em RetirementInputs.
  const series: ScenarioPoint[] = [{ age: currentAge, value: investedSeed + staticBase }];
  const goalOutcomes: ScenarioGoalOutcome[] = [];
  let invested = investedSeed;
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
    invested =
      m <= monthsToTarget
        ? invested * (1 + monthlyRate) + monthlyContribution
        // Na fase de retirada o saldo investido não pode ficar negativo (não
        // modelamos dívida aqui) — sem isso, uma vez esgotado o patrimônio
        // continuaria "descontando" pra sempre, mostrando um valor cada vez
        // mais negativo em vez de simplesmente zerado (correção parte da
        // curva completa até a expectativa de vida, 03/10/2026).
        : Math.max(0, invested * (1 + monthlyRate) - monthlyDrawdown);

    // Saque pontual de cada objetivo cujo prazo é esse mês — compara contra
    // `invested` sozinho (não `invested + staticBase`), mesma regra já usada
    // pro `monthlyDrawdown`: só o que compõe é tratado como "disponível pra
    // gastar" nesta simulação, o saldo parado nunca é tocado. Só desconta
    // quando dá pra pagar à vista nesse ritmo — senão o objetivo não
    // acontece nesse cenário (não força a curva a zerar por causa de um
    // objetivo que ainda não se pagou; o selo "requer ajuste" já avisa isso).
    const goalsThisMonth = goalsByMonth.get(m);
    if (goalsThisMonth) {
      for (const goal of goalsThisMonth) {
        const investedBefore = invested;
        const covered = investedBefore >= goal.amount;
        if (covered) invested -= goal.amount;
        goalOutcomes.push({ id: goal.id, age: goal.age, amount: goal.amount, investedBefore, covered });
      }
    }

    const value = invested + staticBase;
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
    series.find((p) => Math.abs(p.age - targetAge) < 0.01)?.value ?? investedSeed + staticBase;

  return {
    label,
    annualRealReturn: annualReal,
    finalValueAtTargetAge,
    series: series.sort((a, b) => a.age - b.age),
    yearsToTarget,
    onTrack: finalValueAtTargetAge >= requiredNetWorth,
    goalOutcomes,
  };
}

export function simulateRetirementCurve(inputs: RetirementInputs): RetirementSimulation {
  const guaranteedMonthlyIncome = inputs.guaranteedMonthlyIncome ?? 0;
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, guaranteedMonthlyIncome);
  const monthlyDrawdown = Math.max(0, inputs.desiredMonthlyIncome - guaranteedMonthlyIncome);
  // Nunca negativo nem maior que o total — protege contra dado inconsistente
  // (ex.: `currentInvestedNetWorth` desatualizado por um instante após uma
  // venda de investimento, antes do patrimônio total refletir isso).
  const investedSeed = Math.min(Math.max(0, inputs.currentInvestedNetWorth), Math.max(0, inputs.currentNetWorth));
  const staticBase = inputs.currentNetWorth - investedSeed;

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
      investedSeed,
      staticBase,
      inputs.monthlyContribution,
      annualReal,
      requiredNetWorth,
      monthlyDrawdown,
      inputs.goalWithdrawals
    )
  );

  return { requiredNetWorth, conservative, base, aggressive };
}

/**
 * Interpola o valor da curva numa idade qualquer (não precisa cair exatamente
 * num ponto anual da série). Usado pra responder "nessa idade, o patrimônio
 * projetado já cobre esse objetivo?" — a mesma pergunta que o gráfico
 * "Futuro" faz visualmente ao plotar o ícone do objetivo em cima ou embaixo
 * da curva (ver RetirementChart, variant="hero", redesenho de 02/10/2026:
 * "liga os pontos" em vez de uma linha separada por objetivo).
 */
export function valueAtAge(series: ScenarioPoint[], age: number): number | null {
  if (series.length === 0) return null;
  if (age <= series[0].age) return series[0].value;
  if (age >= series[series.length - 1].age) return series[series.length - 1].value;
  for (let i = 1; i < series.length; i++) {
    if (series[i].age >= age) {
      const prev = series[i - 1];
      const next = series[i];
      const span = next.age - prev.age;
      if (span <= 0) return next.value;
      const t = (age - prev.age) / span;
      return prev.value + (next.value - prev.value) * t;
    }
  }
  return series[series.length - 1].value;
}

/**
 * Curva "Principal Investido" (cinza, redesenho "estilo 2" aprovado,
 * 03/10/2026) — quanto do patrimônio é dinheiro que de fato entrou (o
 * patrimônio de hoje + a soma dos aportes mensais), sem nenhum rendimento
 * composto, pra servir de referência visual de "quanto é retorno de verdade"
 * (a distância entre essa linha e "Seu patrimônio"). Para de crescer na
 * idade-alvo (não modelamos "aportar depois de aposentado") e fica parada daí
 * em diante — propositalmente NÃO cai na fase de retirada, porque "principal
 * investido" é sobre quanto entrou, não o saldo atual.
 */
export function buildPrincipalSeries(
  currentAge: number,
  targetAge: number,
  horizonAge: number,
  currentNetWorth: number,
  monthlyContribution: number
): ScenarioPoint[] {
  const ages: number[] = [];
  for (let age = currentAge; age <= horizonAge; age++) ages.push(age);
  if (ages.length === 0 || ages[ages.length - 1] !== horizonAge) ages.push(horizonAge);
  return ages.map((age) => ({
    age,
    value: currentNetWorth + monthlyContribution * 12 * (Math.min(age, targetAge) - currentAge),
  }));
}

/**
 * Primeira idade, depois de `afterAge`, em que a série bate (ou fica abaixo
 * de) zero — usado pra escrever a nota de sustentabilidade embaixo do
 * gráfico ("seu patrimônio sustenta até os X anos" vs. "acaba aos X anos").
 * `null` quando a série nunca esgota dentro do horizonte calculado (sustenta
 * por toda a fase de retirada simulada).
 */
export function findDepletionAge(series: ScenarioPoint[], afterAge: number): number | null {
  const depleted = series.find((p) => p.age > afterAge && p.value <= 0.5);
  return depleted ? depleted.age : null;
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
    Partial<
      Pick<RetirementInputs, "expectedReturnBase" | "expectedInflation" | "guaranteedMonthlyIncome" | "currentInvestedNetWorth">
    >
): number {
  const expectedReturnBase = inputs.expectedReturnBase ?? 0.06;
  const expectedInflation = inputs.expectedInflation ?? 0.04;
  const guaranteedMonthlyIncome = inputs.guaranteedMonthlyIncome ?? 0;
  const horizonAge = inputs.currentAge + MAX_PROJECTION_YEARS;
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, guaranteedMonthlyIncome);
  const monthlyDrawdown = Math.max(0, inputs.desiredMonthlyIncome - guaranteedMonthlyIncome);
  const annualReal = realReturn(expectedReturnBase, expectedInflation);
  // Na estimativa de onboarding não dá pra saber quanto do patrimônio
  // declarado está investido (ainda não tem conta/investimento cadastrado
  // de verdade) — sem essa info, assume tudo investido (comportamento de
  // antes desta mudança), em vez de subestimar logo na primeira tela.
  const investedSeed = inputs.currentInvestedNetWorth ?? inputs.currentNetWorth;
  const staticBase = inputs.currentNetWorth - investedSeed;

  const projection = projectScenario(
    "base",
    inputs.currentAge,
    horizonAge,
    investedSeed,
    staticBase,
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

/**
 * Resolve o aporte mensal necessário pra, compondo mensalmente a uma taxa
 * fixa `annualRate`, levar do patrimônio de hoje até `requiredNetWorth` em
 * exatamente `months` meses — álgebra de anuidade de forma fechada (extraída
 * de dentro de `requiredMonthlyContribution` em 03/10/2026 pra também servir
 * `buildIdealTrajectory`, abaixo). Ao contrário da antiga
 * `requiredAnnualReturnRate` (busca binária de taxa, removida nessa mesma
 * mudança), aqui sempre existe solução — o aporte pode ser arbitrariamente
 * grande — então nunca há um caso "inatingível".
 */
function requiredMonthlyContributionForRate(
  investedSeed: number,
  staticBase: number,
  annualRate: number,
  requiredNetWorth: number,
  months: number
): number {
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  // FV = PV*(1+r)^n + C * (((1+r)^n - 1) / r) + staticBase ; resolve C dado FV-alvo = requiredNetWorth.
  const growth = Math.pow(1 + monthlyRate, months);
  const annuityFactor = monthlyRate === 0 ? months : (growth - 1) / monthlyRate;
  const neededFromContributions = requiredNetWorth - staticBase - investedSeed * growth;
  return Math.max(0, neededFromContributions / annuityFactor);
}

export type IdealTrajectory = {
  /** Taxa de retorno real anual usada pra desenhar a curva — o "cenário
   * atual" da pessoa (ver `simulation.base.annualRealReturn` em
   * RetirementClient), não mais uma taxa resolvida por busca binária
   * (redesenho 03/10/2026, ver comentário completo abaixo). */
  annualRate: number;
  /** O aporte mensal que, nessa taxa (e já contando o custo dos objetivos
   * que caem antes da aposentadoria), fecha a meta — mesmo número usado pra
   * desenhar a curva E pro texto em amarelo "quanto seria o aporte ideal"
   * (pedido do Thiago, 03/10/2026), eliminando a divergência que existia
   * antes entre a curva (`buildIdealTrajectory`) e o texto
   * (`requiredMonthlyContribution`, que resolvia outra coisa). */
  monthlyContribution: number;
  series: ScenarioPoint[];
  /** Mesmo mecanismo de `ScenarioGoalOutcome` das 3 projeções reais, agora
   * também aplicado à curva ideal (pedido do Thiago, 03/10/2026: "não
   * esqueça dos ícones de sonhos e objetivos nessa curva") — permite colorir
   * o aro do ícone de cada objetivo também contra o ritmo ideal, se um dia
   * fizer sentido mostrar isso ao lado do veredito do cenário base. */
  goalOutcomes: ScenarioGoalOutcome[];
};

/**
 * A curva "Aposentadoria Ideal" (antiga curva "Meta"). Até 03/10/2026 ela
 * resolvia a TAXA de retorno necessária mantendo o aporte atual fixo — o que
 * fazia a curva simplesmente desaparecer sempre que aporte e patrimônio
 * investido eram zero (nada pode compor a partir de nada, não importa a
 * taxa; bug reportado pelo Thiago: "quando deixo o aporte zerado a curva da
 * aposentadoria some, a curva da aposentadoria é fixa, com base naquele
 * valor que aparece em amarelo"). Agora resolve o contrário: o APORTE
 * necessário mantendo fixa a taxa do CENÁRIO ATUAL da pessoa
 * (`annualRealReturn`, ver ponto de uso) — "a ideia é a curva 'Seu
 * patrimonio' comparar com a curva da aposentadoria com o cenário atual
 * dele... e aparecer nessa mensagem amarelo quanto seria o aporte ideal".
 * Isso elimina o desaparecimento por construção (um aporte sempre existe,
 * por maior que seja) e faz a curva e o texto em amarelo usarem o mesmo
 * número — ver `IdealTrajectory.monthlyContribution`.
 *
 * Sonhos/Objetivos com prazo (`goalWithdrawals`) também descontam dessa
 * curva, igual às 3 projeções reais (`projectScenario`) — pedido do Thiago,
 * 03/10/2026: "não esqueça dos ícones de sonhos e objetivos nessa curva". Um
 * objetivo cujo prazo cai antes da aposentadoria é embutido no aporte ideal
 * calculado (precisa ser guardado também); um objetivo na fase de retirada
 * só desconta do saldo no mês certo, sem afetar o aporte — mesmo papel que
 * `monthlyDrawdown` já tem ali.
 *
 * Quando `lifeExpectancyAge`/`monthlyDrawdown` são informados, a curva
 * continua depois da idade-alvo simulando a mesma fase de retirada que as 3
 * projeções usam (redesenho "estilo 2", 03/10/2026). `null` só quando a meta
 * já está coberta pelo patrimônio de hoje (nada a perseguir) ou quando a
 * idade-alvo não é depois da idade atual.
 */
export function buildIdealTrajectory(
  currentAge: number,
  targetAge: number,
  currentNetWorth: number,
  currentInvestedNetWorth: number,
  annualRealReturn: number,
  requiredNetWorth: number,
  lifeExpectancyAge?: number,
  monthlyDrawdown?: number,
  goalWithdrawals?: GoalWithdrawal[]
): IdealTrajectory | null {
  const investedSeed = Math.min(Math.max(0, currentInvestedNetWorth), Math.max(0, currentNetWorth));
  const staticBase = currentNetWorth - investedSeed;
  const monthsToTarget = Math.round((targetAge - currentAge) * 12);
  if (requiredNetWorth <= investedSeed + staticBase || monthsToTarget <= 0) return null;

  const monthlyRate = Math.pow(1 + annualRealReturn, 1 / 12) - 1;

  // Agrupa objetivos por mês (mesma lógica de `projectScenario`) e, só pros
  // que caem ANTES da idade-alvo, soma quanto cada um "pesaria" já composto
  // até lá — essa soma vira meta extra a bater, pra o aporte ideal sair já
  // contando com eles (sem isso, o aporte "ideal" ignoraria objetivos e a
  // curva ficaria sem fôlego pra pagá-los quando chegassem).
  const goalsByMonth = new Map<number, GoalWithdrawal[]>();
  let goalCostAtTarget = 0;
  for (const goal of goalWithdrawals ?? []) {
    if (goal.amount <= 0) continue;
    const monthIndex = Math.round((goal.age - currentAge) * 12);
    if (monthIndex <= 0) continue;
    const bucket = goalsByMonth.get(monthIndex);
    if (bucket) bucket.push(goal);
    else goalsByMonth.set(monthIndex, [goal]);
    if (monthIndex <= monthsToTarget) {
      const growthRemaining = monthlyRate === 0 ? 1 : Math.pow(1 + monthlyRate, monthsToTarget - monthIndex);
      goalCostAtTarget += goal.amount * growthRemaining;
    }
  }

  const monthlyContribution = requiredMonthlyContributionForRate(
    investedSeed,
    staticBase,
    annualRealReturn,
    requiredNetWorth + goalCostAtTarget,
    monthsToTarget
  );

  const series: ScenarioPoint[] = [{ age: currentAge, value: investedSeed + staticBase }];
  const goalOutcomes: ScenarioGoalOutcome[] = [];
  let invested = investedSeed;
  const totalMonths =
    lifeExpectancyAge != null && lifeExpectancyAge > targetAge
      ? Math.round((lifeExpectancyAge - currentAge) * 12)
      : monthsToTarget;

  for (let m = 1; m <= totalMonths; m++) {
    invested =
      m <= monthsToTarget
        ? invested * (1 + monthlyRate) + monthlyContribution
        : Math.max(0, invested * (1 + monthlyRate) - (monthlyDrawdown ?? 0));

    const goalsThisMonth = goalsByMonth.get(m);
    if (goalsThisMonth) {
      for (const goal of goalsThisMonth) {
        const investedBefore = invested;
        const covered = investedBefore >= goal.amount;
        if (covered) invested -= goal.amount;
        goalOutcomes.push({ id: goal.id, age: goal.age, amount: goal.amount, investedBefore, covered });
      }
    }

    if (m % 12 === 0 || m === monthsToTarget || m === totalMonths) {
      series.push({ age: currentAge + m / 12, value: invested + staticBase });
    }
  }

  return { annualRate: annualRealReturn, monthlyContribution, series, goalOutcomes };
}

/** How much the monthly contribution would need to change to reach the goal at the target age, holding everything else constant — delega pra `requiredMonthlyContributionForRate` (extraída em 03/10/2026 pra também servir `buildIdealTrajectory`). */
export function requiredMonthlyContribution(inputs: RetirementInputs, scenario: "conservative" | "base" | "aggressive" = "base"): number {
  const rate =
    scenario === "conservative"
      ? inputs.expectedReturnConservative
      : scenario === "aggressive"
        ? inputs.expectedReturnAggressive
        : inputs.expectedReturnBase;
  const annualReal = realReturn(rate, inputs.expectedInflation);
  const months = Math.max(1, Math.round((inputs.targetRetirementAge - inputs.currentAge) * 12));
  const requiredNetWorth = computeRequiredNetWorth(inputs.desiredMonthlyIncome, inputs.guaranteedMonthlyIncome ?? 0);
  const investedSeed = Math.min(Math.max(0, inputs.currentInvestedNetWorth), Math.max(0, inputs.currentNetWorth));
  const staticBase = inputs.currentNetWorth - investedSeed;
  return requiredMonthlyContributionForRate(investedSeed, staticBase, annualReal, requiredNetWorth, months);
}
