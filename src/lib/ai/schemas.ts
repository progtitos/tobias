import { z } from "zod";

// ----------------------------------------------------------------------------
// Onboarding turn
// ----------------------------------------------------------------------------

export const onboardingExtractedSchema = z.object({
  currentAge: z.number().int().positive().optional(),
  monthlyIncome: z.number().nonnegative().optional(),
  monthlyExpenses: z.number().nonnegative().optional(),
  netWorth: z.number().optional(),
  totalDebt: z.number().nonnegative().optional(),
  dependents: z.number().int().nonnegative().optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "STABLE_UNION"]).optional(),
  profession: z.string().optional(),
  riskProfile: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).optional(),
  focus: z
    .enum(["RETIREMENT", "DEBT_RECOVERY", "BUY_PROPERTY", "BUILD_RESERVE", "GENERAL_ORGANIZATION", "DREAM_GOAL"])
    .optional(),
  savingsCapacityPerMonth: z.number().nonnegative().optional(),
  desiredRetirementAge: z.number().int().positive().optional(),
  desiredRetirementIncome: z.number().nonnegative().optional(),
  priorities: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
  newDebt: z
    .object({
      description: z.string(),
      type: z.enum(["CREDIT_CARD", "PERSONAL_LOAN", "FINANCING", "OVERDRAFT", "FAMILY_FRIENDS", "OTHER"]),
      remainingAmount: z.number().nonnegative(),
      installmentAmount: z.number().nonnegative().optional(),
      interestRateMonthly: z.number().nonnegative().optional(),
    })
    .optional(),
  newGoal: z
    .object({
      title: z.string(),
      type: z.enum(["DREAM", "EMERGENCY_FUND", "PROPERTY", "RETIREMENT", "CUSTOM"]),
      targetAmount: z.number().nonnegative().optional(),
      targetDate: z.string().optional(),
      monthlyContribution: z.number().nonnegative().optional(),
    })
    .optional(),
  memoryNote: z.string().optional(),
});

export const onboardingTurnSchema = z.object({
  reply: z.string(),
  extracted: onboardingExtractedSchema.optional(),
  isOnboardingComplete: z.boolean(),
});
export type OnboardingTurn = z.infer<typeof onboardingTurnSchema>;

export const onboardingTurnJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Sua próxima mensagem para o usuário, em português, curta e natural." },
    extracted: {
      type: "object",
      properties: {
        currentAge: { type: "number" },
        monthlyIncome: { type: "number" },
        monthlyExpenses: { type: "number" },
        netWorth: { type: "number" },
        totalDebt: { type: "number" },
        dependents: { type: "number" },
        maritalStatus: { type: "string", enum: ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "STABLE_UNION"] },
        profession: { type: "string" },
        riskProfile: { type: "string", enum: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"] },
        focus: {
          type: "string",
          enum: ["RETIREMENT", "DEBT_RECOVERY", "BUY_PROPERTY", "BUILD_RESERVE", "GENERAL_ORGANIZATION", "DREAM_GOAL"],
        },
        savingsCapacityPerMonth: { type: "number" },
        desiredRetirementAge: { type: "number" },
        desiredRetirementIncome: { type: "number" },
        priorities: { type: "array", items: { type: "string" } },
        concerns: { type: "array", items: { type: "string" } },
        newDebt: {
          type: "object",
          properties: {
            description: { type: "string" },
            type: { type: "string", enum: ["CREDIT_CARD", "PERSONAL_LOAN", "FINANCING", "OVERDRAFT", "FAMILY_FRIENDS", "OTHER"] },
            remainingAmount: { type: "number" },
            installmentAmount: { type: "number" },
            interestRateMonthly: { type: "number" },
          },
          required: ["description", "type", "remainingAmount"],
        },
        newGoal: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["DREAM", "EMERGENCY_FUND", "PROPERTY", "RETIREMENT", "CUSTOM"] },
            targetAmount: { type: "number" },
            targetDate: { type: "string", description: "ISO date, se mencionado" },
            monthlyContribution: { type: "number" },
          },
          required: ["title", "type"],
        },
        memoryNote: { type: "string", description: "Um fato importante para lembrar no futuro, em terceira pessoa." },
      },
    },
    isOnboardingComplete: {
      type: "boolean",
      description: "true somente quando já souber o suficiente para montar um primeiro plano (renda, gastos aproximados, ao menos um objetivo ou foco claro).",
    },
  },
  required: ["reply", "isOnboardingComplete"],
};

// ----------------------------------------------------------------------------
// Chat turn
// ----------------------------------------------------------------------------

export const chatActionSchema = z.object({
  label: z.string(),
  action: z.enum(["simulate_retirement", "view_expenses", "adjust_budget", "view_goals", "view_compass", "none"]),
});

export const chatTurnSchema = z.object({
  reply: z.string(),
  actions: z.array(chatActionSchema).max(2).optional(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const chatTurnJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          action: {
            type: "string",
            enum: ["simulate_retirement", "view_expenses", "adjust_budget", "view_goals", "view_compass", "none"],
          },
        },
        required: ["label", "action"],
      },
    },
  },
  required: ["reply"],
};

