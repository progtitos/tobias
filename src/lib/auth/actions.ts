"use server";

import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, verificationTokens } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { createSubscriptionCheckout } from "@/services/subscription";
import { trackEvent } from "@/services/analytics";
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/security/rateLimit";

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

  // Segurança (25/09/2026): cadastro cria linha no banco E chama a API do
  // Mercado Pago a cada POST — sem limite nenhum antes, um script conseguia
  // criar contas em massa e martelar uma API paga de terceiro.
  const ip = await getClientIp();
  if (
    (await isRateLimited("rl_signup", `ip:${ip}`, { max: 8, windowMs: 60 * 60 * 1000 })) ||
    (await isRateLimited("rl_signup", `email:${email}`, { max: 3, windowMs: 60 * 60 * 1000 }))
  ) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  // isNull(deletedAt) é essencial aqui: o admin só faz soft delete (a linha
  // continua no banco pra não quebrar FK de contas/transações já existentes
  // — ver softDeleteUserForAdmin em services/admin.ts), então sem esse
  // filtro um e-mail removido no admin ficava bloqueado pra sempre no
  // cadastro ("já existe uma conta com esse e-mail"), mesmo a conta antiga
  // não existindo mais pra ninguém. O índice único de users.email também
  // virou parcial (WHERE deleted_at IS NULL, ver schema.ts) pelo mesmo
  // motivo — sem isso o INSERT logo abaixo ainda quebraria.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
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

  // Segurança (25/09/2026): sem isso, login era vulnerável a credential
  // stuffing (testar senhas vazadas de outros vazamentos em massa) sem
  // nenhum bloqueio. Checa ANTES de tocar no banco de usuário.
  const ip = await getClientIp();
  if (
    (await isRateLimited("rl_login", `ip:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 })) ||
    (await isRateLimited("rl_login", `email:${email}`, { max: 8, windowMs: 15 * 60 * 1000 }))
  ) {
    return { error: RATE_LIMIT_MESSAGE };
  }

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

  // Segurança (25/09/2026): este é o formulário mais sensível dos três —
  // é ele que, sem limite, permitia varrer/probar e-mails cadastrados em
  // massa (ver o comentário abaixo sobre o vazamento do link, já corrigido).
  const ip = await getClientIp();
  if (
    (await isRateLimited("rl_forgot_password", `ip:${ip}`, { max: 6, windowMs: 60 * 60 * 1000 })) ||
    (await isRateLimited("rl_forgot_password", `email:${email}`, { max: 3, windowMs: 60 * 60 * 1000 }))
  ) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const GENERIC_SUCCESS =
    "Se esse e-mail estiver cadastrado, um link de redefinição foi gerado. Envio automático por e-mail ainda não está configurado nesta versão — fale com o suporte para receber o link.";

  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) {
    // Don't reveal whether the email exists — same message as the found-email path below.
    return { success: GENERIC_SUCCESS };
  }

  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(verificationTokens).values({ identifier: email, token, expires });

  // SEGURANÇA (corrigido 25/09/2026): esta função só devia devolver o link
  // de reset pra quem realmente é dono daquele e-mail — mas como nenhum
  // provedor de e-mail está configurado ainda (ver ARCHITECTURE.md), uma
  // versão anterior devolvia o link/token direto na resposta pra QUALQUER
  // um que preenchesse esse formulário com qualquer e-mail cadastrado,
  // sem nenhuma prova de posse da caixa de entrada. Isso é um sequestro de
  // conta trivial de scriptar (chuta e-mails conhecidos, pega o link,
  // troca a senha). Corrigido: o link nunca mais sai daqui. Fica só no log
  // do servidor (Vercel → Logs) até um provedor de e-mail de verdade
  // (Resend/SendGrid) ser configurado — a partir daí, troque este
  // console.log por um envio de e-mail de verdade, sem mudar a lógica do
  // token acima.
  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  console.log(`[reset-password] link gerado para ${email} (não enviado por e-mail ainda): ${resetUrl}`);
  return { success: GENERIC_SUCCESS };
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
