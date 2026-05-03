export type Column = {
  id: string;
  title: string;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  columnId: string;
};

export const initialColumns: Column[] = [
  { id: "todo", title: "To do" },
  { id: "in-progress", title: "In progress" },
  { id: "review", title: "Review" },
  { id: "blocked", title: "Blocked" },
  { id: "done", title: "Done" },
];

export const initialCards: Card[] = [
  {
    id: "card-1",
    title: "Design new task flow",
    details: "Map the board flow and define the first tasks.",
    columnId: "todo",
  },
  {
    id: "card-2",
    title: "Build board UI",
    details: "Create the column layout and card styles.",
    columnId: "in-progress",
  },
  {
    id: "card-3",
    title: "Review accessibility",
    details: "Ensure the board is keyboard friendly.",
    columnId: "review",
  },
  {
    id: "card-4",
    title: "Resolve issue pain points",
    details: "Address card spacing and drag feedback.",
    columnId: "blocked",
  },
  {
    id: "card-5",
    title: "Launch MVP",
    details: "Prepare the app for developer review.",
    columnId: "done",
  },
];
