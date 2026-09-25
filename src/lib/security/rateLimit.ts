import "server-only";
import { headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";

/**
 * Best-effort client IP for rate limiting. Vercel sets x-forwarded-for on
 * every request; this is NOT a strong identity signal (proxies, shared
 * IPs, spoofable outside Vercel's own edge), so it's always combined with a
 * second, content-based key (e-mail digitado) in the callers below — never
 * used alone as the only gate.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Lightweight rate limiter (adicionado 25/09/2026, auditoria de segurança
 * pedida pelo Thiago — signup/login/forgot-password não tinham NENHUMA
 * proteção contra automação em massa). Reaproveita a tabela `analytics_events`
 * que já existe (em vez de criar uma tabela nova só pra isso): cada
 * chamada conta quantos eventos `eventName` com `properties.key === key`
 * já aconteceram na janela de tempo, e grava a tentativa atual.
 *
 * Retorna `true` quando o limite foi estourado (a chamada deve ser
 * bloqueada). Falha aberta (nunca bloqueia por erro de banco) — um erro
 * aqui não pode derrubar cadastro/login pra todo mundo.
 */
export async function isRateLimited(
  eventName: string,
  key: string,
  opts: { max: number; windowMs: number }
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - opts.windowMs);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.name, eventName),
          sql`${analyticsEvents.properties} ->> 'key' = ${key}`,
          gte(analyticsEvents.createdAt, since)
        )
      );
    await db.insert(analyticsEvents).values({ name: eventName, properties: { key } });
    return (row?.count ?? 0) >= opts.max;
  } catch (err) {
    console.error(`[rateLimit] falha ao checar limite de "${eventName}"`, err);
    return false;
  }
}

/** Mensagem genérica — nunca revela qual dos dois limites (IP ou e-mail) bateu. */
export const RATE_LIMIT_MESSAGE = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