// ----------------------------------------------------------------------------
// Receipt extraction
// ----------------------------------------------------------------------------

export const receiptExtractionSchema = z.object({
  merchant: z.string().nullable(),
  cnpj: z.string().nullable(),
  purchaseDate: z.string().nullable().describe("ISO 8601 date"),
  purchaseTime: z.string().nullable(),
  totalAmount: z.number().nullable(),
  paymentMethod: z
    .enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "PIX", "BANK_TRANSFER", "BOLETO", "OTHER"])
    .nullable(),
  confidence: z.number().min(0).max(1),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive().default(1),
      unitPrice: z.number().nullable(),
      totalPrice: z.number(),
      categoryGuess: z.string().nullable(),
    })
  ),
});
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export const receiptExtractionJsonSchema = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"] },
    cnpj: { type: ["string", "null"] },
    purchaseDate: { type: ["string", "null"] },
    purchaseTime: { type: ["string", "null"] },
    totalAmount: { type: ["number", "null"] },
    paymentMethod: {
      type: ["string", "null"],
      enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD", "PIX", "BANK_TRANSFER", "BOLETO", "OTHER", null],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: ["number", "null"] },
          totalPrice: { type: "number" },
          categoryGuess: { type: ["string", "null"] },
        },
        required: ["description", "totalPrice"],
      },
    },
  },
  required: ["merchant", "totalAmount", "confidence", "items"],
};

// ----------------------------------------------------------------------------
// Extrato bancário / fatura de cartão — Document Agent, mesma família do
// recibo acima, mas devolvendo VÁRIAS transações de uma vez em vez de uma só.
// ----------------------------------------------------------------------------

export const statementExtractionSchema = z.object({
  periodStart: z.string().nullable().describe("ISO 8601 date, primeira transação do período"),
  periodEnd: z.string().nullable().describe("ISO 8601 date, última transação do período"),
  confidence: z.number().min(0).max(1),
  transactions: z.array(
    z.object({
      date: z.string().describe("ISO 8601 date"),
      description: z.string(),
      amount: z.number().positive(),
      // Sempre do ponto de vista de quem é dono da conta/cartão: dinheiro
      // saindo (compra, pagamento, tarifa) é EXPENSE; entrando (salário,
      // transferência recebida, estorno) é INCOME.
      type: z.enum(["EXPENSE", "INCOME"]),
      categoryGuess: z.string().nullable(),
      // Só preenchido quando o extrato/fatura já MOSTRA a parcela (ex: "2/5"
      // impresso na linha) — nunca inventado a partir do valor sozinho.
      installmentNumber: z.number().int().positive().nullable(),
      installmentTotal: z.number().int().positive().nullable(),
    })
  ),
});
export type StatementExtraction = z.infer<typeof statementExtractionSchema>;

export const statementExtractionJsonSchema = {
  type: "object",
  properties: {
    periodStart: { type: ["string", "null"] },
    periodEnd: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["EXPENSE", "INCOME"] },
          categoryGuess: { type: ["string", "null"] },
          installmentNumber: { type: ["number", "null"] },
          installmentTotal: { type: ["number", "null"] },
        },
        required: ["date", "description", "amount", "type"],
      },
    },
  },
  required: ["confidence", "transactions"],
};

// ----------------------------------------------------------------------------
// Transaction classification
// ----------------------------------------------------------------------------

export const classificationSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type Classification = z.infer<typeof classificationSchema>;

export const classificationJsonSchema = {
  type: "object",
  properties: {
    categoryId: { type: ["string", "null"], description: "O id exato de uma das categorias fornecidas, ou null se nenhuma se encaixar bem." },
    categoryName: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string", description: "Breve justificativa, uma frase." },
  },
  required: ["categoryName", "confidence", "reasoning"],
};

// ----------------------------------------------------------------------------
// Affordability ("Posso comprar?") decision
// ----------------------------------------------------------------------------

export const affordabilitySchema = z.object({
  canAfford: z.boolean(),
  recommendation: z.enum(["YES", "YES_WITH_CAUTION", "NO_NOT_NOW", "NO"]),
  explanation: z.string(),
  impactSummary: z.string(),
});
export type AffordabilityResult = z.infer<typeof affordabilitySchema>;

export const affordabilityJsonSchema = {
  type: "object",
  properties: {
    canAfford: { type: "boolean", description: "Se a pessoa tem capacidade financeira literal para a compra." },
    recommendation: { type: "string", enum: ["YES", "YES_WITH_CAUTION", "NO_NOT_NOW", "NO"] },
    explanation: { type: "string", description: "Explicação direta do motivo, conectando com o plano." },
    impactSummary: { type: "string", description: "Uma frase resumindo o impacto concreto (ex: atrasa a aposentadoria em X meses)." },
  },
  required: ["canAfford", "recommendation", "explanation", "impactSummary"],
};
