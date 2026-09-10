import "server-only";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  conversations,
  conversationMessages,
  users,
  profiles,
  financialProfiles,
  financialMemories,
  debts,
  goals,
  retirementPlans,
} from "@/lib/db/schema";
import { AIService } from "@/lib/ai/AIService";
import { buildFinancialContextText } from "./financialContext";
import { generateInitialBudget } from "./budget";
import { saveCompassSnapshot } from "./compass";
import { seedGlobalCategoriesIfNeeded } from "@/lib/db/seedCategories";
import { trackEvent } from "./analytics";
import type { ChatTurn as GeminiChatTurn } from "@/lib/ai/generate";
import { computeNetWorth } from "./aggregations";
import { estimateTargetAge } from "./retirement";

const FIRST_MESSAGE = `Olá, eu sou o Tobias.

Meu trabalho é entender como sua vida financeira funciona e transformar isso em um plano que faça sentido para você.

Antes de começarmos, quero entender uma coisa: qual é a principal mudança financeira que você gostaria de conseguir nos próximos anos?`;

export async function getOrCreateOnboardingConversation(userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.type, "ONBOARDING")))
    .limit(1);

  if (existing) return existing;

  await seedGlobalCategoriesIfNeeded();

  const [conversation] = await db
    .insert(conversations)
    .values({ userId, type: "ONBOARDING", title: "Primeira conversa" })
    .returning();

  await db.insert(conversationMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: FIRST_MESSAGE,
  });

  await trackEvent(userId, "onboarding_started");
  return conversation;
}

export async function getOnboardingMessages(userId: string) {
  const conversation = await getOrCreateOnboardingConversation(userId);
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversation.id))
    .orderBy(asc(conversationMessages.createdAt));
}

async function applyExtractedData(userId: string, extracted: NonNullable<Awaited<ReturnType<typeof AIService.onboardingTurn>>["extracted"]>) {
  const profileUpdates: Partial<typeof profiles.$inferInsert> = {};
  if (extracted.dependents !== undefined) profileUpdates.dependents = extracted.dependents;
  if (extracted.maritalStatus) profileUpdates.maritalStatus = extracted.maritalStatus;
  if (extracted.profession) profileUpdates.profession = extracted.profession;
  if (extracted.riskProfile) profileUpdates.riskProfile = extracted.riskProfile;

  if (Object.keys(profileUpdates).length > 0 || extracted.priorities?.length || extracted.concerns?.length) {
    const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const mergedPriorities = Array.from(new Set([...(existing?.priorities ?? []), ...(extracted.priorities ?? [])]));
    const mergedConcerns = Array.from(new Set([...(existing?.concerns ?? []), ...(extracted.concerns ?? [])]));
    if (existing) {
      await db
        .update(profiles)
        .set({ ...profileUpdates, priorities: mergedPriorities, concerns: mergedConcerns, updatedAt: new Date() })
        .where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles).values({ userId, ...profileUpdates, priorities: mergedPriorities, concerns: mergedConcerns });
    }
  }

  const [existingFp] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);

  const fpUpdates: Partial<typeof financialProfiles.$inferInsert> = {};
  if (extracted.currentAge !== undefined) fpUpdates.currentAge = extracted.currentAge;
  if (extracted.monthlyIncome !== undefined) fpUpdates.statedMonthlyIncome = extracted.monthlyIncome;
  if (extracted.monthlyExpenses !== undefined) fpUpdates.statedMonthlyExpenses = extracted.monthlyExpenses;
  if (extracted.netWorth !== undefined) fpUpdates.statedNetWorth = extracted.netWorth;
  if (extracted.totalDebt !== undefined) fpUpdates.statedTotalDebt = extracted.totalDebt;
  if (extracted.savingsCapacityPerMonth !== undefined) fpUpdates.savingsCapacityPerMonth = extracted.savingsCapacityPerMonth;
  if (extracted.desiredRetirementAge !== undefined) {
    // Guard against an implausible age (e.g. the model free-associating a
    // round FIRE-movement number like 40 for a goal like "independência
    // financeira", which has no inherent target age). If it isn't clearly
    // after the person's current age, drop it — finalizeOnboarding computes
    // a real one from the numbers instead.
    const effectiveCurrentAge = extracted.currentAge ?? existingFp?.currentAge ?? undefined;
    if (effectiveCurrentAge === undefined || extracted.desiredRetirementAge > effectiveCurrentAge) {
      fpUpdates.desiredRetirementAge = extracted.desiredRetirementAge;
    }
  }
  if (extracted.desiredRetirementIncome !== undefined) fpUpdates.desiredRetirementIncome = extracted.desiredRetirementIncome;
  if (extracted.focus) fpUpdates.primaryFocus = extracted.focus;

  if (Object.keys(fpUpdates).length > 0) {
    if (existingFp) {
      await db.update(financialProfiles).set({ ...fpUpdates, updatedAt: new Date() }).where(eq(financialProfiles.userId, userId));
    } else {
      await db.insert(financialProfiles).values({ userId, ...fpUpdates });
    }
  }

  if (extracted.newDebt) {
    await db.insert(debts).values({
      userId,
      description: extracted.newDebt.description,
      type: extracted.newDebt.type,
      totalAmount: extracted.newDebt.remainingAmount,
      remainingAmount: extracted.newDebt.remainingAmount,
      installmentAmount: extracted.newDebt.installmentAmount,
      interestRateMonthly: extracted.newDebt.interestRateMonthly,
    });
  }

  if (extracted.newGoal) {
    await db.insert(goals).values({
      userId,
      title: extracted.newGoal.title,
      type: extracted.newGoal.type,
      targetAmount: extracted.newGoal.targetAmount,
      targetDate: extracted.newGoal.targetDate ? new Date(extracted.newGoal.targetDate) : undefined,
      monthlyContribution: extracted.newGoal.monthlyContribution,
      isQuantified: Boolean(extracted.newGoal.targetAmount),
    });
  }

  if (extracted.memoryNote) {
    await db.insert(financialMemories).values({
      userId,
      content: extracted.memoryNote,
      tag: extracted.focus ?? "general",
      importance: 3,
      source: "AI_INFERENCE",
    });
  }
}

