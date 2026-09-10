"use server";

import { requireOnboardedUser } from "@/lib/auth/guards";
import { sendChatMessage } from "@/services/chat";

export async function sendChatMessageAction(text: string) {
  const user = await requireOnboardedUser();
  return sendChatMessage(user.id, text);
}
