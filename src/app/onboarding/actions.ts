"use server";

import { requireUser } from "@/lib/auth/guards";
import { submitOnboardingMessage } from "@/services/onboarding";
import { refreshRetirementPlanNetWorth, buildRetirementInputs } from "@/services/retirementPlan";
import { simulateRetirementCurve } from "@/services/retirement";
import { saveCompassSnapshot } from "@/services/compass";

export async function sendOnboardingMessageAction(text: string) {
  const user = await requireUser();
  const result = await submitOnboardingMessage(user.id, text);
  return { reply: result.reply, completed: result.completed, reveal: result.reveal };
}

/**
 * Chamada quando a pessoa termina o passo "Vamos conectar suas contas" (ver
 * ConnectAccountsStep/ProfileRevealOverlay). `finalizeOnboarding`
 * (services/onboarding.ts) monta o plano de aposentadoria ANTES desse passo
 * existir, então `currentNetWorth` nasce com o que ela só contou por texto —
 * essa ação recalcula a partir da conta de verdade que acabou de cadastrar,
 * antes de mostrar a curva final. Também recalcula a Bússola, porque a
 * dimensão "Aposentadoria" dela lê o mesmo `currentNetWorth` persistido e
 * senão o tour obrigatório (que termina em /compass) mostraria o mesmo dado
 * desatualizado (Thiago, 25/09/2026).
 */
export async function refreshOnboardingRetirementPreviewAction() {
  const user = await requireUser();
  const plan = await refreshRetirementPlanNetWorth(user.id);
  if (!plan) return { retirementPreview: null, retirementTargetAge: null };

  await saveCompassSnapshot(user.id);

  const retirementPreview = simulateRetirementCurve(buildRetirementInputs(plan, plan.currentNetWorth));
  return { retirementPreview, retirementTargetAge: plan.targetRetirementAge };
}
