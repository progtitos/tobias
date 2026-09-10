"use client";

import { useRouter } from "next/navigation";
import { ChatWindow, type ChatMessage } from "@/components/chat/ChatWindow";
import { sendChatMessageAction } from "./actions";

const ACTION_ROUTES: Record<string, string> = {
  simulate_retirement: "/retirement",
  view_expenses: "/expenses",
  adjust_budget: "/budget",
  view_goals: "/goals",
  view_compass: "/compass",
};

export function ChatPageClient({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-ink-300/20 bg-white/50">
        <h1 className="font-serif text-xl text-brand-950">Converse com o Tobias</h1>
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
