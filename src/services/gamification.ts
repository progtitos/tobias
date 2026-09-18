import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";
import { nowInBrazil } from "@/lib/utils/dates";
import type { AnalyticsEventName } from "./analytics";

/**
 * Eventos que contam como "dia ativo" pra sequência — só os que representam
 * a pessoa de fato organizando a vida financeira dela (lançar, revisar,
 * planejar, conversar com o Tobias). Deliberadamente de fora: eventos de
 * sistema/ciclo de conta (login, trial, assinatura, insight/alerta gerado
 * passivamente pela IA) — logar ou receber um insight não é a pessoa
 * fazendo nada, e contar isso inflaria a sequência sem sentido.
 */
const STREAK_EVENT_NAMES: AnalyticsEventName[] = [
  "onboarding_message",
  "expense_created",
  "receipt_uploaded",
  "receipt_confirmed",
  "goal_created",
  "goal_updated",
  "bank_account_created",
  "bank_account_updated",
  "credit_card_created",
  "statement_uploaded",
  "statement_import_confirmed",
  "investment_created",
  "investment_updated",
  "retirement_plan_created",
  "retirement_plan_simulated",
  "chat_message",
  "budget_created",
  "affordability_check",
];

function dayKeyInBrazil(date: Date): string {
  // "en-CA" é o jeito mais direto de pedir ao Intl um formato YYYY-MM-DD
  // pronto pra usar como chave, sem montar a string na mão a partir de
  // formatToParts (já usado em nowInBrazil() por precisar também de
  // hora/minuto ali; aqui só o dia calendário importa).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/**
 * Sequência de dias seguidos com pelo menos um evento "ativo" (ver
 * STREAK_EVENT_NAMES), contando pra trás a partir de hoje. Hoje sem nenhum
 * evento ainda NÃO quebra a sequência (o dia não acabou) — só ontem sem
 * evento quebra. Olha no máximo ~13 meses pra trás (janela generosa pra
 * quem usa o produto há muito tempo, sem varrer a tabela inteira).
 */
export async function computeStreakDays(userId: string): Promise<number> {
  const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ createdAt: analyticsEvents.createdAt })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.userId, userId),
        inArray(analyticsEvents.name, STREAK_EVENT_NAMES),
        gte(analyticsEvents.createdAt, since)
      )
    );

  if (rows.length === 0) return 0;

  const activeDays = new Set(rows.map((r) => dayKeyInBrazil(r.createdAt)));
  const cursor = nowInBrazil();

  if (!activeDays.has(dayKeyInBrazil(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activeDays.has(dayKeyInBrazil(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export type LevelTier = "BRONZE" | "PRATA" | "OURO" | "PLATINA";

export type LevelInfo = { tier: LevelTier; label: string };

/**
 * Nível deliberadamente amarrado à pontuação real do Ponteiro (saúde
 * financeira das 9 dimensões), não a um contador de XP/ações separado — o
 * "nível" precisa significar "sua vida financeira está indo bem", nunca só
 * "você mexeu bastante no app". Gamificação vazia (subir de nível só por
 * clicar) é o oposto do princípio 3 do design system (calma pela
 * confiança, não pelo brilho) — aqui ela existe, mas é honesta.
 */
export function levelForScore(score: number): LevelInfo {
  if (score >= 85) return { tier: "PLATINA", label: "Nível Platina" };
  if (score >= 65) return { tier: "OURO", label: "Nível Ouro" };
  if (score >= 40) return { tier: "PRATA", label: "Nível Prata" };
  return { tier: "BRONZE", label: "Nível Bronze" };
}
