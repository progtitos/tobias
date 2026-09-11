import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getPreApprovalClient, getMercadoPagoAccessToken } from "@/lib/mercadopago/client";
import { PRICING_PLANS, type BillingCycle } from "@/lib/billing/plans";
import { trackEvent, logFinancialEvent } from "./analytics";
import type {
  AutoRecurringWithFreeTrial,
  PreApprovalRequest,
} from "mercadopago/dist/clients/preApproval/commonTypes";

function readTrialDays(): number {
  const parsed = Number(process.env.APP_TRIAL_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/**
 * Starts a Mercado Pago subscription (assinatura) for a freshly created
 * user: creates a "preapproval" with the trial baked into
 * auto_recurring.free_trial, so Mercado Pago's own hosted checkout collects
 * the card and its recurring-billing engine both holds off on charging
 * during the trial AND fires the first real charge automatically once it
 * ends — Tobias doesn't need to run its own billing clock. The trial only
 * "starts" on our side once the webhook confirms the card was authorized
 * (see activateTrialFromPreapproval) — until then the user sits in
 * PENDING_PAYMENT and requireUser()-gated pages bounce them to
 * /pagamento-pendente.
 */
export async function createSubscriptionCheckout(
  userId: string,
  email: string,
  cycle: BillingCycle
): Promise<{ preapprovalId: string; initPoint: string }> {
  const plan = PRICING_PLANS.find((p) => p.cycle === cycle);
  if (!plan) throw new Error(`Ciclo de cobrança inválido: ${cycle}`);

  const autoRecurring: AutoRecurringWithFreeTrial = {
    frequency: plan.months,
    frequency_type: "months",
    transaction_amount: plan.price,
    currency_id: "BRL",
    free_trial: {
      frequency: readTrialDays(),
      frequency_type: "days",
    },
  };

  const body: PreApprovalRequest = {
    reason: `Tobias (${plan.label})`,
    external_reference: userId,
    payer_email: email,
    back_url: `${appUrl()}/onboarding`,
    auto_recurring: autoRecurring,
    status: "pending",
  };

  const preapproval = await getPreApprovalClient().create({ body });
  if (!preapproval.id || !preapproval.init_point) {
    throw new Error("Mercado Pago não retornou um link de checkout.");
  }

  await db
    .update(users)
    .set({ mpPreapprovalId: preapproval.id, planBillingCycle: cycle, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await trackEvent(userId, "subscription_started", { cycle, preapprovalId: preapproval.id });
  await logFinancialEvent(userId, "mp_preapproval_created", { preapprovalId: preapproval.id, cycle });

  return { preapprovalId: preapproval.id, initPoint: preapproval.init_point };
}

/**
 * Called once the webhook confirms Mercado Pago moved the preapproval to
 * "authorized" (the card was accepted on the hosted checkout). This is the
 * moment the 15 free days actually start — matching "pagamento obrigatório
 * para iniciar os 15 grátis" instead of starting the clock at signup like
 * before.
 */
export async function activateTrialFromPreapproval(preapprovalId: string) {
  const [user] = await db.select().from(users).where(eq(users.mpPreapprovalId, preapprovalId)).limit(1);
  if (!user) return null;
  if (user.subscriptionStatus !== "PENDING_PAYMENT") return user; // already activated, webhook retry — no-op

  const trialDays = readTrialDays();
  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({ subscriptionStatus: "TRIALING", trialStartedAt, trialEndsAt, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await trackEvent(user.id, "trial_started", { days: trialDays, preapprovalId });
  await logFinancialEvent(user.id, "mp_subscription_authorized", { preapprovalId });
  return { ...user, subscriptionStatus: "TRIALING" as const, trialStartedAt, trialEndsAt };
}

export async function markSubscriptionActive(preapprovalId: string) {
  const [user] = await db.select().from(users).where(eq(users.mpPreapprovalId, preapprovalId)).limit(1);
  if (!user) return;
  await db
    .update(users)
    .set({ subscriptionStatus: "ACTIVE", subscriptionPlan: "TOBIAS", updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await logFinancialEvent(user.id, "mp_subscription_charged", { preapprovalId });
}

export async function markSubscriptionPastDue(preapprovalId: string) {
  const [user] = await db.select().from(users).where(eq(users.mpPreapprovalId, preapprovalId)).limit(1);
  if (!user) return;
  await db.update(users).set({ subscriptionStatus: "PAST_DUE", updatedAt: new Date() }).where(eq(users.id, user.id));
  await logFinancialEvent(user.id, "mp_subscription_payment_failed", { preapprovalId });
}

export async function markSubscriptionCanceled(preapprovalId: string) {
  const [user] = await db.select().from(users).where(eq(users.mpPreapprovalId, preapprovalId)).limit(1);
  if (!user) return;
  await db.update(users).set({ subscriptionStatus: "CANCELED", updatedAt: new Date() }).where(eq(users.id, user.id));
  await logFinancialEvent(user.id, "mp_subscription_canceled", { preapprovalId });
}

/** Cancels straight from Tobias's own Settings screen — no need to send the person back to Mercado Pago. */
export async function cancelSubscription(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.mpPreapprovalId) throw new Error("Nenhuma assinatura ativa encontrada.");

  await getPreApprovalClient().update({ id: user.mpPreapprovalId, body: { status: "cancelled" } });
  await db
    .update(users)
    .set({ subscriptionStatus: "CANCELED", updatedAt: new Date() })
    .where(eq(users.id, userId));
  await trackEvent(userId, "subscription_canceled", { preapprovalId: user.mpPreapprovalId });
  await logFinancialEvent(userId, "mp_subscription_canceled_by_user", { preapprovalId: user.mpPreapprovalId });
}

/**
 * Raw REST call for the one resource the current SDK version doesn't wrap:
 * an individual recurring charge attempt on a subscription
 * (subscription_authorized_payment webhook topic). Kept minimal — just the
 * status field the webhook needs to decide ACTIVE vs PAST_DUE.
 */
export async function fetchAuthorizedPaymentStatus(authorizedPaymentId: string): Promise<{
  status: string | null;
  preapprovalId: string | null;
}> {
  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${getMercadoPagoAccessToken()}` },
  });
  if (!res.ok) {
    console.error("[mercadopago] failed to fetch authorized payment", authorizedPaymentId, res.status);
    return { status: null, preapprovalId: null };
  }
  const data = (await res.json()) as { status?: string; preapproval_id?: string };
  return { status: data.status ?? null, preapprovalId: data.preapproval_id ?? null };
}
