"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  actions?: { label: string; action: string }[] | null;
};

function TobiasAvatar() {
  return (
    // Plain <img>, not next/image: this renders inside a scrolling message
    // list where a fixed small size and zero layout-shift risk matter more
    // than next/image's optimization pipeline.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-transparent.png"
      alt=""
      className="h-7 w-7 shrink-0 rounded-full bg-brand-950 p-1 object-contain"
    />
  );
}

export function ChatWindow({
  initialMessages,
  onSend,
  onAction,
  placeholder = "Escreva para o Tobias...",
  className,
}: {
  initialMessages: ChatMessage[];
  onSend: (text: string) => Promise<{ reply: string; actions?: { label: string; action: string }[]; completed?: boolean }>;
  onAction?: (action: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    const userMsg: ChatMessage = { id: `local-${Date.now()}`, role: "USER", content: text };
    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      try {
        const result = await onSend(text);
        setMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}-a`, role: "ASSISTANT", content: result.reply, actions: result.actions },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-err`,
            role: "ASSISTANT",
            content:
              "Não consegui pensar nessa agora. O provedor de IA não respondeu. Pode tentar de novo em instantes?",
          },
        ]);
      }
    });
  }

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl w-full mx-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex items-end gap-2", m.role === "USER" ? "justify-end" : "justify-start")}
          >
            {m.role === "ASSISTANT" && <TobiasAvatar />}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap",
                m.role === "USER" ? "bg-brand-900 text-cream-50 rounded-br-sm" : "bg-white border border-ink-300/25 text-ink-900 rounded-bl-sm"
              )}
            >
              {m.content}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <button
                      key={a.action}
                      onClick={() => onAction?.(a.action)}
                      className="text-xs font-medium rounded-full border border-gold-500 text-gold-700 px-3 py-1 hover:bg-gold-100 transition-colors"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-end gap-2 justify-start">
            <TobiasAvatar />
            <div className="rounded-2xl rounded-bl-sm bg-white border border-ink-300/25 px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-ink-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-300/20 bg-white/70 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none max-h-32 rounded-xl border border-ink-300/50 bg-cream-50 px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-700/30 focus:border-brand-700"
          />
          <Button onClick={handleSend} disabled={!input.trim()} loading={pending} size="md" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
