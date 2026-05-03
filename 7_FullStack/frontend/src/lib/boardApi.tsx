"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

import type { BoardData } from "@/lib/kanban";

export type BoardState = {
  board: BoardData | null;
  isLoading: boolean;
  error: string | null;
  authToken: string | null;
  saveBoard: (board: BoardData) => void;
  refreshBoard: () => Promise<void>;
};

const BoardContext = createContext<BoardState | undefined>(undefined);

export const useBoard = () => {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error("useBoard must be used within a BoardProvider");
  }
  return context;
};

const DEBOUNCE_MS = 800;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const fetchWithRetry = async (url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> => {
  try {
    const res = await fetch(url, options);
    if (!res.ok && retries > 0 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
};

export const BoardProvider: React.FC<{
  children: ReactNode;
  authToken: string | null;
  isAuthenticated: boolean;
}> = ({ children, authToken, isAuthenticated }) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!authToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/board", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch board: ${res.status}`);
      const data = await res.json();
      const cards: Record<string, { id: string; title: string; details: string }> = {};
      const columns = data.columns.map((col: { id: string; title: string; cards: Array<{ id: string; title: string; details: string }> }) => {
        for (const card of col.cards) {
          cards[card.id] = { id: card.id, title: card.title, details: card.details };
        }
        return {
          id: col.id,
          title: col.title,
          cardIds: col.cards.map((c: { id: string }) => c.id),
        };
      });
      setBoard({ columns, cards });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (isAuthenticated && authToken && !board) {
      fetchBoard();
    }
  }, [isAuthenticated, authToken, board, fetchBoard]);

  const scheduleSave = useCallback(
    (data: BoardData) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        if (!authToken) return;
        const apiColumns = data.columns.map((col) => ({
          id: col.id,
          title: col.title,
          position: data.columns.indexOf(col),
          cards: col.cardIds.map((cardId, idx) => ({
            id: cardId,
            title: data.cards[cardId]?.title ?? "",
            details: data.cards[cardId]?.details ?? "",
            position: idx,
          })),
        }));
        try {
          const res = await fetchWithRetry("/api/board", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ columns: apiColumns }),
          });
          if (!res.ok) {
            setError(`Failed to save board: ${res.status}`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
        }
      }, DEBOUNCE_MS);
    },
    [authToken],
  );

  const saveBoard = useCallback(
    (data: BoardData) => {
      setBoard(data);
      scheduleSave(data);
    },
    [scheduleSave],
  );

  const refreshBoard = useCallback(async () => {
    await fetchBoard();
  }, [fetchBoard]);

  return (
    <BoardContext.Provider value={{ board, isLoading, error, authToken, saveBoard, refreshBoard }}>
      {children}
    </BoardContext.Provider>
  );
};
