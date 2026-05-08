import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from '../../models/board.models';

export interface CardEditEvent { title: string; details: string; }

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (editing()) {
      <!-- Edit mode -->
      <div class="bg-white rounded-xl border-2 border-indigo-400 shadow-md p-3 space-y-2">
        <input [(ngModel)]="editTitle"
               class="w-full text-sm font-semibold text-gray-800 outline-none border-b border-gray-200 pb-1
                      focus:border-indigo-400 transition-colors"
               (keydown.escape)="cancel()" />
        <textarea [(ngModel)]="editDetails" rows="2"
                  class="w-full text-xs text-gray-500 resize-none outline-none placeholder-gray-300"
                  placeholder="Add details…"
                  (keydown.escape)="cancel()"></textarea>
        <div class="flex items-center gap-2 pt-1">
          <button (click)="save()"
                  class="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg
                         hover:bg-indigo-700 transition-colors">
            Save
          </button>
          <button (click)="cancel()"
                  class="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors">
            Cancel
          </button>
          <button (click)="deleted.emit()"
                  class="text-xs font-medium text-rose-400 hover:text-rose-600 px-2 py-1.5 ml-auto transition-colors">
            Delete
          </button>
        </div>
      </div>
    } @else {
      <!-- Display mode -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5
                  cursor-pointer hover:shadow-md hover:border-indigo-200
                  transition-all duration-150 group"
           (click)="startEdit()">
        <p class="text-sm font-medium text-gray-800 leading-snug">{{ card().title }}</p>
        @if (card().details) {
          <p class="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{{ card().details }}</p>
        }
        <!-- Edit hint -->
        <div class="flex justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg class="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110.414 16H8v-2.414a2 2 0 01.586-1.414z"/>
          </svg>
        </div>
      </div>
    }
  `
})
export class CardComponent {
  card    = input.required<Card>();
  edited  = output<CardEditEvent>();
  deleted = output<void>();

  editing     = signal(false);
  editTitle   = '';
  editDetails = '';

  startEdit(): void {
    this.editTitle   = this.card().title;
    this.editDetails = this.card().details;
    this.editing.set(true);
  }

  save(): void {
    if (this.editTitle.trim()) {
      this.edited.emit({ title: this.editTitle.trim(), details: this.editDetails });
    }
    this.editing.set(false);
  }

  cancel(): void {
    this.editing.set(false);
  }
}
