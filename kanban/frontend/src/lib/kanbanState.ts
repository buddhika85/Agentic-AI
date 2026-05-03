export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type Board = {
  id: string;
  title: string;
  columns: Column[];
  cardsById: Record<string, Card>;
  nextCardNumber: number;
};

export type KanbanAction =
  | { type: "renameColumn"; columnId: string; title: string }
  | { type: "addCard"; columnId: string; title: string; details: string }
  | { type: "deleteCard"; columnId: string; cardId: string }
  | {
      type: "moveCard";
      cardId: string;
      fromColumnId: string;
      toColumnId: string;
      toIndex: number;
    };

const createSeedCards = (): Record<string, Card> => ({
  "card-1": { id: "card-1", title: "Kickoff", details: "Define success criteria and owners." },
  "card-2": { id: "card-2", title: "Wireframes", details: "Sketch the board and card interactions." },
  "card-3": { id: "card-3", title: "Design Tokens", details: "Apply the approved color palette." },
  "card-4": { id: "card-4", title: "Build Columns", details: "Create reusable column components." },
  "card-5": { id: "card-5", title: "Drag Testing", details: "Verify move behavior between columns." },
  "card-6": { id: "card-6", title: "Launch Prep", details: "Run final QA checks before demo." },
});

export const createInitialBoard = (): Board => ({
  id: "board-1",
  title: "Product Delivery",
  columns: [
    { id: "column-1", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "column-2", title: "Ready", cardIds: ["card-3"] },
    { id: "column-3", title: "In Progress", cardIds: ["card-4"] },
    { id: "column-4", title: "Review", cardIds: ["card-5"] },
    { id: "column-5", title: "Done", cardIds: ["card-6"] },
  ],
  cardsById: createSeedCards(),
  nextCardNumber: 7,
});

export const renameColumn = (board: Board, columnId: string, title: string): Board => {
  const nextTitle = title.trim();
  if (!nextTitle) {
    return board;
  }

  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, title: nextTitle } : column,
    ),
  };
};

export const addCard = (
  board: Board,
  columnId: string,
  title: string,
  details: string,
): Board => {
  const nextTitle = title.trim();
  const nextDetails = details.trim();
  if (!nextTitle || !nextDetails) {
    return board;
  }

  const nextCardId = `card-${board.nextCardNumber}`;
  const nextCard: Card = { id: nextCardId, title: nextTitle, details: nextDetails };
  const targetColumn = board.columns.find((column) => column.id === columnId);
  if (!targetColumn) {
    return board;
  }

  return {
    ...board,
    nextCardNumber: board.nextCardNumber + 1,
    cardsById: { ...board.cardsById, [nextCardId]: nextCard },
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, cardIds: [...column.cardIds, nextCardId] } : column,
    ),
  };
};

export const deleteCard = (board: Board, columnId: string, cardId: string): Board => {
  const targetColumn = board.columns.find((column) => column.id === columnId);
  if (!targetColumn || !board.cardsById[cardId]) {
    return board;
  }

  const nextCardsById = { ...board.cardsById };
  delete nextCardsById[cardId];

  return {
    ...board,
    cardsById: nextCardsById,
    columns: board.columns.map((column) =>
      column.id === columnId
        ? { ...column, cardIds: column.cardIds.filter((currentId) => currentId !== cardId) }
        : column,
    ),
  };
};

const clampIndex = (index: number, maxLength: number): number => {
  if (index < 0) {
    return 0;
  }

  if (index > maxLength) {
    return maxLength;
  }

  return index;
};

export const moveCard = (
  board: Board,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number,
): Board => {
  if (!board.cardsById[cardId]) {
    return board;
  }

  const fromColumn = board.columns.find((column) => column.id === fromColumnId);
  const targetColumn = board.columns.find((column) => column.id === toColumnId);
  if (!fromColumn || !targetColumn || !fromColumn.cardIds.includes(cardId)) {
    return board;
  }

  const nextColumns = board.columns.map((column) => ({ ...column, cardIds: [...column.cardIds] }));
  const nextFromColumn = nextColumns.find((column) => column.id === fromColumnId);
  const nextToColumn = nextColumns.find((column) => column.id === toColumnId);
  if (!nextFromColumn || !nextToColumn) {
    return board;
  }

  const fromIndex = nextFromColumn.cardIds.indexOf(cardId);
  if (fromIndex < 0) {
    return board;
  }

  nextFromColumn.cardIds.splice(fromIndex, 1);
  const insertIndex = clampIndex(toIndex, nextToColumn.cardIds.length);
  nextToColumn.cardIds.splice(insertIndex, 0, cardId);

  return { ...board, columns: nextColumns };
};

export const kanbanReducer = (board: Board, action: KanbanAction): Board => {
  switch (action.type) {
    case "renameColumn":
      return renameColumn(board, action.columnId, action.title);
    case "addCard":
      return addCard(board, action.columnId, action.title, action.details);
    case "deleteCard":
      return deleteCard(board, action.columnId, action.cardId);
    case "moveCard":
      return moveCard(board, action.cardId, action.fromColumnId, action.toColumnId, action.toIndex);
    default:
      return board;
  }
};
