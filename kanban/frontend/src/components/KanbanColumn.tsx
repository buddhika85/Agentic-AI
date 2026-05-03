"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FormEvent, useState } from "react";

import type { Card, Column } from "@/lib/kanbanState";

import { KanbanCard } from "./KanbanCard";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (title: string) => void;
  onAddCard: (title: string, details: string) => void;
  onDeleteCard: (cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [cardTitle, setCardTitle] = useState("");
  const [cardDetails, setCardDetails] = useState("");
  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const submitNewCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddCard(cardTitle, cardDetails);
    setCardTitle("");
    setCardDetails("");
  };

  return (
    <section
      ref={setNodeRef}
      className="flex min-h-[560px] w-[320px] flex-col rounded-2xl border border-[#209dd7]/30 bg-[#f8fbff] p-4 shadow-sm"
      data-testid={`column-${column.id}`}
    >
      <input
        value={titleDraft}
        onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={() => {
          onRename(titleDraft);
          setTitleDraft(titleDraft.trim() || column.title);
        }}
        className="mb-4 rounded-lg border border-transparent bg-white px-3 py-2 text-base font-semibold text-[#032147] outline-none ring-[#209dd7]/40 transition focus:border-[#209dd7] focus:ring-2"
        aria-label={`${column.title} title`}
        data-testid={`column-title-${column.id}`}
      />

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="mb-4 flex flex-1 flex-col gap-3">
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              columnId={column.id}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>

      <form onSubmit={submitNewCard} className="space-y-2 rounded-xl border border-[#ecad0a]/30 bg-white p-3">
        <input
          value={cardTitle}
          onChange={(event) => setCardTitle(event.target.value)}
          placeholder="Card title"
          className="w-full rounded-md border border-[#209dd7]/30 px-3 py-2 text-sm text-[#032147] outline-none ring-[#209dd7]/30 focus:ring-2"
          required
          maxLength={80}
        />
        <textarea
          value={cardDetails}
          onChange={(event) => setCardDetails(event.target.value)}
          placeholder="Card details"
          className="h-20 w-full resize-none rounded-md border border-[#209dd7]/30 px-3 py-2 text-sm text-[#032147] outline-none ring-[#209dd7]/30 focus:ring-2"
          required
          maxLength={240}
        />
        <button
          type="submit"
          className="w-full cursor-pointer rounded-md bg-[#753991] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#5f2f75]"
        >
          Add card
        </button>
      </form>
    </section>
  );
};
