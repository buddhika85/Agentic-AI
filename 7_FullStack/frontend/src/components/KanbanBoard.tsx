"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { KanbanCardEditForm } from "@/components/KanbanCardEditForm";
import { ChatSidebar } from "@/components/ChatSidebar";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { useAuth } from "@/lib/auth";
import { useBoard } from "@/lib/boardApi";

const FALLBACK_BOARD: BoardData = {
  columns: [
    { id: "col-todo", title: "To Do", cardIds: ["card-1", "card-2"] },
    { id: "col-review", title: "Review", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-testing", title: "Testing", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Research competitors", details: "Analyze top 5 competitor features and pricing." },
    "card-2": { id: "card-2", title: "Define user personas", details: "Create 3 primary personas based on market research." },
    "card-3": { id: "card-3", title: "Wireframe mockups", details: "Draft initial wireframes for core user flows." },
  },
};

export const KanbanBoard = () => {
  const { logout } = useAuth();
  const { board: apiBoard, isLoading, error, saveBoard, refreshBoard, authToken } = useBoard();
  const [board, setBoard] = useState<BoardData>(FALLBACK_BOARD);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  useEffect(() => {
    if (apiBoard && Array.isArray(apiBoard.columns) && apiBoard.columns.length > 0) {
      const hasCards = apiBoard.columns.some((col) => col.cardIds.length > 0);
      if (hasCards) {
        setBoard(apiBoard);
      }
    }
  }, [apiBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const applyChange = useCallback(
    (updater: (prev: BoardData) => BoardData) => {
      setBoard((prev) => {
        const next = updater(prev);
        saveBoard(next);
        return next;
      });
    },
    [saveBoard],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) return;
    applyChange((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    applyChange((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column,
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    applyChange((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column,
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    applyChange((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId),
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column,
      ),
    }));
    if (editingCardId === cardId) {
      setEditingCardId(null);
      setEditingColumnId(null);
    }
  };

  const handleDoubleClickCard = (columnId: string, cardId: string) => {
    setEditingCardId(cardId);
    setEditingColumnId(columnId);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditingColumnId(null);
  };

  const handleSaveEdit = (cardId: string, title: string, details: string) => {
    applyChange((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: { ...prev.cards[cardId], title, details },
      },
    }));
    setEditingCardId(null);
    setEditingColumnId(null);
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const isEditing = editingCardId !== null;

  if (isLoading && !board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-screen flex-1 flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-6 shadow-[var(--shadow)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)] sm:text-4xl">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between
                stages, and capture quick notes without getting buried in
                settings.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  logout();
                  refreshBoard();
                }}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              >
                Logout
              </button>
              <div className="hidden rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4 md:block">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
                <span className="ml-1 rounded-full bg-[var(--stroke)] px-1.5 py-0.5 text-[10px] text-[var(--gray-text)]">
                  {column.cardIds.length}
                </span>
              </div>
            ))}
          </div>
          {error && (
            <p className="text-sm text-red-600">
              Sync error: {error}
            </p>
          )}
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onDoubleClickCard={handleDoubleClickCard}
                editingCardId={isEditing && editingColumnId === column.id ? editingCardId : null}
                editForm={
                  isEditing && editingColumnId === column.id && editingCardId ? (
                    <KanbanCardEditForm
                      card={board.cards[editingCardId]}
                      onSave={(title, details) => handleSaveEdit(editingCardId, title, details)}
                      onCancel={handleCancelEdit}
                    />
                  ) : null
                }
              />
            ))}

            <div className="hidden xl:block">
              <ChatSidebar
                authToken={authToken}
                board={board}
                onBoardUpdated={refreshBoard}
              />
            </div>
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <div className="xl:hidden">
        <ChatSidebar
          authToken={authToken}
          board={board}
          onBoardUpdated={refreshBoard}
        />
      </div>
    </div>
  );
};
