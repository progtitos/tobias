import "dotenv/config";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  users,
  profiles,
  financialProfiles,
  categories,
  bankAccounts,
  creditCards,
  investments,
  debts,
  goals,
  retirementPlans,
  transactions,
} from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { seedGlobalCategoriesIfNeeded } from "../src/lib/db/seedCategories";
import { generateInitialBudget } from "../src/services/budget";
import { saveCompassSnapshot } from "../src/services/compass";
import { computeNetWorth } from "../src/services/aggregations";

// ============================================================================
// Demo user seed — "João da Silva" (product spec §42).
//
// This is real data inserted into real tables, computed through the same
// services the app uses (generateInitialBudget, saveCompassSnapshot,
// computeNetWorth) — never a hardcoded dashboard. Safe to re-run: it deletes
// any previous demo user first (cascades to all their rows) and rebuilds
// from scratch, always relative to "today" so the seeded month always lines
// up with whatever month the app is viewed in.
// ============================================================================

const DEMO_EMAIL = "joao@tobias.demo";
const DEMO_PASSWORD = "TobiasDemo123!";

function monthsAgo(n: number, day: number, hour = 12) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, day, hour);
}

function yearsAgo(n: number) {
  const now = new Date();
  return new Date(now.getFullYear() - n, now.getMonth(), now.getDate());
}

async function categoryId(name: string): Promise<string | null> {
  const [c] = await db.select().from(categories).where(and(isNull(categories.userId), eq(categories.name, name))).limit(1);
  return c?.id ?? null;
}

