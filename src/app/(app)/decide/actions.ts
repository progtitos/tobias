"use server";

import { requireOnboardedUser } from "@/lib/auth/guards";
import { checkAffordability } from "@/services/affordability";
import type { AffordabilityResult } from "@/lib/ai/schemas";

export type AffordabilityState =
  | { result: AffordabilityResult; description: string; amount: number; error?: undefined }
  | { error: string; result?: undefined }
  | undefined;

export async function checkAffordabilityAction(_prev: AffordabilityState, formData: FormData): Promise<AffordabilityState> {
  const user = await requireOnboardedUser();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));

  if (!description) return { error: "Conte o que você quer comprar." };
  if (!(amount > 0)) return { error: "Informe um valor válido." };

  try {
    const result = await checkAffordability(user.id, description, amount);
    return { result, description, amount };
  } catch (err) {
    console.error("[decide] affordability check failed", err);
    return { error: "Não consegui analisar sua compra agora. Tente novamente em instantes." };
  }
}
