"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import clsx from "clsx";

import type { Card } from "@/lib/kanbanState";

type KanbanCardProps = {
  card: Card;
  columnId: string;
  onDelete: () => void;
};

export const KanbanCard = ({ card, columnId, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId },
  });
  const normalizedTransform = transform ? { ...transform, scaleX: 1, scaleY: 1 } : null;

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(normalizedTransform), transition }}
      className={clsx(
        "rounded-xl border border-[#ecad0a]/30 bg-white p-4 shadow-sm transition-shadow",
        "hover:shadow-md",
        isDragging && "opacity-85 shadow-md ring-2 ring-[#209dd7]/20",
      )}
      data-testid={`card-${card.id}`}
      {...attributes}
      {...listeners}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#032147]">{card.title}</h3>
        <button
          type="button"
          onClick={onDelete}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-[#753991] hover:bg-[#753991]/10"
          aria-label={`Delete ${card.title}`}
        >
          Delete
        </button>
      </div>
      <p className="text-sm leading-6 text-[#888888]">{card.details}</p>
    </article>
  );
};
