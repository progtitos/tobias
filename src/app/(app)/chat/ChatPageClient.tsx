"use client";

import { useRouter } from "next/navigation";
import { ChatWindow, type ChatMessage } from "@/components/chat/ChatWindow";
import { sendChatMessageAction } from "./actions";

const ACTION_ROUTES: Record<string, string> = {
  simulate_retirement: "/retirement",
  view_expenses: "/lancamentos",
  adjust_budget: "/lancamentos",
  view_goals: "/goals",
  view_compass: "/compass",
};

export function ChatPageClient({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-brand-950">
      <div className="px-5 py-4 border-b border-white/10">
        <h1 className="font-sans font-bold text-xl text-onbrand">Converse com o Tobias</h1>
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