async function main() {
  console.log("Seeding demo user João da Silva...");

  await seedGlobalCategoriesIfNeeded();

  // Clean slate: delete any previous run of the demo user (cascades to all
  // owned rows via onDelete: "cascade" on every child table).
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({
      name: "João da Silva",
      email: DEMO_EMAIL,
      passwordHash,
      birthDate: yearsAgo(38),
      onboardingCompleted: true,
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      subscriptionPlan: "TRIAL",
      subscriptionStatus: "TRIALING",
    })
    .returning();

  await db.insert(profiles).values({
    userId: user.id,
    maritalStatus: "MARRIED",
    dependents: 2,
    profession: "Gerente de projetos",
    city: "São Paulo",
    state: "SP",
    riskProfile: "MODERATE",
    priorities: ["Comprar a casa própria", "Garantir a aposentadoria", "Educação dos filhos"],
    financialHabits: "Organizado com contas fixas, mas gasta por impulso em restaurantes e compras online.",
    concerns: ["Não sei se vou conseguir me aposentar no padrão que quero", "Acho que gasto mais do que deveria no cartão"],
  });

  await db.insert(financialProfiles).values({
    userId: user.id,
    statedMonthlyIncome: 18000,
    statedMonthlyExpenses: 12400,
    statedNetWorth: 280000,
    statedTotalDebt: 45000,
    desiredRetirementAge: 55,
    desiredRetirementIncome: 12000,
    currentAge: 38,
    desiredLifestyle: "Manter o padrão de vida atual, viajar mais e não depender de ninguém financeiramente.",
    savingsCapacityPerMonth: 3000,
    primaryFocus: "BUY_PROPERTY",
  });

  // --------------------------------------------------------------------
  // Accounts, credit card, investments, debts
  // --------------------------------------------------------------------
  await db.insert(bankAccounts).values([
    { userId: user.id, name: "Conta corrente", bankName: "Itaú", type: "CHECKING", balance: 8200 },
  ]);

  const [creditCard] = await db
    .insert(creditCards)
    .values({ userId: user.id, nickname: "Nubank Ultravioleta", brand: "Mastercard", lastFourDigits: "4821", limitAmount: 25000, closingDay: 20, dueDay: 27 })
    .returning();

  await db.insert(investments).values([
    { userId: user.id, name: "Reserva de emergência - CDB liquidez diária", type: "FIXED_INCOME", investedAmount: 60000, currentAmount: 60000, liquidity: "D+0", institution: "Itaú" },
    { userId: user.id, name: "Tesouro IPCA+ 2035", type: "TREASURY", investedAmount: 90000, currentAmount: 98500, liquidity: "No vencimento", institution: "Tesouro Direto" },
    { userId: user.id, name: "Fundos multimercado", type: "FUNDS", investedAmount: 60000, currentAmount: 64200, liquidity: "D+30", institution: "XP Investimentos" },
    { userId: user.id, name: "Ações (carteira diversificada)", type: "STOCKS", investedAmount: 55000, currentAmount: 57300, liquidity: "D+2", institution: "XP Investimentos" },
  ]);

  await db.insert(debts).values([
    {
      userId: user.id,
      description: "Financiamento do carro",
      type: "FINANCING",
      totalAmount: 80000,
      remainingAmount: 45000,
      interestRateMonthly: 0.012,
      installmentAmount: 1850,
      installmentsRemaining: 24,
      dueDay: 10,
    },
  ]);

  // --------------------------------------------------------------------
  // Goals
  // --------------------------------------------------------------------
  const [houseGoal] = await db
    .insert(goals)
    .values({
      userId: user.id,
      title: "Casa própria",
      type: "PROPERTY",
      description: "Apartamento de 3 quartos na zona sul de São Paulo para a família.",
      targetAmount: 800000,
      currentAmount: 120000,
      monthlyContribution: 3000,
      targetDate: new Date(new Date().getFullYear() + 5, new Date().getMonth(), 1),
      priority: 1,
      status: "ACTIVE",
      isQuantified: true,
    })
    .returning();

  await db.insert(goals).values({
    userId: user.id,
    title: "Viagem em família para Portugal",
    type: "DREAM",
    targetAmount: 35000,
    currentAmount: 6000,
    monthlyContribution: 700,
    targetDate: new Date(new Date().getFullYear() + 1, 5, 1),
    priority: 2,
    status: "ACTIVE",
    isQuantified: true,
  });

  // --------------------------------------------------------------------
  // Retirement plan (currentNetWorth is filled in after all assets/debts
  // above exist, from the same computeNetWorth used everywhere else).
  // --------------------------------------------------------------------
  const netWorth = await computeNetWorth(user.id);
  await db.insert(retirementPlans).values({
    userId: user.id,
    currentAge: 38,
    targetRetirementAge: 55,
    desiredMonthlyIncome: 12000,
    currentNetWorth: netWorth.netWorth,
    monthlyContribution: 2500,
    expectedReturnConservative: 0.04,
    expectedReturnBase: 0.06,
    expectedReturnAggressive: 0.09,
    expectedInflation: 0.04,
  });

  // --------------------------------------------------------------------
  // Transactions: 3 months of realistic activity (2 months ago, 1 month
  // ago, this month), so the dashboard, budget and behavior checks all
  // have real history to work with.
  // --------------------------------------------------------------------
  const cat = {
    salario: await categoryId("Salário"),
    aluguelDespesa: await categoryId("Aluguel"),
    supermercado: await categoryId("Supermercado"),
    restaurante: await categoryId("Restaurante"),
    combustivel: await categoryId("Combustível"),
    planoSaude: await categoryId("Plano de saúde"),
    escola: await categoryId("Escola"),
    assinaturas: await categoryId("Assinaturas"),
    eletronicos: await categoryId("Eletrônicos"),
    investimentos: await categoryId("Investimentos"),
    familia: await categoryId("Família"),
  };

  const rows: (typeof transactions.$inferInsert)[] = [];

  for (let m = 2; m >= 0; m--) {
    const isCurrentMonth = m === 0;

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 5),
      amount: 18000,
      type: "INCOME",
      categoryId: cat.salario,
      description: "Salário",
      merchant: "Empresa XYZ Ltda",
      paymentMethod: "BANK_TRANSFER",
      source: "MANUAL",
    });

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 5),
      amount: 3500,
      type: "EXPENSE",
      categoryId: cat.aluguelDespesa,
      description: "Aluguel",
      merchant: "Imobiliária Central",
      paymentMethod: "BANK_TRANSFER",
      source: "MANUAL",
    });

    rows.push(
      { userId: user.id, date: monthsAgo(m, 3), amount: 780, type: "EXPENSE", categoryId: cat.supermercado, description: "Compras do mês", merchant: "Pão de Açúcar", paymentMethod: "DEBIT_CARD", source: "MANUAL" },
      { userId: user.id, date: monthsAgo(m, 17), amount: 620, type: "EXPENSE", categoryId: cat.supermercado, description: "Compras da quinzena", merchant: "Pão de Açúcar", paymentMethod: "DEBIT_CARD", source: "MANUAL" }
    );

    rows.push(
      { userId: user.id, date: monthsAgo(m, 8), amount: 185, type: "EXPENSE", categoryId: cat.restaurante, description: "Jantar em família", merchant: "Outback", paymentMethod: "CREDIT_CARD", creditCardId: creditCard.id, source: "MANUAL" },
      { userId: user.id, date: monthsAgo(m, 22), amount: 145, type: "EXPENSE", categoryId: cat.restaurante, description: "Almoço de fim de semana", merchant: "Restaurante Sabor Caseiro", paymentMethod: "CREDIT_CARD", creditCardId: creditCard.id, source: "MANUAL" }
    );

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 12),
      amount: 480,
      type: "EXPENSE",
      categoryId: cat.combustivel,
      description: "Abastecimento",
      merchant: "Posto Ipiranga",
      paymentMethod: "DEBIT_CARD",
      source: "MANUAL",
    });

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 10),
      amount: 1180,
      type: "EXPENSE",
      categoryId: cat.planoSaude,
      description: "Plano de saúde familiar",
      merchant: "Amil",
      paymentMethod: "BANK_TRANSFER",
      source: "MANUAL",
    });

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 8),
      amount: 1450,
      type: "EXPENSE",
      categoryId: cat.escola,
      description: "Mensalidade escolar",
      merchant: "Colégio Objetivo",
      paymentMethod: "BOLETO",
      source: "MANUAL",
    });

    // Netflix subscription — price increase in the current month, so the
    // subscription-increase behavior check has something real to catch.
    rows.push({
      userId: user.id,
      date: monthsAgo(m, 15),
      amount: isCurrentMonth ? 55.9 : 39.9,
      type: "EXPENSE",
      categoryId: cat.assinaturas,
      description: "Assinatura Netflix",
      merchant: "Netflix",
      paymentMethod: "CREDIT_CARD",
      creditCardId: creditCard.id,
      source: "MANUAL",
    });

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 15),
      amount: 34.9,
      type: "EXPENSE",
      categoryId: cat.assinaturas,
      description: "Assinatura Spotify Família",
      merchant: "Spotify",
      paymentMethod: "CREDIT_CARD",
      creditCardId: creditCard.id,
      source: "MANUAL",
    });

    rows.push({
      userId: user.id,
      date: monthsAgo(m, 3),
      amount: 189,
      type: "EXPENSE",
      categoryId: cat.familia,
      description: "Academia - plano família",
      merchant: "Smart Fit",
      paymentMethod: "CREDIT_CARD",
      creditCardId: creditCard.id,
      source: "MANUAL",
    });

    // Investment contribution toward the house goal.
    rows.push({
      userId: user.id,
      date: monthsAgo(m, 6),
      amount: 3000,
      type: "INVESTMENT_CONTRIBUTION",
      categoryId: cat.investimentos,
      description: "Aporte para Casa própria",
      goalId: houseGoal.id,
      source: "MANUAL",
    });
  }

  // A financed notebook, purchased 11 months ago in 12x — this month is the
  // second-to-last installment, so the "installment ending soon" behavior
  // check has a real example to raise.
  const installmentGroupId = "seed-notebook-2025";
  for (let i = 0; i < 3; i++) {
    const installmentNumber = 11 - (2 - i); // 9, 10, 11 across the 3 seeded months
    rows.push({
      userId: user.id,
      date: monthsAgo(2 - i, 18),
      amount: 350,
      type: "EXPENSE",
      categoryId: cat.eletronicos,
      description: "Notebook Dell Inspiron",
      merchant: "Magazine Luiza",
      paymentMethod: "CREDIT_CARD",
      creditCardId: creditCard.id,
      installmentGroupId,
      installmentNumber,
      installmentTotal: 12,
      source: "MANUAL",
    });
  }

  await db.insert(transactions).values(rows);

  // --------------------------------------------------------------------
  // Derive budget + compass through the real services, not hardcoded values.
  // --------------------------------------------------------------------
  await generateInitialBudget(user.id);
  await saveCompassSnapshot(user.id);

  console.log("\nDemo user ready:");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  userId:   ${user.id}`);
}

main()
  .then(() => {
    console.log("\nSeed completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
