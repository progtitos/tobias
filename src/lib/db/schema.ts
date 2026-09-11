// ============================================================================
// TOBIAS — Database schema (Drizzle ORM / PostgreSQL)
// ----------------------------------------------------------------------------
// See /ARCHITECTURE.md for the full design rationale. Highlights:
// - Money columns use numeric(14,2) in `number` mode — precise enough for
//   personal-finance amounts, simpler to work with than Decimal.js throughout
//   the app. Never `float`/`real` for money.
// - Every real financial fact carries `source` + `confidence` so the UI can
//   tell a user-entered number from an AI inference (spec rule: never fake
//   certainty).
// - A few entities from the brainstormed product spec were deliberately
//   consolidated to avoid two tables storing the same shape of fact twice —
//   each is flagged inline with `CONSOLIDATION:`.
// - We use plain `db.select()/.insert()` queries rather than Drizzle's
//   `relations()` relational-query API — for a schema this size, explicit
//   joins are easier to reason about and to tune for the aggregation-heavy
//   dashboard/bússola queries this product needs.
// - Tables are declared in dependency order (a table only references tables
//   declared above it) because `.references()` closures are evaluated at
//   module-load time.
// ============================================================================

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  real,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2, mode: "number" });

// ----------------------------------------------------------------------------
// ENUMS
// ----------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["USER", "PLANNER", "ADMIN"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "TRIAL",
  "TOBIAS",
  "TOBIAS_PRO",
  "TOBIAS_FAMILIA",
  "TOBIAS_PLANNER",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  // A user sits here from the moment they submit the signup form until
  // Mercado Pago confirms their card was authorized — the free trial does
  // not start yet (see AGENTS-facing note in lib/auth/actions.ts), and
  // requireUser()-gated routes bounce them to /pagamento-pendente instead
  // of onboarding while they're in this state.
  "PENDING_PAYMENT",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "EXPIRED",
]);
// Mercado Pago billing cycle for Tobias's own subscription (distinct from
// billingCycleEnum below, which tracks a USER's own detected third-party
// subscriptions like Netflix — unrelated to what Tobias charges).
export const planBillingCycleEnum = pgEnum("plan_billing_cycle", ["MENSAL", "SEMESTRAL", "ANUAL"]);
export const maritalStatusEnum = pgEnum("marital_status", [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
  "STABLE_UNION",
]);
export const riskProfileEnum = pgEnum("risk_profile", [
  "CONSERVATIVE",
  "MODERATE",
  "AGGRESSIVE",
]);
export const onboardingFocusEnum = pgEnum("onboarding_focus", [
  "RETIREMENT",
  "DEBT_RECOVERY",
  "BUY_PROPERTY",
  "BUILD_RESERVE",
  "GENERAL_ORGANIZATION",
  "DREAM_GOAL",
]);
export const dataSourceEnum = pgEnum("data_source", [
  "MANUAL",
  "WHATSAPP",
  "RECEIPT",
  "OCR",
  "PDF",
  "CSV",
  "OPEN_FINANCE",
  "API",
  "AI_INFERENCE",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "PIX",
  "BANK_TRANSFER",
  "BOLETO",
  "OTHER",
]);
export const bankAccountTypeEnum = pgEnum("bank_account_type", [
  "CHECKING",
  "SAVINGS",
  "INVESTMENT",
  "WALLET",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "OPEN",
  "CLOSED",
  "PAID",
  "OVERDUE",
]);
export const categoryKindEnum = pgEnum("category_kind", [
  "INCOME",
  "EXPENSE",
  "INVESTMENT",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "INCOME",
  "EXPENSE",
  "INVESTMENT_CONTRIBUTION",
  "TRANSFER",
]);
export const incomeFrequencyEnum = pgEnum("income_frequency", [
  "MONTHLY",
  "ANNUAL",
  "ONE_TIME",
  "VARIABLE",
]);
export const incomeCategoryEnum = pgEnum("income_category", [
  "SALARY",
  "FREELANCE",
  "RENTAL",
  "BUSINESS",
  "BENEFIT",
  "OTHER",
]);
export const billingCycleEnum = pgEnum("billing_cycle", ["MONTHLY", "ANNUAL"]);
export const investmentTypeEnum = pgEnum("investment_type", [
  "FIXED_INCOME",
  "FUNDS",
  "STOCKS",
  "ETF",
  "REIT",
  "PENSION",
  "TREASURY",
  "OTHER",
]);
export const assetTypeEnum = pgEnum("asset_type", [
  "REAL_ESTATE",
  "VEHICLE",
  "OTHER",
]);
export const debtTypeEnum = pgEnum("debt_type", [
  "CREDIT_CARD",
  "PERSONAL_LOAN",
  "FINANCING",
  "OVERDRAFT",
  "FAMILY_FRIENDS",
  "OTHER",
]);
export const goalTypeEnum = pgEnum("goal_type", [
  "DREAM",
  "EMERGENCY_FUND",
  "PROPERTY",
  "RETIREMENT",
  "CUSTOM",
]);
export const goalStatusEnum = pgEnum("goal_status", [
  "ACTIVE",
  "PAUSED",
  "ACHIEVED",
  "ABANDONED",
  "DELAYED",
]);
export const compassDimensionEnum = pgEnum("compass_dimension", [
  "EMERGENCY_RESERVE",
  "SPENDING_CONTROL",
  "DEBT",
  "PROTECTION",
  "INVESTMENTS",
  "RETIREMENT",
  "NET_WORTH",
  "GOALS",
  "BEHAVIOR",
]);
export const receiptStatusEnum = pgEnum("receipt_status", [
  "PROCESSING",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "FAILED",
]);
export const receiptExtractionMethodEnum = pgEnum("receipt_extraction_method", [
  "AI_VISION",
  "QR_CODE_NFCE",
  "MANUAL",
]);
export const documentKindEnum = pgEnum("document_kind", [
  "INVOICE_STATEMENT",
  "BANK_STATEMENT",
  "RECEIPT_PDF",
  "OTHER",
]);
export const conversationTypeEnum = pgEnum("conversation_type", [
  "ONBOARDING",
  "CHAT",
]);
export const messageRoleEnum = pgEnum("message_role", [
  "USER",
  "ASSISTANT",
  "SYSTEM",
]);
export const insightTypeEnum = pgEnum("insight_type", [
  "SPENDING_PATTERN",
  "BUDGET_IMPACT",
  "GOAL_PROGRESS",
  "RETIREMENT_IMPACT",
  "GENERAL",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "BUDGET_OVERRUN",
  "SUBSCRIPTION_INCREASE",
  "INSTALLMENT_ENDING",
  "CARD_ABOVE_PATTERN",
  "CONTRIBUTION_MISSING",
  "RESERVE_NEAR_TARGET",
  "GOAL_DELAYED",
  "DUPLICATE_CHARGE",
  "UNUSUAL_SPENDING",
]);
export const alertSeverityEnum = pgEnum("alert_severity", [
  "INFO",
  "WARNING",
  "CRITICAL",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "IN_APP",
  "EMAIL",
  "WHATSAPP",
  "PUSH",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "PENDING",
  "SENT",
  "FAILED",
]);
export const plannerClientStatusEnum = pgEnum("planner_client_status", [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "ENDED",
]);

