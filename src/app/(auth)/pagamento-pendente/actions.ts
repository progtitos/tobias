"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createSubscriptionCheckout, reconcilePreapprovalStatus } from "@/services/subscription";

export type RetryPaymentState = { error?: string } | undefined;
export type CheckPaymentState = { error?: string; stillPending?: boolean } | undefined;

/**
 * The person bounced off Mercado Pago's hosted checkout without finishing
 * (closed the tab, payment declined, etc.) — their account still exists,
 * still PENDING_PAYMENT, just without a completed preapproval. This starts
 * a fresh one rather than trying to resurrect the abandoned attempt.
 *
 * `redirect()` is called outside the try/catch on purpose — it works by
 * throwing a special NEXT_REDIRECT error, so calling it *inside* a try block
 * (as this function used to) means a successful checkout creation gets
 * immediately swallowed by the catch below and reported as a failure,
 * even though Mercado Pago's link was created just fine.
 */
export async function retryPaymentCheckoutAction(): Promise<RetryPaymentState> {
  const user = await requireUser();
  if (user.subscriptionStatus !== "PENDING_PAYMENT") {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  let initPoint: string;
  try {
    ({ initPoint } = await createSubscriptionCheckout(user.id, user.email, user.planBillingCycle ?? "MENSAL"));
  } catch (err) {
    console.error("[pagamento-pendente] falha ao gerar novo checkout", err);
    return { error: "Não foi possível gerar um novo link de pagamento agora. Tente novamente em instantes." };
  }
  redirect(initPoint);
}

/**
 * "Já confirmei, atualizar" — antes só fazia um router.refresh() no client
 * (relê o que já está no nosso banco). Isso não ajuda em nada se o webhook do
 * Mercado Pago nunca chegou: a pessoa fica presa numa tela que nunca some.
 * Agora consulta o Mercado Pago de verdade (reconcilePreapprovalStatus) antes
 * de decidir se ainda está pendente.
 */
export async function checkPaymentStatusAction(): Promise<CheckPaymentState> {
  const user = await requireUser();
  if (user.subscriptionStatus !== "PENDING_PAYMENT") {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  let stillPending: boolean;
  try {
    const result = await reconcilePreapprovalStatus(user.id);
    stillPending = !result || result.status === "PENDING_PAYMENT";
  } catch (err) {
    console.error("[pagamento-pendente] falha ao consultar status no Mercado Pago", err);
    return { error: "Não foi possível consultar o status agora. Tente novamente em instantes." };
  }

  if (!stillPending) {
    redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }
  return { stillPending: true };
}
