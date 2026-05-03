"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  Card,
  Column,
  addCard,
  deleteCard,
  initialColumns,
  moveCard,
  renameColumn
} from "@/lib/board";

type CardFormState = {
  columnId: string;
  title: string;
  details: string;
} | null;

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [cardForm, setCardForm] = useState<CardFormState>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeCard = useMemo(
    () => columns.flatMap((column) => column.cards).find((card) => card.id === activeCardId),
    [activeCardId, columns]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id);
    const targetColumnId = event.over?.id ? String(event.over.id) : null;

    if (targetColumnId) {
      setColumns((current) => moveCard(current, cardId, targetColumnId));
    }

    setActiveCardId(null);
  }

  function handleAddCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cardForm?.title.trim()) {
      return;
    }

    setColumns((current) =>
      addCard(current, cardForm.columnId, {
        id: crypto.randomUUID(),
        title: cardForm.title.trim(),
        details: cardForm.details.trim()
      })
    );
    setCardForm(null);
  }

  return (
    <main className="app-shell">
      <section className="board-header" aria-labelledby="board-title">
        <div>
          <p className="eyebrow">Single project workspace</p>
          <h1 id="board-title">Kanban Board</h1>
        </div>
        <div className="board-stats" aria-label="Board summary">
          <span>{columns.length} columns</span>
          <strong>{columns.flatMap((column) => column.cards).length} cards</strong>
        </div>
      </section>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <section className="board-grid" aria-label="Project board">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onRename={(title) =>
                setColumns((current) => renameColumn(current, column.id, title))
              }
              onAdd={() => setCardForm({ columnId: column.id, title: "", details: "" })}
              onDelete={(cardId) => setColumns((current) => deleteCard(current, cardId))}
            />
          ))}
        </section>
        <DragOverlay>{activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}</DragOverlay>
      </DndContext>

      {cardForm ? (
        <div className="modal-backdrop" role="presentation">
          <form className="card-form" onSubmit={handleAddCard} aria-label="New card form">
            <div className="form-title-row">
              <h2>New card</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCardForm(null)}
                aria-label="Close new card form"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Card title
              <input
                autoFocus
                value={cardForm.title}
                onChange={(event) => setCardForm({ ...cardForm, title: event.target.value })}
                placeholder="Name the work"
              />
            </label>
            <label>
              Card details
              <textarea
                value={cardForm.details}
                onChange={(event) => setCardForm({ ...cardForm, details: event.target.value })}
                placeholder="Add a short note"
                rows={4}
              />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={18} />
              Add card
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function KanbanColumn({
  column,
  onRename,
  onAdd,
  onDelete
}: {
  column: Column;
  onRename: (title: string) => void;
  onAdd: () => void;
  onDelete: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <article
      ref={setNodeRef}
      className={`column ${isOver ? "column-over" : ""}`}
      data-testid={`column-${column.id}`}
    >
      <header className="column-header">
        <input
          className="column-title"
          aria-label={`${column.title} column name`}
          value={column.title}
          onChange={(event) => onRename(event.target.value)}
        />
        <span className="card-count">{column.cards.length}</span>
      </header>
      <div className="card-stack">
        {column.cards.map((card) => (
          <KanbanCard key={card.id} card={card} onDelete={() => onDelete(card.id)} />
        ))}
      </div>
      <button
        className="add-card-button"
        type="button"
        onClick={onAdd}
        aria-label={`Add card to ${column.title}`}
      >
        <Plus size={17} />
        Add card
      </button>
    </article>
  );
}

function KanbanCard({
  card,
  onDelete,
  isOverlay = false
}: {
  card: Card;
  onDelete?: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id
  });
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <article
      ref={setNodeRef}
      className={`kanban-card ${isDragging ? "dragging" : ""} ${isOverlay ? "overlay" : ""}`}
      data-testid={`card-${card.id}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div>
        <h3>{card.title}</h3>
        <p>{card.details}</p>
      </div>
      {onDelete ? (
        <button
          className="delete-button"
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${card.title}`}
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </article>
  );
}
