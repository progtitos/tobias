import { requireOnboardedUser } from "@/lib/auth/guards";
import { startNewConversation } from "@/services/chat";
import { getLatestCompass, statusForScore } from "@/services/compass";
import { ChatPageClient } from "./ChatPageClient";

export default async function ChatPage() {
  const user = await requireOnboardedUser();
  const firstName = user.name.split(" ")[0];
  // Cada visita a esta tela começa uma conversa nova (pedido do Thiago): o
  // histórico de conversas anteriores continua salvo no banco, só não
  // aparece mais aqui — ver o comentário em services/chat.ts.
  const [greeting, compass] = await Promise.all([
    startNewConversation(user.id, firstName),
    getLatestCompass(user.id),
  ]);

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
      // Sem mensagens já prontas: a saudação (`openingGreeting`) só aparece
      // na tela depois de uma breve animação de "Tobias está digitando",
      // em vez de já surgir pronta — ver ChatWindow.
      initialMessages={[]}
      openingGreeting={greeting}
      firstName={firstName}
      healthStatus={healthStatus}
    />
  );
}
