import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DlxTab { id: string; label: string; icon?: string; }

@Component({
  selector: 'dlx-tabs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#334155] overflow-x-auto scrollbar-hide">
      @for (t of tabs; track t.id) {
        <button type="button" (click)="select(t.id)"
                class="px-4 py-2.5 text-sm font-semibold transition flex items-center gap-2 shrink-0"
                [class.border-b-2]="active === t.id"
                [class.border-[#1e40af]]="active === t.id"
                [class.text-[#1e3a8a]]="active === t.id"
                [class.dark:text-blue-300]="active === t.id"
                [class.dark:border-blue-500]="active === t.id"
                [class.text-slate-500]="active !== t.id"
                [class.dark:text-slate-400]="active !== t.id"
                [class.hover:text-slate-700]="active !== t.id">
          @if (t.icon) { <i class="fa-solid {{ t.icon }} text-[12px]"></i> }
          {{ t.label }}
        </button>
      }
    </nav>
  `,
})
export class DlxTabsComponent {
  @Input({ required: true }) tabs: DlxTab[] = [];
  @Input({ required: true }) active = '';
  @Output() activeChange = new EventEmitter<string>();

  select(id: string) {
    this.active = id;
    this.activeChange.emit(id);
  }
}
