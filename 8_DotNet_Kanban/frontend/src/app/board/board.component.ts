import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BoardService } from './board.service';
import { AuthService } from '../auth/auth.service';
import { ColumnComponent, CardEditedEvent, CardAddedEvent } from './column/column.component';
import { ChatSidebarComponent } from '../chat/chat-sidebar.component';
import { Card, Column, UserSummary } from '../models/board.models';

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
            <!-- Back to boards -->
            <button (click)="goToBoards()"
                    class="w-7 h-7 flex items-center justify-center rounded-lg text-white/60
                           hover:text-white hover:bg-white/10 transition-all"
                    title="Back to boards">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>

            <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20">
              <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>

            <!-- Board name (editable) -->
            @if (editingBoardName()) {
              <input [(ngModel)]="boardNameEdit"
                     class="bg-white/20 text-white text-base font-bold rounded-lg px-3 py-1 outline-none
                            border border-white/30 focus:border-white/60 w-64"
                     (keydown.enter)="saveBoardName()"
                     (keydown.escape)="cancelBoardName()"
                     (blur)="saveBoardName()" />
            } @else {
              <h1 class="text-base font-bold text-white tracking-tight cursor-pointer hover:text-white/80"
                  title="Click to rename board"
                  (click)="startEditBoardName()">
                {{ boardService.board()?.name ?? 'Loading…' }}
              </h1>
            }
          </div>

          <div class="flex items-center gap-3">
            <!-- Search -->
            <div class="relative">
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input [(ngModel)]="searchQuery"
                     class="bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs
                            rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-white/40 w-44 transition-all"
                     placeholder="Search cards…" />
              @if (searchQuery) {
                <button (click)="searchQuery = ''"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              }
            </div>

            @if (searchQuery) {
              <span class="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-lg">
                {{ matchCount() }} match{{ matchCount() === 1 ? '' : 'es' }}
              </span>
            }

            <button (click)="logout()"
                    class="flex items-center gap-2 text-sm text-white/70 hover:text-white
                           bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
              </svg>
              Logout
            </button>
          </div>
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
            @for (col of filteredColumns(); track col.id; let i = $index) {
              <div cdkDrag [cdkDragData]="col" class="flex-shrink-0">
                <app-column
                  [column]="col"
                  [colIndex]="i"
                  [connectedTo]="columnIds"
                  [users]="users()"
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

            <!-- Add column (hidden at limit, hidden during search) -->
            @if (boardService.board()!.columns.length < 5 && !searchQuery) {
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
            }
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  addingColumn     = signal(false);
  editingBoardName = signal(false);
  newColumnTitle   = '';
  boardNameEdit    = '';
  searchQuery      = '';
  users            = signal<UserSummary[]>([]);

  filteredColumns = computed(() => {
    const board = this.boardService.board();
    if (!board) return [];
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return board.columns;

    return board.columns.map(col => ({
      ...col,
      cards: col.cards.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.details.toLowerCase().includes(q) ||
        (c.assignedToUsername?.toLowerCase().includes(q) ?? false)
      )
    }));
  });

  matchCount = computed(() =>
    this.filteredColumns().reduce((n, col) => n + col.cards.length, 0)
  );

  async ngOnInit(): Promise<void> {
    const boardId = this.route.snapshot.paramMap.get('id');
    await this.boardService.loadBoard(boardId ?? undefined);
    this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    try {
      const list = await firstValueFrom(this.http.get<UserSummary[]>('/api/users'));
      this.users.set(list);
    } catch { /* non-critical */ }
  }

  goToBoards(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
  }

  startEditBoardName(): void {
    this.boardNameEdit = this.boardService.board()?.name ?? '';
    this.editingBoardName.set(true);
  }

  saveBoardName(): void {
    if (!this.editingBoardName()) return;
    const name = this.boardNameEdit.trim();
    if (name && name !== this.boardService.board()?.name) {
      const board = structuredClone(this.boardService.board()!);
      board.name = name;
      this.boardService.updateBoard(board);
    }
    this.editingBoardName.set(false);
  }

  cancelBoardName(): void {
    this.editingBoardName.set(false);
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

  onCardAdded(columnId: string, event: CardAddedEvent): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    col.cards.push({
      id: `new-${Date.now()}`,
      title: event.title,
      details: event.details,
      position: col.cards.length,
      priority: event.priority,
      label: event.label,
      dueDate: event.dueDate,
      assignedToUserId: event.assignedToUserId,
      assignedToUsername: event.assignedToUserId
        ? (this.users().find(u => u.id === event.assignedToUserId)?.username ?? null)
        : null
    });
    this.boardService.updateBoard(board);
  }

  onCardEdited(columnId: string, event: CardEditedEvent): void {
    const board = structuredClone(this.boardService.board()!);
    const col = board.columns.find(c => c.id === columnId)!;
    const card = col.cards.find(c => c.id === event.cardId)!;
    card.title = event.title;
    card.details = event.details;
    card.priority = event.priority;
    card.label = event.label;
    card.dueDate = event.dueDate;
    card.assignedToUserId = event.assignedToUserId;
    card.assignedToUsername = event.assignedToUserId
      ? (this.users().find(u => u.id === event.assignedToUserId)?.username ?? null)
      : null;
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
