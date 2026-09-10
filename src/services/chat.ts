import "server-only";
import { eq, asc, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, conversationMessages } from "@/lib/db/schema";
import { AIService } from "@/lib/ai/AIService";
import { buildFinancialContextText } from "./financialContext";
import { trackEvent } from "./analytics";
import type { ChatTurn as GeminiChatTurn } from "@/lib/ai/generate";

const HISTORY_LIMIT = 30; // recent turns kept in the model's context window

export async function getOrCreateMainConversation(userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.type, "CHAT")))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (existing) return existing;

  const [conversation] = await db
    .insert(conversations)
    .values({ userId, type: "CHAT", title: "Conversa com o Tobias" })
    .returning();

  await db.insert(conversationMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: "Oi! Sobre o que você quer conversar hoje: seus gastos, um objetivo, ou alguma dúvida?",
  });

  return conversation;
}

export async function getChatMessages(userId: string) {
  const conversation = await getOrCreateMainConversation(userId);
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversation.id))
    .orderBy(asc(conversationMessages.createdAt));
}

export async function sendChatMessage(userId: string, userMessage: string) {
  const conversation = await getOrCreateMainConversation(userId);
  const priorMessages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversation.id))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(HISTORY_LIMIT);

  const history: GeminiChatTurn[] = priorMessages
    .reverse()
    .map((m) => ({ role: m.role === "ASSISTANT" ? ("model" as const) : ("user" as const), text: m.content }));

  await db.insert(conversationMessages).values({ conversationId: conversation.id, role: "USER", content: userMessage });

  const context = await buildFinancialContextText(userId);
  const turn = await AIService.chatTurn(context, history, userMessage);

  await db.insert(conversationMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: turn.reply,
    actions: turn.actions ?? null,
  });

  await trackEvent(userId, "chat_message");

  return { reply: turn.reply, actions: turn.actions };
}
