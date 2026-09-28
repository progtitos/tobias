"use client";

import { useRouter } from "next/navigation";
import { ChatWindow, type ChatMessage } from "@/components/chat/ChatWindow";
import type { CompassDimensionResult } from "@/services/compass";
import { sendChatMessageAction } from "./actions";

const ACTION_ROUTES: Record<string, string> = {
  simulate_retirement: "/retirement",
  view_expenses: "/lancamentos",
  adjust_budget: "/lancamentos",
  view_goals: "/patrimonio#sonhos",
  view_compass: "/compass",
};

// Mesmo mapa de tom que o CompassDial já usa para os 4 status da Bússola —
// duplicado aqui (só 4 linhas) em vez de importado, pra não criar uma
// dependência cruzada entre um componente de dashboard e o chat por causa
// de uma faixa de humor pequena.
const STATUS_TONE: Record<CompassDimensionResult["status"], string> = {
  Excelente: "text-ok-400",
  Saudável: "text-ok-400",
  "Em construção": "text-gold-400",
  Atenção: "text-danger-300",
};

function moodMessage(firstName: string, status: CompassDimensionResult["status"] | null) {
  if (status === "Excelente" || status === "Saudável") return `Seu Ponteiro está indo bem, ${firstName}.`;
  if (status === "Em construção") return `Seu Ponteiro está em construção, vamos evoluir juntos.`;
  if (status === "Atenção") return `Seu Ponteiro pede atenção, vamos ajustar juntos.`;
  return `Ainda estou te conhecendo, ${firstName}.`;
}

export function ChatPageClient({
  initialMessages,
  firstName,
  healthStatus,
}: {
  initialMessages: ChatMessage[];
  firstName: string;
  healthStatus: CompassDimensionResult["status"] | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-brand-950">
      {/* Cabeçalho centralizado na mesma coluna (max-w-2xl) das mensagens e do
          composer logo abaixo (28/09/2026, pedido do Thiago) — antes ficava
          grudado à esquerda, encostado na sidebar, enquanto o resto da
          conversa já era centralizado, o que deixava a tela toda desalinhada
          em telas largas. */}
      <div className="px-5 py-3.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.35)]" data-tour="chat-tobias">
        <div className="flex items-center gap-3 max-w-2xl w-full mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/avatars/tobias-sempre-ao-lado.png"
            alt="Tobias"
            className="tobias-mascot-soft h-9 w-9 object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${healthStatus ? STATUS_TONE[healthStatus] : "text-onbrand/45"}`}>
              {healthStatus ?? "Conhecendo você"}
            </p>
            <p className="text-sm text-onbrand truncate">{moodMessage(firstName, healthStatus)}</p>
          </div>
        </div>
      </div>
      <ChatWindow
        initialMessages={initialMessages}
        onSend={sendChatMessageAction}
        onAction={(action) => {
          const route = ACTION_ROUTES[action];
          if (route) router.push(route);
        }}
      />
    </div>
  );
}
