# Frontend Agent Documentation

## Purpose

This file documents the current frontend implementation for the Project Management MVP web app.

## Frontend stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- @dnd-kit for drag and drop
- Vitest for unit tests
- Playwright for end-to-end testing

## Entry point

- `src/app/page.tsx`
  - Renders the `KanbanBoard` component as the home page.

## Main UI component

- `src/components/KanbanBoard.tsx`
  - Client component that manages board state via `useState`.
  - Uses `DndContext` and drag overlay for card drag-and-drop.
  - Handles column rename, card add, and card delete actions.
  - Uses `initialData` from `src/lib/kanban.ts` for demo content.

## Supporting components

- `src/components/KanbanColumn.tsx`
  - Renders a single column and its cards.
  - Uses `useDroppable` and `SortableContext` to support drop targets.
  - Includes the `NewCardForm` and renders `KanbanCard` components.

- `src/components/KanbanCard.tsx`
  - Renders an individual draggable card.
  - Uses `useSortable` for drag interactions.
  - Supports card deletion.

- `src/components/KanbanCardPreview.tsx`
  - Displays the drag overlay preview for an active card.

- `src/components/NewCardForm.tsx`
  - Toggleable form for creating a new card.
  - Validates title input and resets after submission.

## Domain model and utilities

- `src/lib/kanban.ts`
  - Defines `Card`, `Column`, and `BoardData` types.
  - Provides `initialData` for the demo board.
  - Includes `moveCard` utility to reorder cards within or across columns.
  - Includes `createId` helper for new card IDs.

## Tests

- `src/components/KanbanBoard.test.tsx`
  - Verifies the board renders five columns.
  - Verifies column rename behavior.
  - Verifies adding and deleting a card within a column.

## Notes

- The current frontend is a demo-only implementation without backend integration.
- There is no authentication, persistence, or AI/chat support in the current code.
- The plan calls for backend integration, auth, database persistence, and AI chat support in later stages.
