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
      hero={{
        avatarSrc: "/avatars/tobias-boas-vindas.png",
        title: "Vamos montar seu plano juntos",
        subtitle: "Leva uns 5 a 10 minutos, no seu tempo.",
      }}
      quickReplies={["Quero economizar mais", "Já tenho dívidas", "Penso em aposentadoria", "Tenho um sonho"]}
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
