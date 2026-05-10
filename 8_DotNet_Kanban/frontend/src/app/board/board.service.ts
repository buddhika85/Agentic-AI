import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { BoardData, BoardSummary } from '../models/board.models';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private http = inject(HttpClient);
  board = signal<BoardData | null>(null);
  boards = signal<BoardSummary[]>([]);

  private saveSubject = new Subject<{ boardId: string; data: BoardData }>();

  constructor() {
    // Debounce saves — do NOT reduce below 800ms (prevents flooding during drag-drop)
    this.saveSubject.pipe(debounceTime(800)).subscribe(({ boardId, data }) =>
      this.persistBoard(boardId, data)
    );
  }

  async listBoards(): Promise<void> {
    const list = await firstValueFrom(this.http.get<BoardSummary[]>('/api/boards'));
    this.boards.set(list);
  }

  async loadBoard(boardId?: string): Promise<void> {
    const url = boardId ? `/api/boards/${boardId}` : '/api/board';
    const data = await firstValueFrom(this.http.get<BoardData>(url));
    this.board.set(data);
  }

  async createBoard(name: string): Promise<BoardSummary> {
    const board = await firstValueFrom(
      this.http.post<BoardData>('/api/boards', { name })
    );
    const summary: BoardSummary = {
      id: board.id,
      name: board.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cardCount: 0
    };
    this.boards.update(list => [summary, ...list]);
    return summary;
  }

  async deleteBoard(boardId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/boards/${boardId}`));
    this.boards.update(list => list.filter(b => b.id !== boardId));
    if (this.board()?.id === boardId) this.board.set(null);
  }

  updateBoard(updated: BoardData): void {
    this.board.set(updated);
    if (updated.id) {
      this.saveSubject.next({ boardId: updated.id, data: updated });
    }
  }

  applyAiBoardUpdate(update: BoardData): void {
    const capped = { ...update, columns: update.columns.slice(0, 5) };
    this.board.set(capped);
    if (capped.id) this.persistBoard(capped.id, capped);
  }

  private persistBoard(boardId: string, data: BoardData): void {
    this.http.post(`/api/boards/${boardId}`, { board: data }).subscribe();
  }
}
