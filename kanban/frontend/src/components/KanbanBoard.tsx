"use client";

import {
  DndContext,
  DragOverEvent,
  DragEndEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useReducer } from "react";

import { createInitialBoard, kanbanReducer } from "@/lib/kanbanState";

import { KanbanColumn } from "./KanbanColumn";

const getOverDestination = (
  overId: string,
  cardColumnById: Record<string, string>,
  cardsByColumn: Record<string, string[]>,
) => {
  if (overId.startsWith("column-")) {
    const destinationColumn = overId.replace("column-", "");
    const destinationCards = cardsByColumn[destinationColumn] ?? [];
    return { toColumnId: destinationColumn, toIndex: destinationCards.length };
  }

  const destinationColumn = cardColumnById[overId];
  if (!destinationColumn) {
    return null;
  }

  const destinationCards = cardsByColumn[destinationColumn] ?? [];
  return { toColumnId: destinationColumn, toIndex: destinationCards.indexOf(overId) };
};

export const KanbanBoard = () => {
  const [board, dispatch] = useReducer(kanbanReducer, undefined, createInitialBoard);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const cardColumnById = useMemo(() => {
    return board.columns.reduce<Record<string, string>>((accumulator, column) => {
      column.cardIds.forEach((cardId) => {
        accumulator[cardId] = column.id;
      });
      return accumulator;
    }, {});
  }, [board.columns]);

  const cardsByColumn = useMemo(() => {
    return board.columns.reduce<Record<string, string[]>>((accumulator, column) => {
      accumulator[column.id] = column.cardIds;
      return accumulator;
    }, {});
  }, [board.columns]);

  const moveCardUsingOverId = (activeId: string, overId: string) => {
    const fromColumnId = cardColumnById[activeId];
    if (!fromColumnId) {
      return;
    }

    const destination = getOverDestination(overId, cardColumnById, cardsByColumn);
    if (!destination || destination.toIndex < 0) {
      return;
    }

    const currentIndex = cardsByColumn[fromColumnId]?.indexOf(activeId);
    if (currentIndex === undefined || currentIndex < 0) {
      return;
    }

    if (destination.toColumnId === fromColumnId && destination.toIndex === currentIndex) {
      return;
    }

    dispatch({
      type: "moveCard",
      cardId: activeId,
      fromColumnId,
      toColumnId: destination.toColumnId,
      toIndex: destination.toIndex,
    });
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      return;
    }

    moveCardUsingOverId(String(active.id), String(over.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }
    moveCardUsingOverId(String(active.id), String(over.id));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-[#032147]">{board.title}</h1>
        <p className="mt-2 text-sm text-[#888888]">Single-board Kanban MVP with elegant essentials.</p>
      </header>

      <DndContext
        id="kanban-dnd-context"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={column.cardIds.map((cardId) => board.cardsById[cardId]).filter(Boolean)}
              onRename={(title) => dispatch({ type: "renameColumn", columnId: column.id, title })}
              onAddCard={(title, details) =>
                dispatch({ type: "addCard", columnId: column.id, title, details })
              }
              onDeleteCard={(cardId) => dispatch({ type: "deleteCard", columnId: column.id, cardId })}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
};
