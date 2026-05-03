"use client";

import Board from "@/components/Board";
import { initialCards, initialColumns } from "@/lib/kanban";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Kanban project</p>
          <h1>Kanban board for one team</h1>
          <p className="subtitle">
            A single board with five columns, drag-and-drop cards, renameable
            columns, and card add/delete.
          </p>
        </div>
      </section>
      <Board initialColumns={initialColumns} initialCards={initialCards} />
    </main>
  );
}
