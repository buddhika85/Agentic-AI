import { Component, OnInit, inject, signal } from '@angular/core';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { BoardService } from './board.service';
import { AuthService } from '../auth/auth.service';
import { ColumnComponent, CardEditedEvent } from './column/column.component';
import { ChatSidebarComponent } from '../chat/chat-sidebar.component';
import { Card, Column } from '../models/board.models';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, FormsModule, ColumnComponent, ChatSidebarComponent],
  template: `
    <div class="flex h-screen bg-gradient-to-br from-slate-100 to-indigo-50 overflow-hidden">

      <!-- Board area -->
      <div class="flex-1 flex flex-col overflow-hidden">

        <!-- Header -->
        <header class="flex items-center justify-between px-6 py-4
                       bg-gradient-to-r from-indigo-700 to-purple-700
                       shadow-lg shadow-indigo-900/30 z-10">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <h1 class="text-base font-bold text-white tracking-tight">
              {{ boardService.board()?.name ?? 'Loading…' }}
            </h1>
          </div>

          <button (click)="logout()"
                  class="flex items-center gap-2 text-sm text-white/70 hover:text-white
                         bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
            </svg>
            Logout
          </button>
        </header>

        <!-- Columns -->
        @if (!boardService.board()) {
          <div class="flex-1 flex items-center justify-center">
            <div class="flex flex-col items-center gap-3 text-indigo-400">
              <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span class="text-sm font-medium">Loading board…</span>
            </div>
          </div>
        } @else {
          <div class="flex-1 flex gap-4 p-5 overflow-x-auto"
               cdkDropList
               cdkDropListOrientation="horizontal"
               (cdkDropListDropped)="onColumnDrop($event)">
            @for (col of boardService.board()!.columns; track col.id; let i = $index) {
              <div cdkDrag [cdkDragData]="col" class="flex-shrink-0">
                <app-column
                  [column]="col"
                  [colIndex]="i"
                  [connectedTo]="columnIds"
                  (dropped)="onDrop($event)"
                  (cardAdded)="onCardAdded(col.id, $event)"
                  (cardEdited)="onCardEdited(col.id, $event)"
                  (cardDeleted)="onCardDeleted(col.id, $event)"
                  (columnDeleted)="onColumnDeleted(col.id)"
                  (columnRenamed)="onColumnRenamed(col.id, $event)" />
                <div *cdkDragPlaceholder
                     class="w-72 rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200"
                     style="min-height:160px"></div>
              </div>
            }

            <!-- Add column (hidden at limit) -->
            @if (boardService.board()!.columns.length < 5) {
            <div class="w-72 flex-shrink-0">
              @if (addingColumn()) {
                <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-white p-4 space-y-3">
                  <input [(ngModel)]="newColumnTitle"
                         autofocus
                         class="w-full text-sm font-semibold text-gray-800 outline-none border-b border-gray-200
                                pb-1.5 focus:border-indigo-400 transition-colors placeholder-gray-400 bg-transparent"
                         placeholder="Column name…"
                         (keydown.enter)="submitColumn()"
                         (keydown.escape)="cancelColumn()" />
                  <div class="flex gap-2">
                    <button (click)="submitColumn()"
                            class="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg
                                   hover:bg-indigo-700 transition-colors">
                      Add column
                    </button>
                    <button (click)="cancelColumn()"
                            class="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              } @else {
                <button (click)="addingColumn.set(true)"
                        class="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-indigo-600
                               bg-white/50 hover:bg-white/80 border border-dashed border-gray-200
                               hover:border-indigo-300 rounded-2xl px-4 py-3 transition-all duration-150">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Add column
                </button>
              }
            </div>
            } <!-- end @if columns < 5 -->
          </div>
        }

      </div>

      <!-- AI Chat sidebar -->
      <app-chat-sidebar />

    </div>
  `
})
export class BoardComponent implements OnInit {
  boardService = inject(BoardService);
  private auth = inject(AuthService);

  addingColumn    = signal(false);
  newColumnTitle  = '';

  ngOnInit(): void {
    this.boardService.loadBoard();
  }

  logout(): void {
    this.auth.logout();
  }

  onDrop(event: CdkDragDrop<Card[]>): void {
    const board = structuredClone(this.boardService.board()!);
    if (event.previousContainer === event.container) {
      const col = board.columns.find(c => c.id === event.container.id)!;
      moveItemInArray(col.cards, event.previousIndex, event.currentIndex);
    } else {
      const srcCol = board.columns.find(c => c.id === event.previousContainer.id)!;
      const tgtCol = board.columns.find(c => c.id === event.container.id)!;
      transferArrayItem(srcCol.cards, tgtCol.cards, event.previousIndex, event.currentIndex);
    }
    board.columns.forEach(c => c.cards.forEach((card, i) => card.position = i));
    this.boardService.updateBoard(board);
  }

  onCardAdded(columnId: string, event: { title: string; details: string }): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    col.cards.push({ id: `new-${Date.now()}`, title: event.title, details: event.details, position: col.cards.length });
    this.boardService.updateBoard(board);
  }

  onCardEdited(columnId: string, event: CardEditedEvent): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    const card = col.cards.find(c => c.id === event.cardId)!;
    card.title = event.title;
    card.details = event.details;
    this.boardService.updateBoard(board);
  }

  get columnIds(): string[] {
    return this.boardService.board()?.columns.map(c => c.id) ?? [];
  }

  onColumnDrop(event: CdkDragDrop<Column[]>): void {
    const board = structuredClone(this.boardService.board()!);
    moveItemInArray(board.columns, event.previousIndex, event.currentIndex);
    board.columns.forEach((c, i) => c.position = i);
    this.boardService.updateBoard(board);
  }

  submitColumn(): void {
    const title = this.newColumnTitle.trim();
    if (title) {
      const board = structuredClone(this.boardService.board()!);
      board.columns.push({ id: `new-${Date.now()}`, title, position: board.columns.length, cards: [] });
      this.boardService.updateBoard(board);
    }
    this.newColumnTitle = '';
    this.addingColumn.set(false);
  }

  cancelColumn(): void {
    this.newColumnTitle = '';
    this.addingColumn.set(false);
  }

  onColumnDeleted(columnId: string): void {
    const board = structuredClone(this.boardService.board()!);
    board.columns = board.columns.filter(c => c.id !== columnId);
    board.columns.forEach((c, i) => c.position = i);
    this.boardService.updateBoard(board);
  }

  onColumnRenamed(columnId: string, title: string): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    col.title = title;
    this.boardService.updateBoard(board);
  }

  onCardDeleted(columnId: string, cardId: string): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    col.cards = col.cards.filter(c => c.id !== cardId);
    col.cards.forEach((c, i) => c.position = i);
    this.boardService.updateBoard(board);
  }
}
