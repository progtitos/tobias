import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

// ----------------------------------------------------------------------------
// Custom DB-backed session auth.
// ----------------------------------------------------------------------------
// Why not NextAuth/Auth.js: at the time this was built, this project pinned
// to Next.js 16 + React 19.2 while next-auth's v5 was still in beta — rather
// than take on that compatibility risk for an MVP, auth is a small,
// fully-owned module: an opaque random token in an httpOnly cookie, mapped to
// a row in `sessions`. DB-backed (rather than a stateless JWT) means a
// session can be revoked instantly — required for the "delete my account"
// and "log out everywhere" flows the product needs.
//
// The `auth_accounts` / `verification_tokens` tables already exist in the
// schema so adding real OAuth (Google/Apple) or email verification later is
// additive, not a migration.
// ----------------------------------------------------------------------------

const COOKIE_NAME = "tobias_session";
// Cookie separado (nome + path próprios) pra sessão do painel admin — pedido
// do Thiago 2026-09-19 pra separar o admin do resto do sistema de verdade,
// não só na UI: logar como cliente em `/login` nunca concede `/admin`, e
// vice-versa, mesmo que a mesma conta tenha `role: "ADMIN"`. Reaproveita a
// tabela `sessions` (é só um token opaco), só não compartilha o cookie.
const ADMIN_COOKIE_NAME = "tobias_admin_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "USER" | "PLANNER" | "ADMIN";
  onboardingCompleted: boolean;
  tourCompleted: boolean;
  trialEndsAt: Date;
  subscriptionPlan: string;
  subscriptionStatus: string;
  planBillingCycle: "MENSAL" | "SEMESTRAL" | "ANUAL" | null;
};

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function createSessionWithCookie(userId: string, cookieName: string, cookiePath: string, userAgent?: string) {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires,
    userAgent: userAgent ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: cookiePath,
  });
}

async function readSessionFromCookie(cookieName: string): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      onboardingCompleted: users.onboardingCompleted,
      tourCompleted: users.tourCompleted,
      trialEndsAt: users.trialEndsAt,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
      planBillingCycle: users.planBillingCycle,
      deletedAt: users.deletedAt,
      expires: sessions.expires,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.sessionToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.deletedAt) return null;
  if (row.expires.getTime() < Date.now()) {
    const cookieStore2 = await cookies();
    const expiredToken = cookieStore2.get(cookieName)?.value;
    if (expiredToken) await db.delete(sessions).where(eq(sessions.sessionToken, expiredToken));
    cookieStore2.delete(cookieName);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    onboardingCompleted: row.onboardingCompleted,
    tourCompleted: row.tourCompleted,
    trialEndsAt: row.trialEndsAt,
    subscriptionPlan: row.subscriptionPlan,
    subscriptionStatus: row.subscriptionStatus,
    planBillingCycle: row.planBillingCycle,
  };
}

async function destroySessionCookie(cookieName: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
  }
  cookieStore.delete(cookieName);
}

export async function createSession(userId: string, userAgent?: string) {
  return createSessionWithCookie(userId, COOKIE_NAME, "/", userAgent);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return readSessionFromCookie(COOKIE_NAME);
}

export async function destroySession() {
  return destroySessionCookie(COOKIE_NAME);
}

/**
 * Sessão do painel admin — cookie e path próprios (`/admin`), nunca
 * compartilhados com `tobias_session`. Só quem passou por `/admin/login` (e
 * cuja conta já era `role: "ADMIN"` no momento do login) tem esse cookie;
 * estar logado no app comum, mesmo como admin, não concede acesso aqui.
 */
export async function createAdminSession(userId: string, userAgent?: string) {
  return createSessionWithCookie(userId, ADMIN_COOKIE_NAME, "/admin", userAgent);
}

export async function getCurrentAdmin(): Promise<SessionUser | null> {
  const user = await readSessionFromCookie(ADMIN_COOKIE_NAME);
  // Revalida a role a cada request: se alguém perder o cargo de ADMIN depois
  // de já ter uma sessão admin aberta, a sessão para de valer no ato, sem
  // esperar o cookie expirar.
  if (user && user.role !== "ADMIN") return null;
  return user;
}

export async function destroyAdminSession() {
  return destroySessionCookie(ADMIN_COOKIE_NAME);
}
