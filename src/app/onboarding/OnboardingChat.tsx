"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChatWindow, type ChatMessage } from "@/components/chat/ChatWindow";
import { sendOnboardingMessageAction } from "./actions";

export function OnboardingChat({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const router = useRouter();

  return (
    <ChatWindow
      initialMessages={initialMessages}
      placeholder="Conte um pouco sobre você..."
      onSend={async (text) => {
        const result = await sendOnboardingMessageAction(text);
        if (result.completed) {
          toast.success("Seu primeiro plano está pronto!");
          setTimeout(() => router.push("/dashboard"), 1200);
        }
        return result;
      }}
    />
  );
}
