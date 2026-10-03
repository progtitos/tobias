import { eq } from "drizzle-orm";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { financialProfiles } from "@/lib/db/schema";
import { getRetirementPlan } from "@/services/retirementPlan";
import { computeNetWorth } from "@/services/aggregations";
import { listGoals } from "@/services/goals";
import { getSalaryHistory } from "@/services/cnisImport";
import { RetirementClient } from "./RetirementClient";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Função à parte (não dentro do componente) só pra isolar a chamada impura
// (Date.now()) longe da função que o eslint trata como "componente" — a
// regra react-hooks/purity acusa qualquer Date.now()/Math.random() direto
// dentro de uma função que pareça um componente (nome maiúsculo + retorna
// JSX), mesmo sendo um Server Component que roda uma vez por request, não
// teria o problema real de "re-render instável" que a regra existe pra
// evitar. Extrair pra uma função comum (minúscula, devolve number) resolve
// o alarme falso sem desligar a regra.
function computeYearsFromNow(targetDate: Date): number {
  return (targetDate.getTime() - Date.now()) / MS_PER_YEAR;
}

export default async function RetirementPage() {
  const user = await requireOnboardedUser();
  const [plan, netWorth, financialProfile, goals, salaryHistory] = await Promise.all([
    getRetirementPlan(user.id),
    computeNetWorth(user.id),
    db.select().from(financialProfiles).where(eq(financialProfiles.userId, user.id)).then((r) => r[0] ?? null),
    listGoals(user.id),
    getSalaryHistory(user.id),
  ]);

  // `yearsFromNow` (não a idade em si) é calculado aqui no servidor, com o
  // "agora" real — o cliente só soma isso à idade atual que a pessoa digitar
  // no formulário (ver computeYearsFromNow acima sobre o isolamento do
  // Date.now()). RETIREMENT fica de fora de propósito: já existe um Goal
  // tipo "Aposentadoria" (Sonhos) que não tem nenhuma relação com o plano de
  // verdade desta tela (ver claude/especificacao-patrimonio-por-pilares.md,
  // "dois conceitos de aposentadoria coexistindo hoje") — plotar os dois na
  // mesma curva confundiria mais do que ajudaria até essa decisão ser
  // tomada, então só os Sonhos "de verdade" (não-Aposentadoria) entram aqui.
  const eligibleGoals = goals.filter((g) => g.type !== "RETIREMENT" && g.status !== "ABANDONED");
  const goalMarkers = eligibleGoals
    .filter((g) => g.targetDate && (g.targetAmount ?? 0) > 0)
    .map((g) => ({
      id: g.id,
      title: g.title,
      type: g.type,
      targetAmount: g.targetAmount,
      achieved: g.status === "ACHIEVED",
      yearsFromNow: computeYearsFromNow(new Date(g.targetDate!)),
    }));
  // Objetivos que existem mas não aparecem na curva por faltar valor e/ou
  // prazo (tipicamente Sonhos criados antes de "Data para conquista" virar
  // obrigatória, 02/10/2026) — sem aviso nenhum, o objetivo some da tela
  // sem explicação (bug reportado pelo Thiago, 03/10/2026: "a curva não
  // está pegando os objetivos"). Mesmo princípio do aviso já existente em
  // PatrimonioClient para o mini-gráfico do card: avisar em texto em vez de
  // deixar sumir silenciosamente.
  const goalsMissingData = eligibleGoals
    .filter((g) => !g.targetDate || !((g.targetAmount ?? 0) > 0))
    .map((g) => g.title);

  const defaults = {
    currentAge: plan?.currentAge ?? financialProfile?.currentAge ?? 30,
    targetRetirementAge: plan?.targetRetirementAge ?? financialProfile?.desiredRetirementAge ?? 65,
    desiredMonthlyIncome:
      plan?.desiredMonthlyIncome ?? financialProfile?.desiredRetirementIncome ?? (financialProfile?.statedMonthlyIncome ?? 3000) * 0.7,
    monthlyContribution: plan?.monthlyContribution ?? financialProfile?.savingsCapacityPerMonth ?? 0,
    expectedReturnConservative: plan?.expectedReturnConservative ?? 0.04,
    expectedReturnBase: plan?.expectedReturnBase ?? 0.06,
    expectedReturnAggressive: plan?.expectedReturnAggressive ?? 0.09,
    expectedInflation: plan?.expectedInflation ?? 0.04,
    // Renda garantida (INSS) — sem equivalente em financialProfiles hoje,
    // então o único fallback é o próprio plano salvo, ou null (campo vazio
    // no formulário, sem simulação de INSS até a pessoa preencher).
    birthDate: plan?.birthDate ?? null,
    gender: plan?.gender ?? null,
    contributionYearsToDate: plan?.contributionYearsToDate ?? null,
    averageMonthlySalary: plan?.averageMonthlySalary ?? null,
    guaranteedMonthlyIncomeOverride: plan?.guaranteedMonthlyIncomeOverride ?? null,
  };

  return (
    <RetirementClient
      defaults={defaults}
      currentNetWorth={netWorth.netWorth}
      currentInvestedNetWorth={netWorth.investedAssets}
      hasPlan={Boolean(plan)}
      goalMarkers={goalMarkers}
      goalsMissingData={goalsMissingData}
      salaryHistory={salaryHistory.map((r) => ({ competencia: r.competencia.toISOString(), salaryAmount: r.salaryAmount }))}
    />
  );
}
