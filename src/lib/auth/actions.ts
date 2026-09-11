"use server";

import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, verificationTokens } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { createSubscriptionCheckout } from "@/services/subscription";
import { trackEvent } from "@/services/analytics";

export type AuthActionState = { error?: string; success?: string } | undefined;

// Guards against a malformed env var (e.g. accidentally including quote
// characters in the value) silently producing NaN, which would otherwise
// flow into `new Date(NaN)` below and crash signup with "Invalid time value".
function readTrialDays(): number {
  const parsed = Number(process.env.APP_TRIAL_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

const TRIAL_DAYS = readTrialDays();

export async function signupAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    cycle: formData.get("cycle"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { name, email, password, cycle } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { error: "Já existe uma conta com esse e-mail. Faça login." };
  }

  await trackEvent(null, "signup_started", { email });

  const passwordHash = await hashPassword(password);
  // Placeholder until Mercado Pago confirms the card — activateTrialFromPreapproval
  // overwrites both with the real start once the webhook fires. The account
  // sits in PENDING_PAYMENT until then, so nothing reads this early value as
  // if the trial were actually running.
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, trialEndsAt, subscriptionStatus: "PENDING_PAYMENT" })
    .returning({ id: users.id });

  await createSession(user.id);
  await trackEvent(user.id, "signup_completed", { email });

  // The 15 dias grátis only start once Mercado Pago confirms a card, so the
  // very next step is Mercado Pago's own hosted checkout, not onboarding —
  // if that fails to even create, don't leave a half-signed-up account
  // dangling on this email with no way back in.
  let initPoint: string;
  try {
    const checkout = await createSubscriptionCheckout(user.id, email, cycle);
    initPoint = checkout.initPoint;
  } catch (err) {
    console.error("[signup] falha ao criar checkout no Mercado Pago", err);
    await db.delete(users).where(eq(users.id, user.id));
    await destroySession();
    return { error: "Não foi possível iniciar o pagamento agora. Tente novamente em instantes." };
  }

  redirect(initPoint);
}

export async function loginAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { email, password } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.passwordHash || user.deletedAt) {
    return { error: "E-mail ou senha incorretos." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "E-mail ou senha incorretos." };
  }

  await createSession(user.id);
  await trackEvent(user.id, "login");

  redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
}

export async function logoutAction() {
  const { getCurrentUser } = await import("./session");
  const user = await getCurrentUser();
  if (user) await trackEvent(user.id, "logout");
  await destroySession();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { email } = parsed.data;

  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) {
    // Don't reveal whether the email exists.
    return { success: "Se esse e-mail estiver cadastrado, você verá o link de redefinição abaixo." };
  }

  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(verificationTokens).values({ identifier: email, token, expires });

  // NOTE: no email provider is wired up yet (see ARCHITECTURE.md) — rather
  // than pretend an email was sent, the reset link is returned directly so
  // the flow is genuinely usable end-to-end today. Swap this for a real
  // email send (Resend/SendGrid) without changing the token logic above.
  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  return { success: `link:${resetUrl}` };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { token, password } = parsed.data;

  const rows = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.token, token))
    .limit(1);
  const record = rows[0];
  if (!record || record.expires.getTime() < Date.now()) {
    return { error: "Esse link expirou. Solicite uma nova redefinição de senha." };
  }

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.email, record.identifier));
  await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

  redirect("/login");
}
