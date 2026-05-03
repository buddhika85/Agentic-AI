"use client";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Card as CardType, Column as ColumnType } from "@/lib/kanban";
import Column from "./Column";

type BoardProps = {
  initialColumns: ColumnType[];
  initialCards: CardType[];
};

export default function Board({ initialColumns, initialCards }: BoardProps) {
  const [columns, setColumns] = useState<ColumnType[]>(initialColumns);
  const [cards, setCards] = useState<CardType[]>(initialCards);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const cardsByColumn = useMemo(
    () =>
      columns.reduce<Record<string, CardType[]>>((acc, column) => {
        acc[column.id] = cards.filter((card) => card.columnId === column.id);
        return acc;
      }, {}),
    [columns, cards],
  );

  const handleRenameColumn = (columnId: string, title: string) => {
    setColumns((current) =>
      current.map((column) =>
        column.id === columnId ? { ...column, title } : column,
      ),
    );
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    setCards((current) => [
      ...current,
      {
        id: `card-${Date.now()}`,
        title,
        details: details || "No additional notes",
        columnId,
      },
    ]);
  };

  const handleDeleteCard = (cardId: string) => {
    setCards((current) => current.filter((card) => card.id !== cardId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) {
      return;
    }

    const activeCard = cards.find((card) => card.id === activeId);
    if (!activeCard) {
      return;
    }

    const overColumnIds = columns.map((column) => column.id);
    if (overColumnIds.includes(overId)) {
      setCards((current) =>
        current.map((card) =>
          card.id === activeId ? { ...card, columnId: overId } : card,
        ),
      );
      return;
    }

    const overCard = cards.find((card) => card.id === overId);
    if (!overCard) {
      return;
    }

    if (activeCard.columnId === overCard.columnId) {
      const columnCards = cardsByColumn[activeCard.columnId];
      const oldIndex = columnCards.findIndex((card) => card.id === activeId);
      const newIndex = columnCards.findIndex((card) => card.id === overId);
      const updatedColumnCards = arrayMove(columnCards, oldIndex, newIndex);

      setCards((current) => [
        ...current.filter((card) => card.columnId !== activeCard.columnId),
        ...updatedColumnCards,
      ]);
      return;
    }

    setCards((current) => {
      const withoutActive = current.filter((card) => card.id !== activeId);
      const overIndex = withoutActive.findIndex((card) => card.id === overId);
      return [
        ...withoutActive.slice(0, overIndex),
        { ...activeCard, columnId: overCard.columnId },
        ...withoutActive.slice(overIndex),
      ];
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <section className="board-grid" data-testid="board-grid">
        {columns.map((column) => (
          <SortableContext
            key={column.id}
            items={cardsByColumn[column.id].map((card) => card.id)}
            strategy={verticalListSortingStrategy}
          >
            <Column
              column={column}
              cards={cardsByColumn[column.id]}
              onRename={handleRenameColumn}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
            />
          </SortableContext>
        ))}
      </section>
    </DndContext>
  );
}
