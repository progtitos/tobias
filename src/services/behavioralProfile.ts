import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles, behavioralProfileSnapshots } from "@/lib/db/schema";
import { computeCompass, type CompassDimensionResult } from "./compass";

export type BehavioralProfile =
  | "CAUTIOUS_GUARDIAN"
  | "CONFIDENT_INVESTOR"
  | "GOAL_BUILDER"
  | "LIFESTYLE_SPENDER"
  | "MONTHLY_SURVIVOR"
  | "EMERGING_ORGANIZER";

export const BEHAVIORAL_PROFILE_LABELS: Record<BehavioralProfile, string> = {
  CAUTIOUS_GUARDIAN: "Guardião Cauteloso",
  CONFIDENT_INVESTOR: "Investidor Confiante",
  GOAL_BUILDER: "Construtor de Metas",
  LIFESTYLE_SPENDER: "Vive o Presente",
  MONTHLY_SURVIVOR: "Apagando Incêndio",
  EMERGING_ORGANIZER: "Organizador em Construção",
};

export const BEHAVIORAL_PROFILE_DESCRIPTIONS: Record<BehavioralProfile, string> = {
  CAUTIOUS_GUARDIAN: "Prioriza segurança acima de tudo: reserva sólida, perfil de risco conservador.",
  CONFIDENT_INVESTOR: "Investe de forma consistente e busca fazer o dinheiro render.",
  GOAL_BUILDER: "Organizado em torno de objetivos concretos, acompanha o progresso de perto.",
  LIFESTYLE_SPENDER: "Prioriza aproveitar o presente, sem estar necessariamente endividado.",
  MONTHLY_SURVIVOR: "O mês aperta e sobra pouco no fim. Todo mundo passa por isso em algum momento.",
  EMERGING_ORGANIZER: "Ainda estamos te conhecendo. Cada conversa e cada lançamento ajudam a afinar seu perfil.",
};

function dimScore(dims: CompassDimensionResult[], dimension: CompassDimensionResult["dimension"]) {
  return dims.find((d) => d.dimension === dimension)?.score ?? 0;
}

/**
 * Classificação híbrida do PCA (Perfil Comportamental) — determinística, na
 * mesma linha de raciocínio "reproduzível e explicável" que já rege a
 * Bússola (nunca a IA "achando" o perfil livremente).
 *
 * Regras avaliadas em ordem de prioridade (a primeira que bater decide),
 * reaproveitando 100% dos scores que a Bússola já calcula — ver
 * claude/especificacao-perfil-comportamental-onboarding.md seção 5.
 *
 * Quando nenhuma regra bate (sinal insuficiente, ex.: conta nova sem
 * histórico), o resultado computado é EMERGING_ORGANIZER — nesse caso o
 * autorrelato do onboarding (`behavioralProfileSelfReport`) continua
 * valendo como palpite inicial, com confiança INITIAL, em vez de ser
 * sobrescrito. Um perfil já CONSOLIDATED nunca é rebaixado de volta por uma
 * recomputação momentaneamente sem sinal (ex.: um mês parado) — só uma nova
 * regra computada com sinal real muda o valor a partir daí.
 */
export async function computeBehavioralProfile(userId: string, compassResults?: CompassDimensionResult[]) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const dims = compassResults ?? (await computeCompass(userId));

  const debtScore = dimScore(dims, "DEBT");
  const spendingScore = dimScore(dims, "SPENDING_CONTROL");
  const reserveScore = dimScore(dims, "EMERGENCY_RESERVE");
  const investmentsScore = dimScore(dims, "INVESTMENTS");
  const goalsScore = dimScore(dims, "GOALS");
  const riskProfile = profile?.riskProfile ?? null;

  let computed: BehavioralProfile = "EMERGING_ORGANIZER";
  if (debtScore < 40 && spendingScore < 40) {
    computed = "MONTHLY_SURVIVOR";
  } else if (reserveScore >= 70 && riskProfile === "CONSERVATIVE") {
    computed = "CAUTIOUS_GUARDIAN";
  } else if (investmentsScore >= 60 && riskProfile !== null && riskProfile !== "CONSERVATIVE") {
    computed = "CONFIDENT_INVESTOR";
  } else if (goalsScore >= 60) {
    computed = "GOAL_BUILDER";
  } else if (spendingScore < 60 && investmentsScore < 40) {
    computed = "LIFESTYLE_SPENDER";
  }

  const selfReport = (profile?.behavioralProfileSelfReport as BehavioralProfile | null) ?? null;
  const previousProfile = (profile?.behavioralProfile as BehavioralProfile | undefined) ?? "EMERGING_ORGANIZER";
  const previousConfidence = profile?.behavioralProfileConfidence ?? "INITIAL";

  let finalProfile: BehavioralProfile = previousProfile;
  let confidence: "INITIAL" | "CONSOLIDATED" = previousConfidence;

  if (computed !== "EMERGING_ORGANIZER") {
    finalProfile = computed;
    confidence = "CONSOLIDATED";
  } else if (previousConfidence !== "CONSOLIDATED") {
    finalProfile = selfReport ?? "EMERGING_ORGANIZER";
    confidence = "INITIAL";
  }

  const signals = {
    debtScore,
    spendingScore,
    reserveScore,
    investmentsScore,
    goalsScore,
    riskProfile,
    selfReport,
    computed,
  };

  if (profile) {
    await db
      .update(profiles)
      .set({ behavioralProfile: finalProfile, behavioralProfileConfidence: confidence, behavioralProfileUpdatedAt: new Date() })
      .where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({
      userId,
      behavioralProfile: finalProfile,
      behavioralProfileConfidence: confidence,
      behavioralProfileUpdatedAt: new Date(),
    });
  }

  await db.insert(behavioralProfileSnapshots).values({ userId, profile: finalProfile, confidence, signals });

  return { profile: finalProfile, confidence, label: BEHAVIORAL_PROFILE_LABELS[finalProfile] };
}

/**
 * Registra diretamente o palpite inicial vindo do autorrelato do onboarding,
 * sem esperar o próximo recálculo de Bússola — usado por
 * `finalizeOnboarding` pra já ter algo pra "revelar" no fim da conversa,
 * mesmo antes de existir qualquer dado computado.
 */
export async function setInitialSelfReportedProfile(userId: string, selfReport: BehavioralProfile | null) {
  const finalProfile = selfReport ?? "EMERGING_ORGANIZER";
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

  if (existing) {
    // Não sobrescreve um perfil que já tenha virado CONSOLIDATED por algum
    // motivo (não deveria acontecer nesta fase do onboarding, mas a
    // checagem custa nada e evita uma regressão silenciosa).
    if (existing.behavioralProfileConfidence === "CONSOLIDATED") return;
    await db
      .update(profiles)
      .set({ behavioralProfile: finalProfile, behavioralProfileConfidence: "INITIAL", behavioralProfileUpdatedAt: new Date() })
      .where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({
      userId,
      behavioralProfile: finalProfile,
      behavioralProfileConfidence: "INITIAL",
      behavioralProfileUpdatedAt: new Date(),
    });
  }
}
