"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { BoardData } from "@/lib/kanban";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatSidebarProps = {
  board: BoardData | null;
  onBoardUpdated: () => void;
};

const boardToApiFormat = (board: BoardData) => {
  const columns = board.columns.map((col, colIdx) => ({
    id: col.id,
    title: col.title,
    position: colIdx,
    cards: col.cardIds.map((cardId, cardIdx) => ({
      id: cardId,
      title: board.cards[cardId]?.title ?? "",
      details: board.cards[cardId]?.details ?? "",
      position: cardIdx,
    })),
  }));
  return { columns };
};

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  board,
  onBoardUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const boardState = board ? boardToApiFormat(board) : null;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, board: boardState }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.board_updated) {
        onBoardUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, board, isLoading, onBoardUpdated]);

  return (
    <aside className="flex min-h-[520px] flex-col rounded-2xl border border-[var(--navy-dark)]/20 bg-[var(--navy-dark)] p-4 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-yellow)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--navy-dark)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm1-2c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2s-2 .9-2 2v4c0 1.1.9 2 2 2z"/>
          </svg>
        </div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          AI Assistant
        </h2>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <p className="mb-2 text-sm text-white/60">
            Ask me to create, move, or edit cards.
          </p>
          <p className="text-xs text-white/40">
            Try: &quot;Create a card called Setup CI in To Do&quot;
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--primary-blue)] text-white"
                  : "bg-white/10 text-white/90 backdrop-blur"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/40 backdrop-blur">
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-300 border border-red-500/30">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI..."
            className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[var(--accent-yellow)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-yellow)]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-[var(--accent-yellow)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] disabled:opacity-50 hover:bg-[var(--accent-yellow)]/90"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
};
