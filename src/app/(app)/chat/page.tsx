import { requireOnboardedUser } from "@/lib/auth/guards";
import { getChatMessages } from "@/services/chat";
import { getLatestCompass, statusForScore } from "@/services/compass";
import { ChatPageClient } from "./ChatPageClient";

export default async function ChatPage() {
  const user = await requireOnboardedUser();
  const [messages, compass] = await Promise.all([getChatMessages(user.id), getLatestCompass(user.id)]);

  // Same "de olho no seu Ponteiro" framing as a Dashboard, in miniature, so
  // reabrir o chat não parece uma tela desconectada do resto do app. `null`
  // (ainda sem nenhum snapshot de Bússola) é um estado válido e diferente de
  // qualquer status computado — tratado à parte no client.
  const healthStatus =
    compass.length > 0
      ? statusForScore(Math.round(compass.reduce((sum, c) => sum + c.score, 0) / compass.length))
      : null;

  return (
    <ChatPageClient
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as "USER" | "ASSISTANT",
        content: m.content,
        actions: m.actions as { label: string; action: string }[] | null,
      }))}
      firstName={user.name.split(" ")[0]}
      healthStatus={healthStatus}
    />
  );
}
