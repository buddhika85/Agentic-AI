"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Card as CardType } from "@/lib/kanban";

type CardProps = {
  card: CardType;
  onDelete: (id: string) => void;
};

export default function Card({ card, onDelete }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card-item${isDragging ? " dragging" : ""}`}
      data-testid="card-item"
      {...attributes}
      {...listeners}
    >
      <div>
        <h3 className="card-title">{card.title}</h3>
        <p className="card-details">{card.details}</p>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="delete-button"
          onClick={() => onDelete(card.id)}
        >
          Delete card
        </button>
      </div>
    </article>
  );
}
