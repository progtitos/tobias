"use server";

import { requireUser } from "@/lib/auth/guards";
import { submitOnboardingMessage } from "@/services/onboarding";

export async function sendOnboardingMessageAction(text: string) {
  const user = await requireUser();
  const result = await submitOnboardingMessage(user.id, text);
  return { reply: result.reply, completed: result.completed };
}
