"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createSubscriptionCheckout } from "@/services/subscription";

export type RetryPaymentState = { error?: string } | undefined;

/**
 * The person bounced off Mercado Pago's hosted checkout without finishing
 * (closed the tab, payment declined, etc.) — their account still exists,
 * still PENDING_PAYMENT, just without a completed preapproval. This starts
 * a fresh one rather than trying to resurrect the abandoned attempt.
 */
export async function retryPaymentCheckoutAction(): Promise<RetryPaymentState> {
  const user = await requireUser();
  if (user.subscriptionStatus !== "PENDING_PAYMENT") {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  try {
    const { initPoint } = await createSubscriptionCheckout(user.id, user.email, user.planBillingCycle ?? "MENSAL");
    redirect(initPoint);
  } catch (err) {
    console.error("[pagamento-pendente] falha ao gerar novo checkout", err);
    return { error: "Não foi possível gerar um novo link de pagamento agora. Tente novamente em instantes." };
  }
}
