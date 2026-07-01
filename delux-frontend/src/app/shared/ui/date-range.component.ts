import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DateRangeValue { from?: string; to?: string; }

@Component({
  selector: 'dlx-date-range',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (p of presets; track p.key) {
        <button type="button" (click)="pick(p.key)"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                [ngClass]="active() === p.key
                  ? 'bg-[var(--dash-primary)] text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'">
          {{ p.label }}
        </button>
      }
      @if (active() === 'custom') {
        <input type="date" [(ngModel)]="from" (change)="emitCustom()" class="eg-input !py-1.5 text-xs !w-auto" />
        <span class="text-slate-400 text-xs">a</span>
        <input type="date" [(ngModel)]="to" (change)="emitCustom()" class="eg-input !py-1.5 text-xs !w-auto" />
      }
    </div>
  `,
})
export class DlxDateRangeComponent {
  @Output() changed = new EventEmitter<DateRangeValue>();

  presets = [
    { key: 'all', label: 'Todo' },
    { key: '7', label: '7 días' },
    { key: '30', label: '30 días' },
    { key: '90', label: '90 días' },
    { key: 'custom', label: 'Personalizado' },
  ];
  active = signal<string>('all');
  from = '';
  to = '';

  pick(key: string): void {
    this.active.set(key);
    if (key === 'custom') return;
    if (key === 'all') { this.changed.emit({}); return; }
    const days = +key;
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    this.changed.emit({ from: this.iso(from), to: this.iso(to) });
  }

  emitCustom(): void {
    if (this.from && this.to) this.changed.emit({ from: this.from, to: this.to });
  }

  private iso(d: Date): string { return d.toISOString().slice(0, 10); }
}
