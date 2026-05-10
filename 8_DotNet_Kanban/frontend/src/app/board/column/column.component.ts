import { Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Column, Card, CardPriority } from '../../models/board.models';
import { CardComponent, CardEditEvent } from '../card/card.component';

export interface CardAddedEvent { title: string; details: string; priority: CardPriority; label: string; dueDate: string | null; }
export interface CardEditedEvent { cardId: string; title: string; details: string; priority: CardPriority; label: string; dueDate: string | null; }

// Written out explicitly so Tailwind includes them
const ACCENT_BORDERS  = ['border-t-indigo-500', 'border-t-amber-500', 'border-t-emerald-500', 'border-t-violet-500', 'border-t-rose-500'];
const ACCENT_BADGES   = ['bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700'];

@Component({
  selector: 'app-column',
  standalone: true,
  imports: [NgClass, FormsModule, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragHandle, CardComponent],
  template: `
    <div class="w-72 flex-shrink-0 bg-white/80 backdrop-blur rounded-2xl shadow-sm
                border border-white flex flex-col max-h-full border-t-4"
         [ngClass]="accentBorder()">

      <!-- Column header -->
      <div class="flex items-center gap-2 px-4 pt-4 pb-2">

        @if (!editingTitle()) {
          <div cdkDragHandle
               class="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="5.5" cy="3" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="5.5" cy="13" r="1.2"/>
              <circle cx="10.5" cy="3" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="10.5" cy="13" r="1.2"/>
            </svg>
          </div>
        }

        @if (editingTitle()) {
          <input #titleInput
                 [(ngModel)]="editTitle"
                 class="flex-1 min-w-0 text-sm font-semibold text-gray-800 outline-none
                        border-b border-indigo-400 bg-transparent pb-0.5"
                 (keydown.enter)="saveTitle()"
                 (keydown.escape)="cancelTitle()"
                 (blur)="saveTitle()" />
        } @else {
          <h2 class="flex-1 min-w-0 font-semibold text-gray-800 text-sm tracking-tight truncate
                     cursor-pointer hover:text-indigo-600 transition-colors"
              title="Click to rename"
              (click)="startEditTitle()">{{ column().title }}</h2>
        }

        @if (!editingTitle()) {
          <div class="flex items-center gap-1 flex-shrink-0">
            @if (column().cards.length === 0) {
              <button (click)="columnDeleted.emit()"
                      title="Delete column"
                      class="w-5 h-5 flex items-center justify-center rounded text-gray-300
                             hover:text-rose-400 hover:bg-rose-50 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            }
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" [ngClass]="accentBadge()">
              {{ column().cards.length }}
            </span>
          </div>
        }

      </div>

      <!-- Cards drop zone -->
      <div class="flex-1 flex flex-col gap-2 overflow-y-auto px-3 pb-2 min-h-[60px]"
           cdkDropList
           [id]="column().id"
           [cdkDropListData]="column().cards"
           [cdkDropListConnectedTo]="connectedTo()"
           (cdkDropListDropped)="dropped.emit($event)">

        @if (column().cards.length === 0 && !addingCard()) {
          <div class="flex items-center justify-center h-16 text-gray-300 text-xs border-2 border-dashed border-gray-200 rounded-xl">
            Drop cards here
          </div>
        }

        @for (card of column().cards; track card.id) {
          <div cdkDrag [cdkDragData]="card" class="group">
            <app-card
              [card]="card"
              (edited)="onCardEdited(card.id, $event)"
              (deleted)="cardDeleted.emit(card.id)" />
            <div *cdkDragPlaceholder
                 class="h-14 rounded-xl bg-indigo-50 border-2 border-dashed border-indigo-200"></div>
          </div>
        }
      </div>

      <!-- Add card -->
      <div class="px-3 pb-3">
        @if (addingCard()) {
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-2">
            <input [(ngModel)]="newCardTitle"
                   autofocus
                   class="w-full text-sm font-medium text-gray-800 outline-none placeholder-gray-400
                          border-b border-gray-100 pb-1.5 focus:border-indigo-300 transition-colors"
                   placeholder="Card title…"
                   (keydown.escape)="cancelAdd()" />
            <textarea [(ngModel)]="newCardDetails" rows="2"
                      class="w-full text-xs text-gray-500 resize-none outline-none placeholder-gray-300"
                      placeholder="Details (optional)…"
                      (keydown.escape)="cancelAdd()"></textarea>
            <div class="flex gap-2 flex-wrap">
              <select [(ngModel)]="newCardPriority"
                      class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <input [(ngModel)]="newCardLabel" type="text"
                     class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 flex-1 min-w-0"
                     placeholder="Label" />
            </div>
            <div class="flex gap-2">
              <button (click)="submitCard()"
                      class="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
                Add card
              </button>
              <button (click)="cancelAdd()"
                      class="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        } @else {
          <button (click)="addingCard.set(true)"
                  class="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-indigo-600
                         hover:bg-indigo-50 rounded-xl px-3 py-2 transition-all duration-150">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add card
          </button>
        }
      </div>
    </div>
  `
})
export class ColumnComponent {
  @ViewChild('titleInput') private titleInputRef?: ElementRef<HTMLInputElement>;

  column      = input.required<Column>();
  colIndex    = input<number>(0);
  connectedTo = input<string[]>([]);

  dropped       = output<CdkDragDrop<Card[]>>();
  cardAdded     = output<CardAddedEvent>();
  cardEdited    = output<CardEditedEvent>();
  cardDeleted   = output<string>();
  columnDeleted = output<void>();
  columnRenamed = output<string>();

  addingCard     = signal(false);
  editingTitle   = signal(false);
  newCardTitle   = '';
  newCardDetails = '';
  newCardPriority: CardPriority = 'Medium';
  newCardLabel   = '';
  editTitle      = '';

  accentBorder = computed(() => ACCENT_BORDERS[this.colIndex() % ACCENT_BORDERS.length]);
  accentBadge  = computed(() => ACCENT_BADGES[this.colIndex()  % ACCENT_BADGES.length]);

  startEditTitle(): void {
    this.editTitle = this.column().title;
    this.editingTitle.set(true);
    setTimeout(() => this.titleInputRef?.nativeElement.focus(), 0);
  }

  saveTitle(): void {
    if (!this.editingTitle()) return;
    const title = this.editTitle.trim();
    if (title && title !== this.column().title) this.columnRenamed.emit(title);
    this.editingTitle.set(false);
  }

  cancelTitle(): void {
    this.editingTitle.set(false);
  }

  submitCard(): void {
    const title = this.newCardTitle.trim();
    if (title) this.cardAdded.emit({
      title,
      details: this.newCardDetails.trim(),
      priority: this.newCardPriority,
      label: this.newCardLabel.trim(),
      dueDate: null
    });
    this.newCardTitle   = '';
    this.newCardDetails = '';
    this.newCardPriority = 'Medium';
    this.newCardLabel   = '';
    this.addingCard.set(false);
  }

  cancelAdd(): void {
    this.newCardTitle   = '';
    this.newCardDetails = '';
    this.newCardPriority = 'Medium';
    this.newCardLabel   = '';
    this.addingCard.set(false);
  }

  onCardEdited(cardId: string, edit: CardEditEvent): void {
    this.cardEdited.emit({ cardId, title: edit.title, details: edit.details, priority: edit.priority, label: edit.label, dueDate: edit.dueDate });
  }
}