async function finalizeOnboarding(userId: string) {
  const [fp] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
  const netWorth = await computeNetWorth(userId);

  const [existingPlan] = await db.select().from(retirementPlans).where(eq(retirementPlans.userId, userId)).limit(1);
  if (!existingPlan && fp?.currentAge) {
    const currentNetWorth = fp.statedNetWorth ?? netWorth.netWorth;
    const monthlyContribution = fp.savingsCapacityPerMonth ?? 0;
    const desiredMonthlyIncome = fp.desiredRetirementIncome ?? (fp.statedMonthlyIncome ?? 3000) * 0.7;

    // A stated age only counts if it's actually after the person's current
    // age — otherwise (including goals like "independência financeira" that
    // never had a target age to begin with) compute one from the real
    // numbers instead of guessing.
    const targetRetirementAge =
      fp.desiredRetirementAge && fp.desiredRetirementAge > fp.currentAge
        ? fp.desiredRetirementAge
        : estimateTargetAge({
            currentAge: fp.currentAge,
            currentNetWorth,
            monthlyContribution,
            desiredMonthlyIncome,
          });

    await db.insert(retirementPlans).values({
      userId,
      currentAge: fp.currentAge,
      targetRetirementAge,
      desiredMonthlyIncome,
      currentNetWorth,
      monthlyContribution,
    });
  }

  await generateInitialBudget(userId);
  await saveCompassSnapshot(userId);

  await db.update(users).set({ onboardingCompleted: true, updatedAt: new Date() }).where(eq(users.id, userId));
  await trackEvent(userId, "onboarding_completed");
  await trackEvent(userId, "retirement_plan_created");
  await trackEvent(userId, "budget_created");
}

export async function submitOnboardingMessage(userId: string, userMessage: string) {
  const conversation = await getOrCreateOnboardingConversation(userId);
  const priorMessages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversation.id))
    .orderBy(asc(conversationMessages.createdAt));

  const history: GeminiChatTurn[] = priorMessages.map((m) => ({
    role: m.role === "ASSISTANT" ? "model" : "user",
    text: m.content,
  }));

  await db.insert(conversationMessages).values({ conversationId: conversation.id, role: "USER", content: userMessage });

  const context = await buildFinancialContextText(userId);
  const turn = await AIService.onboardingTurn(context, history, userMessage);

  await db.insert(conversationMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: turn.reply,
    extractedData: turn.extracted ?? null,
  });

  if (turn.extracted) await applyExtractedData(userId, turn.extracted);
  await trackEvent(userId, "onboarding_message", { extracted: Boolean(turn.extracted) });

  let completed = false;
  if (turn.isOnboardingComplete) {
    await finalizeOnboarding(userId);
    completed = true;
  }

  return { reply: turn.reply, completed };
}
