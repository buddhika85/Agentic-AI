import { Component, input, output, signal, computed } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card, CardPriority, UserSummary } from '../../models/board.models';

export interface CardEditEvent {
  title: string;
  details: string;
  priority: CardPriority;
  label: string;
  dueDate: string | null;
  assignedToUserId: number | null;
}

const PRIORITY_STYLES: Record<CardPriority, string> = {
  Low:    'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-rose-100 text-rose-700'
};

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [FormsModule, NgClass, DatePipe],
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

        <div class="flex gap-2 flex-wrap">
          <select [(ngModel)]="editPriority"
                  class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <input [(ngModel)]="editLabel" type="text"
                 class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 flex-1 min-w-0"
                 placeholder="Label (e.g. bug, feature)" />
          <input [(ngModel)]="editDueDate" type="date"
                 class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600" />
        </div>

        @if (users().length > 0) {
          <select [(ngModel)]="editAssignedToUserId"
                  class="w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white">
            <option [ngValue]="null">Unassigned</option>
            @for (u of users(); track u.id) {
              <option [ngValue]="u.id">{{ u.username }}</option>
            }
          </select>
        }

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
        <!-- Title row -->
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0">{{ card().title }}</p>
          <span class="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                [ngClass]="priorityStyle()">
            {{ card().priority }}
          </span>
        </div>

        @if (card().details) {
          <p class="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{{ card().details }}</p>
        }

        <!-- Metadata row -->
        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
          @if (card().label) {
            <span class="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">
              {{ card().label }}
            </span>
          }
          @if (card().dueDate) {
            <span class="text-xs text-gray-400 flex items-center gap-1"
                  [class.text-rose-500]="isOverdue()">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {{ card().dueDate | date:'MMM d' }}
            </span>
          }
          @if (card().assignedToUsername) {
            <span class="flex items-center gap-1 ml-auto">
              <span class="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center
                           text-[9px] font-bold text-indigo-700 flex-shrink-0">
                {{ card().assignedToUsername![0].toUpperCase() }}
              </span>
              <span class="text-xs text-gray-400">{{ card().assignedToUsername }}</span>
            </span>
          }
        </div>

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
  users   = input<UserSummary[]>([]);
  edited  = output<CardEditEvent>();
  deleted = output<void>();

  editing              = signal(false);
  editTitle            = '';
  editDetails          = '';
  editPriority: CardPriority = 'Medium';
  editLabel            = '';
  editDueDate          = '';
  editAssignedToUserId: number | null = null;

  priorityStyle = computed(() => PRIORITY_STYLES[this.card().priority ?? 'Medium']);

  isOverdue = computed(() => {
    const due = this.card().dueDate;
    if (!due) return false;
    return new Date(due) < new Date();
  });

  startEdit(): void {
    this.editTitle            = this.card().title;
    this.editDetails          = this.card().details;
    this.editPriority         = this.card().priority ?? 'Medium';
    this.editLabel            = this.card().label ?? '';
    this.editDueDate          = this.card().dueDate ? this.card().dueDate!.substring(0, 10) : '';
    this.editAssignedToUserId = this.card().assignedToUserId ?? null;
    this.editing.set(true);
  }

  save(): void {
    if (this.editTitle.trim()) {
      this.edited.emit({
        title: this.editTitle.trim(),
        details: this.editDetails,
        priority: this.editPriority,
        label: this.editLabel,
        dueDate: this.editDueDate || null,
        assignedToUserId: this.editAssignedToUserId
      });
    }
    this.editing.set(false);
  }

  cancel(): void {
    this.editing.set(false);
  }
}
