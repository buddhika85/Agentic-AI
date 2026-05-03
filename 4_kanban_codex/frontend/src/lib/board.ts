export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cards: Card[];
};

export const initialColumns: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    cards: [
      {
        id: "card-1",
        title: "Map onboarding flow",
        details: "Sketch the first-run path and note the moments that need polish."
      },
      {
        id: "card-2",
        title: "Collect stakeholder notes",
        details: "Condense open feedback into short themes for the kickoff review."
      }
    ]
  },
  {
    id: "ready",
    title: "Ready",
    cards: [
      {
        id: "card-3",
        title: "Draft dashboard copy",
        details: "Write crisp labels for the board header, empty states, and card form."
      }
    ]
  },
  {
    id: "progress",
    title: "In Progress",
    cards: [
      {
        id: "card-4",
        title: "Design column rhythm",
        details: "Balance spacing, color, and contrast for quick scanning."
      },
      {
        id: "card-5",
        title: "Build drag interactions",
        details: "Make card movement feel stable between all five fixed columns."
      }
    ]
  },
  {
    id: "review",
    title: "Review",
    cards: [
      {
        id: "card-6",
        title: "QA sample cards",
        details: "Check that default content shows the full board story at launch."
      }
    ]
  },
  {
    id: "done",
    title: "Done",
    cards: [
      {
        id: "card-7",
        title: "Choose palette",
        details: "Apply the requested navy, blue, purple, yellow, and gray system."
      }
    ]
  }
];

export function addCard(columns: Column[], columnId: string, card: Card): Column[] {
  return columns.map((column) =>
    column.id === columnId ? { ...column, cards: [...column.cards, card] } : column
  );
}

export function deleteCard(columns: Column[], cardId: string): Column[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => card.id !== cardId)
  }));
}

export function renameColumn(columns: Column[], columnId: string, title: string): Column[] {
  return columns.map((column) =>
    column.id === columnId ? { ...column, title: title.trim() || column.title } : column
  );
}

export function moveCard(columns: Column[], cardId: string, targetColumnId: string): Column[] {
  const sourceColumn = columns.find((column) =>
    column.cards.some((card) => card.id === cardId)
  );
  const targetColumn = columns.find((column) => column.id === targetColumnId);
  const card = sourceColumn?.cards.find((item) => item.id === cardId);

  if (!sourceColumn || !targetColumn || !card || sourceColumn.id === targetColumnId) {
    return columns;
  }

  return columns.map((column) => {
    if (column.id === sourceColumn.id) {
      return { ...column, cards: column.cards.filter((item) => item.id !== cardId) };
    }

    if (column.id === targetColumnId) {
      return { ...column, cards: [...column.cards, card] };
    }

    return column;
  });
}

