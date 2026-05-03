"use client";

import { useDroppable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { Card as CardType, Column as ColumnType } from "@/lib/kanban";
import Card from "./Card";

type ColumnProps = {
  column: ColumnType;
  cards: CardType[];
  onRename: (id: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (id: string) => void;
};

export default function Column({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [title, setTitle] = useState(column.title);
  const [cardTitle, setCardTitle] = useState("");
  const [cardDetails, setCardDetails] = useState("");

  useEffect(() => {
    setTitle(column.title);
  }, [column.title]);

  const handleAddCard = () => {
    if (!cardTitle.trim()) {
      return;
    }

    onAddCard(column.id, cardTitle.trim(), cardDetails.trim());
    setCardTitle("");
    setCardDetails("");
  };

  return (
    <section
      ref={setNodeRef}
      className="column-panel"
      style={{ borderColor: isOver ? "rgba(32, 157, 215, 0.34)" : undefined }}
      data-testid="column-panel"
    >
      <div className="column-header">
        <input
          aria-label={`Column name for ${column.title}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => onRename(column.id, title.trim() || column.title)}
        />
        <p className="subtitle">
          {cards.length} card{cards.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="cards-list">
        {cards.length === 0 ? (
          <p className="empty-state">Drag a card here or add a new card.</p>
        ) : (
          cards.map((card) => (
            <Card key={card.id} card={card} onDelete={onDeleteCard} />
          ))
        )}
      </div>

      <div className="card-form">
        <input
          placeholder="Card title"
          value={cardTitle}
          onChange={(event) => setCardTitle(event.target.value)}
        />
        <textarea
          placeholder="Card details"
          value={cardDetails}
          onChange={(event) => setCardDetails(event.target.value)}
        />
        <button type="button" className="add-button" onClick={handleAddCard}>
          Add card
        </button>
      </div>
    </section>
  );
}
