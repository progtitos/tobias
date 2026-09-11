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
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "USER" | "PLANNER" | "ADMIN";
  onboardingCompleted: boolean;
  trialEndsAt: Date;
  subscriptionPlan: string;
  subscriptionStatus: string;
  planBillingCycle: "MENSAL" | "SEMESTRAL" | "ANUAL" | null;
};

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, userAgent?: string) {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires,
    userAgent: userAgent ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      onboardingCompleted: users.onboardingCompleted,
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
    await destroySession();
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    onboardingCompleted: row.onboardingCompleted,
    trialEndsAt: row.trialEndsAt,
    subscriptionPlan: row.subscriptionPlan,
    subscriptionStatus: row.subscriptionStatus,
    planBillingCycle: row.planBillingCycle,
  };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
  }
  cookieStore.delete(COOKIE_NAME);
}
