export type CardPriority = 'Low' | 'Medium' | 'High';

export interface Card {
  id: string;
  title: string;
  details: string;
  position: number;
  priority: CardPriority;
  label: string;
  dueDate: string | null;
}

export interface Column {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}

export interface BoardData {
  id: string;
  name: string;
  columns: Column[];
}

export interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
}
