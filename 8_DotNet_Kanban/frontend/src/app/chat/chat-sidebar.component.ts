import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BoardData } from '../models/board.models';
import { BoardService } from '../board/board.service';

interface Message { role: 'user' | 'assistant'; content: string; }

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <aside class="w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-100 shadow-xl shadow-indigo-900/5">

      <!-- Header -->
      <div class="px-5 py-4 bg-gradient-to-r from-indigo-700 to-purple-700 flex items-center gap-3">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"/>
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-bold text-white">AI Assistant</h2>
          <p class="text-xs text-white/50">Powered by GPT-OSS 120B</p>
        </div>
      </div>

      <!-- Messages -->
      <div #scrollContainer class="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        @if (messages().length === 0) {
          <div class="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg class="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700">Ask me anything</p>
              <p class="text-xs text-gray-400 mt-1">I can create, move, rename,<br>or delete cards and columns.</p>
            </div>
            <!-- Quick suggestions -->
            <div class="w-full space-y-1.5 mt-2">
              @for (s of suggestions; track s) {
                <button (click)="sendSuggestion(s)"
                        class="w-full text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100
                               rounded-lg px-3 py-2 transition-colors border border-indigo-100">
                  {{ s }}
                </button>
              }
            </div>
          </div>
        }

        @for (msg of messages(); track $index) {
          <div [class]="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
            @if (msg.role === 'assistant') {
              <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                          flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z"/>
                </svg>
              </div>
            }
            <div class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                 [class.bg-indigo-600]="msg.role === 'user'"
                 [class.text-white]="msg.role === 'user'"
                 [class.rounded-br-sm]="msg.role === 'user'"
                 [class.bg-gray-100]="msg.role === 'assistant'"
                 [class.text-gray-800]="msg.role === 'assistant'"
                 [class.rounded-bl-sm]="msg.role === 'assistant'">
              {{ msg.content }}
            </div>
          </div>
        }

        @if (loading()) {
          <div class="flex justify-start items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                        flex items-center justify-center flex-shrink-0">
              <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z"/>
              </svg>
            </div>
            <div class="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1 items-center">
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="px-4 py-4 border-t border-gray-100 bg-gray-50/50">
        <div class="flex items-end gap-2 bg-white rounded-2xl border border-gray-200
                    focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20
                    px-3 py-2 shadow-sm transition-all">
          <textarea [(ngModel)]="input"
                    (keydown.enter)="onEnter($event)"
                    [disabled]="loading()"
                    rows="1"
                    class="flex-1 text-sm text-gray-800 resize-none outline-none bg-transparent
                           placeholder-gray-400 max-h-24 leading-relaxed"
                    placeholder="Ask the AI…"></textarea>
          <button (click)="send()"
                  [disabled]="loading() || !input.trim()"
                  class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                         bg-gradient-to-br from-indigo-500 to-purple-600 text-white
                         hover:from-indigo-400 hover:to-purple-500
                         disabled:opacity-40 disabled:cursor-not-allowed
                         shadow-sm shadow-indigo-500/30 transition-all active:scale-95">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
            </svg>
          </button>
        </div>
      </div>

    </aside>
  `
})
export class ChatSidebarComponent {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private boardService = inject(BoardService);

  messages = signal<Message[]>([]);
  input    = '';
  loading  = signal(false);

  readonly suggestions = [
    '✨ Add a card called "Fix login bug" to To Do',
    '🚀 Move all Done cards to In Progress',
    '📋 Add a new column called "Review"',
  ];

  sendSuggestion(text: string): void {
    this.input = text;
    this.send();
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (!e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  async send(): Promise<void> {
    const msg = this.input.trim();
    if (!msg || this.loading()) return;

    this.input = '';
    this.messages.update(m => [...m, { role: 'user', content: msg }]);
    this.loading.set(true);
    this.scrollToBottom();

    try {
      const res = await firstValueFrom(
        this.http.post<{ message: string; board_update: BoardData | null }>('/api/ai/chat', { message: msg })
      );
      this.messages.update(m => [...m, { role: 'assistant', content: res.message }]);
      if (res.board_update) this.boardService.applyAiBoardUpdate(res.board_update);
    } catch (err: any) {
      const detail = err?.error?.detail ?? 'Something went wrong. Please try again.';
      this.messages.update(m => [...m, { role: 'assistant', content: detail }]);
    } finally {
      this.loading.set(false);
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 0);
  }
}
