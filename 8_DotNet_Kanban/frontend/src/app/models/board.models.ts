export interface Card {
  id: string;
  title: string;
  details: string;
  position: number;
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
