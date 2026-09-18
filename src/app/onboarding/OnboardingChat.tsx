"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatWindow, type ChatMessage } from "@/components/chat/ChatWindow";
import { ProfileRevealOverlay, type RevealData } from "@/components/onboarding/ProfileRevealOverlay";
import { sendOnboardingMessageAction } from "./actions";

export function OnboardingChat({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const router = useRouter();
  const [reveal, setReveal] = useState<RevealData | null>(null);

  return (
    <>
      <ChatWindow<RevealData>
        initialMessages={initialMessages}
        placeholder="Conte um pouco sobre você..."
        hero={{
          avatarSrc: "/avatars/tobias-boas-vindas.png",
          title: "Vamos montar seu plano juntos",
          subtitle: "Leva uns 5 a 10 minutos, no seu tempo.",
        }}
        quickReplies={["Quero economizar mais", "Já tenho dívidas", "Penso em aposentadoria", "Tenho um sonho"]}
        onSend={sendOnboardingMessageAction}
        onReveal={setReveal}
      />
      {/* A celebração ("Perfil Desbloqueado" + curva de aposentadoria) substitui
         o antigo toast + redirect imediato — ela só manda pro Dashboard quando
         a pessoa termina de ver as duas revelações, não assim que a conversa
         acaba. */}
      {reveal && <ProfileRevealOverlay reveal={reveal} onDone={() => router.push("/dashboard")} />}
    </>
  );
}
