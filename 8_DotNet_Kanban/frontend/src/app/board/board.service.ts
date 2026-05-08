import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { BoardData } from '../models/board.models';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private http = inject(HttpClient);
  board = signal<BoardData | null>(null);

  private saveSubject = new Subject<BoardData>();

  constructor() {
    // Debounce saves — do NOT reduce below 800ms (prevents flooding during drag-drop)
    this.saveSubject.pipe(debounceTime(800)).subscribe(b => this.persistBoard(b));
  }

  async loadBoard(): Promise<void> {
    const data = await firstValueFrom(this.http.get<BoardData>('/api/board'));
    this.board.set(data);
  }

  updateBoard(updated: BoardData): void {
    this.board.set(updated);
    this.saveSubject.next(updated);
  }

  applyAiBoardUpdate(update: BoardData): void {
    const capped = { ...update, columns: update.columns.slice(0, 5) };
    this.board.set(capped);
    this.persistBoard(capped);
  }

  private persistBoard(data: BoardData): void {
    this.http.post('/api/board', { board: data }).subscribe();
  }
}