// ----------------------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    phone: text("phone"), // E.164 — the future WhatsApp identifier
    phoneVerified: boolean("phone_verified").notNull().default(false),
    cpf: text("cpf"), // sensitive: mask in every UI surface, never log
    passwordHash: text("password_hash"),
    image: text("image"),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    role: userRoleEnum("role").notNull().default("USER"),

    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingStep: text("onboarding_step"),

    trialStartedAt: timestamp("trial_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
    subscriptionPlan: subscriptionPlanEnum("subscription_plan")
      .notNull()
      .default("TRIAL"),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .notNull()
      .default("TRIALING"),
    planBillingCycle: planBillingCycleEnum("plan_billing_cycle"),
    // Mercado Pago's subscription (preapproval) id for this user — the
    // correlation key the webhook uses to find who to update, and what
    // cancelSubscription() targets when the person cancels from Settings.
    mpPreapprovalId: text("mp_preapproval_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_phone_idx").on(t.phone),
    uniqueIndex("users_cpf_idx").on(t.cpf),
    uniqueIndex("users_mp_preapproval_idx").on(t.mpPreapprovalId),
  ]
);

export const authAccounts = pgTable("auth_accounts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
});

export const sessions = pgTable("sessions", {
  id: id(),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

// ----------------------------------------------------------------------------
// PROFILE & FINANCIAL PROFILE
// ----------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  maritalStatus: maritalStatusEnum("marital_status"),
  dependents: integer("dependents").notNull().default(0),
  profession: text("profession"),
  city: text("city"),
  state: text("state"),
  riskProfile: riskProfileEnum("risk_profile"),
  priorities: text("priorities").array(),
  financialHabits: text("financial_habits"),
  concerns: text("concerns").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Self-reported baseline from onboarding — distinct from computed numbers
// derived from real Transactions. Both appear in the product, always labeled
// by source (spec rule #10: never treat inference as certainty).
export const financialProfiles = pgTable("financial_profiles", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  statedMonthlyIncome: money("stated_monthly_income"),
  statedVariableIncome: money("stated_variable_income"),
  statedMonthlyExpenses: money("stated_monthly_expenses"),
  statedNetWorth: money("stated_net_worth"),
  statedTotalDebt: money("stated_total_debt"),
  desiredRetirementAge: integer("desired_retirement_age"),
  desiredRetirementIncome: money("desired_retirement_income"),
  currentAge: integer("current_age"),
  desiredLifestyle: text("desired_lifestyle"),
  savingsCapacityPerMonth: money("savings_capacity_per_month"),
  primaryFocus: onboardingFocusEnum("primary_focus"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Structured long-term memory extracted from conversation (spec #30).
export const financialMemories = pgTable(
  "financial_memories",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tag: text("tag"),
    importance: integer("importance").notNull().default(1),
    source: dataSourceEnum("source").notNull().default("AI_INFERENCE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("financial_memories_user_tag_idx").on(t.userId, t.tag)]
);

// ----------------------------------------------------------------------------
// CATEGORIES
// ----------------------------------------------------------------------------

// CONSOLIDATION: "Category" and "Subcategory" share one self-referencing
// table (parentId) instead of two identically-shaped tables. `parentId` is a
// plain column (no DB-level FK) to avoid a self-reference ordering headache;
// referential integrity for it is enforced in the service layer.
export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null = global seeded category
    name: text("name").notNull(),
    type: categoryKindEnum("type").notNull(),
    icon: text("icon"),
    color: text("color"),
    parentId: text("parent_id"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_user_idx").on(t.userId), index("categories_parent_idx").on(t.parentId)]
);

// Learned merchant -> category mapping (spec #11).
export const merchantCategoryMemories = pgTable(
  "merchant_category_memories",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    merchantNormalized: text("merchant_normalized").notNull(),
    categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    timesConfirmed: integer("times_confirmed").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("merchant_memory_user_merchant_idx").on(t.userId, t.merchantNormalized)]
);

// ----------------------------------------------------------------------------
// ACCOUNTS, CARDS, INVOICES
// ----------------------------------------------------------------------------

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bankName: text("bank_name"),
    type: bankAccountTypeEnum("type").notNull().default("CHECKING"),
    balance: money("balance").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bank_accounts_user_idx").on(t.userId)]
);

export const creditCards = pgTable(
  "credit_cards",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    brand: text("brand"),
    lastFourDigits: text("last_four_digits"),
    limitAmount: money("limit_amount"),
    closingDay: integer("closing_day"),
    dueDay: integer("due_day"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_cards_user_idx").on(t.userId)]
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    creditCardId: text("credit_card_id").notNull().references(() => creditCards.id, { onDelete: "cascade" }),
    referenceMonth: timestamp("reference_month", { withTimezone: true }).notNull(),
    closingDate: timestamp("closing_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    totalAmount: money("total_amount").notNull().default(0),
    status: invoiceStatusEnum("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoices_card_month_idx").on(t.creditCardId, t.referenceMonth)]
);

// ----------------------------------------------------------------------------
// GOALS / DREAMS
// ----------------------------------------------------------------------------

// CONSOLIDATION: "Dream" and "Goal" model the same lifecycle stage
// (Sonho -> Objetivo financeiro -> Meta -> Aporte -> Prazo) so they share one
// table, distinguished by `type` / `isQuantified`, instead of duplicating
// fields across two tables.
export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: goalTypeEnum("type").notNull().default("DREAM"),
    description: text("description"),
    targetAmount: money("target_amount"),
    currentAmount: money("current_amount").notNull().default(0),
    monthlyContribution: money("monthly_contribution"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    priority: integer("priority").notNull().default(3),
    status: goalStatusEnum("status").notNull().default("ACTIVE"),
    isQuantified: boolean("is_quantified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// PATRIMÔNIO: INVESTMENTS, ASSETS, DEBTS
// ----------------------------------------------------------------------------

export const investments = pgTable(
  "investments",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: investmentTypeEnum("type").notNull(),
    investedAmount: money("invested_amount").notNull(),
    currentAmount: money("current_amount").notNull(),
    liquidity: text("liquidity"),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    allocationPct: numeric("allocation_pct", { precision: 5, scale: 2, mode: "number" }),
    institution: text("institution"),
    source: dataSourceEnum("source").notNull().default("MANUAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("investments_user_idx").on(t.userId)]
);

export const assets = pgTable(
  "assets",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull(),
    estimatedValue: money("estimated_value").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assets_user_idx").on(t.userId)]
);

// CONSOLIDATION: "Liability" and "Debt" describe the same shape (something
// owed), so they share one model.
export const debts = pgTable(
  "debts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    type: debtTypeEnum("type").notNull(),
    totalAmount: money("total_amount").notNull(),
    remainingAmount: money("remaining_amount").notNull(),
    interestRateMonthly: numeric("interest_rate_monthly", { precision: 6, scale: 3, mode: "number" }),
    installmentAmount: money("installment_amount"),
    installmentsRemaining: integer("installments_remaining"),
    dueDay: integer("due_day"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("debts_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// RECURRING / SUBSCRIPTIONS / INCOME
// ----------------------------------------------------------------------------

export const incomes = pgTable(
  "incomes",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
    frequency: incomeFrequencyEnum("frequency").notNull().default("MONTHLY"),
    category: incomeCategoryEnum("category").notNull().default("SALARY"),
    isActive: boolean("is_active").notNull().default(true),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("incomes_user_idx").on(t.userId)]
);

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
    categoryId: text("category_id").references(() => categories.id),
    dayOfMonth: integer("day_of_month"),
    isActive: boolean("is_active").notNull().default(true),
    lastChargedAt: timestamp("last_charged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_expenses_user_idx").on(t.userId)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    serviceName: text("service_name").notNull(),
    amount: money("amount").notNull(),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("MONTHLY"),
    lastChargeAmount: money("last_charge_amount"),
    isActive: boolean("is_active").notNull().default(true),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    lastChargedAt: timestamp("last_charged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// RECEIPTS / DOCUMENTS
// ----------------------------------------------------------------------------

export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    imageUrls: text("image_urls").array(),
    merchant: text("merchant"),
    cnpj: text("cnpj"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    purchaseTime: text("purchase_time"),
    totalAmount: money("total_amount"),
    paymentMethod: paymentMethodEnum("payment_method"),
    status: receiptStatusEnum("status").notNull().default("PROCESSING"),
    ocrRawText: text("ocr_raw_text"),
    extractionMethod: receiptExtractionMethodEnum("extraction_method").notNull().default("AI_VISION"),
    confidence: doublePrecision("confidence").default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipts_user_idx").on(t.userId)]
);

export const receiptItems = pgTable(
  "receipt_items",
  {
    id: id(),
    receiptId: text("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3, mode: "number" }).notNull().default(1),
    unitPrice: money("unit_price"),
    totalPrice: money("total_price").notNull(),
    categoryGuess: text("category_guess"),
  },
  (t) => [index("receipt_items_receipt_idx").on(t.receiptId)]
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    kind: documentKindEnum("kind").notNull().default("OTHER"),
    status: receiptStatusEnum("status").notNull().default("PROCESSING"),
    extractedSummary: text("extracted_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// TRANSACTIONS (the core ledger)
// ----------------------------------------------------------------------------

// CONSOLIDATION: the spec lists "Income", "Expense" and "Transaction" as
// separate entities. `Transaction` here is the single ledger of everything
// that actually happened; `incomes` (above) models *expected/recurring*
// income used for planning. A standalone "Expense" table would just
// duplicate Transaction/RecurringExpense, so it was folded into those two.
export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    amount: money("amount").notNull(), // always positive; `type` gives direction
    type: transactionTypeEnum("type").notNull(),
    categoryId: text("category_id").references(() => categories.id),
    description: text("description").notNull(),
    merchant: text("merchant"),
    paymentMethod: paymentMethodEnum("payment_method"),

    bankAccountId: text("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
    creditCardId: text("credit_card_id").references(() => creditCards.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),

    installmentGroupId: text("installment_group_id"),
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),

    receiptId: text("receipt_id").references(() => receipts.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    investmentId: text("investment_id").references(() => investments.id, { onDelete: "set null" }),

    source: dataSourceEnum("source").notNull().default("MANUAL"),
    confidence: doublePrecision("confidence").notNull().default(1.0),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    index("transactions_installment_group_idx").on(t.installmentGroupId),
  ]
);

// ----------------------------------------------------------------------------
// RETIREMENT / BÚSSOLA / BUDGET / PLAN
// ----------------------------------------------------------------------------

export const retirementPlans = pgTable("retirement_plans", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currentAge: integer("current_age").notNull(),
  targetRetirementAge: integer("target_retirement_age").notNull(),
  desiredMonthlyIncome: money("desired_monthly_income").notNull(),
  currentNetWorth: money("current_net_worth").notNull().default(0),
  monthlyContribution: money("monthly_contribution").notNull().default(0),
  expectedReturnConservative: numeric("expected_return_conservative", { precision: 6, scale: 3, mode: "number" }).notNull().default(0.04),
  expectedReturnBase: numeric("expected_return_base", { precision: 6, scale: 3, mode: "number" }).notNull().default(0.06),
  expectedReturnAggressive: numeric("expected_return_aggressive", { precision: 6, scale: 3, mode: "number" }).notNull().default(0.09),
  expectedInflation: numeric("expected_inflation", { precision: 6, scale: 3, mode: "number" }).notNull().default(0.04),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Historical snapshots of the "Bússola Financeira" scores, persisted (not
// only computed live) so the dashboard can show trend over time — spec #46
// calls "evolução da Bússola" a core engagement metric.
export const financialCompassSnapshots = pgTable(
  "financial_compass_snapshots",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dimension: compassDimensionEnum("dimension").notNull(),
    score: integer("score").notNull(),
    status: text("status").notNull(),
    diagnosis: text("diagnosis").notNull(),
    nextAction: text("next_action").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("compass_user_dim_time_idx").on(t.userId, t.dimension, t.computedAt)]
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id),
    label: text("label").notNull(),
    limitAmount: money("limit_amount").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    isAutoCalculated: boolean("is_auto_calculated").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("budgets_user_idx").on(t.userId)]
);

// Versioned narrative summary of "the plan" — the concrete numbers live in
// Budget / Goal / RetirementPlan; this stores the AI-authored prose.
export const financialPlans = pgTable(
  "financial_plans",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    summary: text("summary").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("financial_plans_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// CONVERSATION / CHAT
// ----------------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: conversationTypeEnum("type").notNull().default("CHAT"),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId)]
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: id(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    extractedData: jsonb("extracted_data"),
    actions: jsonb("actions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_messages_conversation_idx").on(t.conversationId)]
);

// ----------------------------------------------------------------------------
// INSIGHTS / ALERTS / NOTIFICATIONS
// ----------------------------------------------------------------------------

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: insightTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    relatedData: jsonb("related_data"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_insights_user_created_idx").on(t.userId, t.createdAt)]
);

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: alertTypeEnum("type").notNull(),
    severity: alertSeverityEnum("severity").notNull().default("INFO"),
    message: text("message").notNull(),
    relatedData: jsonb("related_data"),
    isRead: boolean("is_read").notNull().default(false),
    isDismissed: boolean("is_dismissed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alerts_user_created_idx").on(t.userId, t.createdAt)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("PENDING"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// RESEARCH AGENT
// ----------------------------------------------------------------------------

export const researches = pgTable(
  "researches",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    resultSummary: text("result_summary").notNull(),
    sources: jsonb("sources").notNull(), // [{title, url}] — always populated, never fabricated
    searchedAt: timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("researches_user_idx").on(t.userId)]
);

// ----------------------------------------------------------------------------
// WHATSAPP (architecture ready, not wired to a live provider yet)
// ----------------------------------------------------------------------------

export const whatsappConnections = pgTable("whatsapp_connections", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone").notNull().unique(),
  verified: boolean("verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  optedIn: boolean("opted_in").notNull().default(false),
  // Set when the user submits a phone number from Settings; cleared once
  // they reply on WhatsApp with the matching code (see connectWhatsAppAction
  // / WhatsAppService.receiveMessage). Proves they actually control that
  // number before any bot message is ever answered for it.
  verificationCode: text("verification_code"),
  verificationCodeExpiresAt: timestamp("verification_code_expires_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ----------------------------------------------------------------------------
// AUDIT TRAIL & ANALYTICS
// ----------------------------------------------------------------------------

export const financialEvents = pgTable(
  "financial_events",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // e.g. "goal_created", "budget_overridden", "account_deleted"
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("financial_events_user_created_idx").on(t.userId, t.createdAt)]
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(), // signup_started, expense_created, chat_message, ...
    properties: jsonb("properties"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_events_name_created_idx").on(t.name, t.createdAt)]
);

// ----------------------------------------------------------------------------
// PLANNER PANEL (phase-2 scaffolding per spec #40 — schema only for now)
// ----------------------------------------------------------------------------

export const planners = pgTable("planners", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plannerClients = pgTable(
  "planner_clients",
  {
    id: id(),
    plannerId: text("planner_id").notNull().references(() => planners.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: plannerClientStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("planner_clients_unique_idx").on(t.plannerId, t.clientId)]
);

export const clientNotes = pgTable("client_notes", {
  id: id(),
  plannerClientId: text("planner_client_id").notNull().references(() => plannerClients.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientTasks = pgTable("client_tasks", {
  id: id(),
  plannerClientId: text("planner_client_id").notNull().references(() => plannerClients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
