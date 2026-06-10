import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PillColor = 'emerald' | 'amber' | 'violet' | 'blue' | 'rose';

@Component({
  selector: 'dlx-extension-pill',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="toggle.emit()"
            class="rounded-full px-4 py-2 text-xs font-semibold transition"
            [class]="active ? activeClass() : inactiveClass()">
      .{{ label }}
    </button>
  `,
})
export class DlxExtensionPillComponent {
  @Input({ required: true }) label = '';
  @Input() active = false;
  @Input() color: PillColor = 'emerald';
  @Output() toggle = new EventEmitter<void>();

  activeClass() {
    return ({
      emerald: 'bg-emerald-600 text-white',
      amber:   'bg-amber-500 text-white',
      violet:  'bg-violet-600 text-white',
      blue:    'bg-blue-600 text-white',
      rose:    'bg-rose-600 text-white',
    } as Record<PillColor, string>)[this.color];
  }
  inactiveClass() {
    return 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
  }
}
