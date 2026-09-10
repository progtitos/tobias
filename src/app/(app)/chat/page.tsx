import { requireOnboardedUser } from "@/lib/auth/guards";
import { getChatMessages } from "@/services/chat";
import { ChatPageClient } from "./ChatPageClient";

export default async function ChatPage() {
  const user = await requireOnboardedUser();
  const messages = await getChatMessages(user.id);

  return (
    <ChatPageClient
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as "USER" | "ASSISTANT",
        content: m.content,
        actions: m.actions as { label: string; action: string }[] | null,
      }))}
    />
  );
}
