import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BoardService } from '../board.service';
import { AuthService } from '../../auth/auth.service';
import { BoardSummary } from '../../models/board.models';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50">

      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4
                     bg-gradient-to-r from-indigo-700 to-purple-700
                     shadow-lg shadow-indigo-900/30">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h1 class="text-base font-bold text-white tracking-tight">Kanban Studio</h1>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-white/60 text-sm">{{ auth.username() }}</span>
          @if (auth.isAdmin()) {
            <button (click)="goToAdmin()"
                    class="flex items-center gap-2 text-sm text-white/70 hover:text-white
                           bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              Admin
            </button>
          }
          <button (click)="auth.logout()"
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

      <!-- Content -->
      <main class="max-w-4xl mx-auto p-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">My Boards</h2>
            <p class="text-gray-500 text-sm mt-1">{{ boardService.boards().length }} board{{ boardService.boards().length !== 1 ? 's' : '' }}</p>
          </div>

          @if (!creating()) {
            <button (click)="creating.set(true)"
                    class="flex items-center gap-2 text-sm font-semibold bg-indigo-600 text-white
                           px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              New Board
            </button>
          }
        </div>

        <!-- Create form -->
        @if (creating()) {
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Create New Board</h3>
            <div class="flex gap-3">
              <input [(ngModel)]="newBoardName"
                     autofocus
                     class="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none
                            focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                     placeholder="Board name…"
                     (keydown.enter)="createBoard()"
                     (keydown.escape)="cancelCreate()" />
              <button (click)="createBoard()" [disabled]="creatingLoading()"
                      class="text-sm font-semibold bg-indigo-600 text-white px-5 py-2.5 rounded-xl
                             hover:bg-indigo-700 disabled:opacity-50 transition-all">
                Create
              </button>
              <button (click)="cancelCreate()"
                      class="text-sm text-gray-400 hover:text-gray-600 px-3 py-2.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        }

        <!-- Board grid -->
        @if (loading()) {
          <div class="flex items-center justify-center py-20 text-indigo-400">
            <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        } @else if (boardService.boards().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
              </svg>
            </div>
            <p class="text-gray-500 text-sm">No boards yet. Create your first board!</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (board of boardService.boards(); track board.id) {
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5
                          hover:shadow-md hover:border-indigo-200 transition-all duration-150 group">
                <div class="flex items-start justify-between mb-3">
                  <h3 class="font-semibold text-gray-800 text-base leading-tight flex-1 min-w-0 pr-2">
                    {{ board.name }}
                  </h3>
                  <button (click)="confirmDelete(board, $event)"
                          class="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg
                                 text-gray-300 hover:text-rose-400 hover:bg-rose-50
                                 opacity-0 group-hover:opacity-100 transition-all">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>

                <div class="flex items-center gap-3 text-xs text-gray-400 mb-4">
                  <span class="flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    {{ board.cardCount }} card{{ board.cardCount !== 1 ? 's' : '' }}
                  </span>
                  <span>Updated {{ board.updatedAt | date:'MMM d' }}</span>
                </div>

                <button (click)="openBoard(board)"
                        class="w-full text-xs font-semibold text-indigo-600 bg-indigo-50
                               hover:bg-indigo-100 rounded-xl py-2 transition-colors">
                  Open Board →
                </button>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `
})
export class BoardListComponent implements OnInit {
  boardService = inject(BoardService);
  auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  creating = signal(false);
  creatingLoading = signal(false);
  newBoardName = '';

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    await this.boardService.listBoards();
    this.loading.set(false);
  }

  openBoard(board: BoardSummary): void {
    this.router.navigate(['/boards', board.id]);
  }

  async createBoard(): Promise<void> {
    const name = this.newBoardName.trim();
    if (!name) return;

    this.creatingLoading.set(true);
    const summary = await this.boardService.createBoard(name);
    this.creatingLoading.set(false);
    this.newBoardName = '';
    this.creating.set(false);
    this.router.navigate(['/boards', summary.id]);
  }

  cancelCreate(): void {
    this.newBoardName = '';
    this.creating.set(false);
  }

  async confirmDelete(board: BoardSummary, event: Event): Promise<void> {
    event.stopPropagation();
    if (confirm(`Delete "${board.name}"? This cannot be undone.`)) {
      await this.boardService.deleteBoard(board.id);
    }
  }

  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
