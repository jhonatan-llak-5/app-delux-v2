import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-stat-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eg-stat-card">
      <div class="w-11 h-11 rounded-xl grid place-items-center shrink-0" [ngClass]="iconBg">
        <i class="fa-solid {{ icon }} text-[16px]" [ngClass]="iconColor"></i>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/45">
          {{ label }}
        </p>
        <p class="font-bold text-[26px] tracking-tight text-slate-900 dark:text-white leading-none mt-1">
          {{ value }}
        </p>
        @if (delta !== undefined && delta !== null) {
          <p class="text-xs mt-1.5 font-medium"
             [class.text-emerald-600]="delta >= 0" [class.text-rose-600]="delta < 0">
            <i class="fa-solid" [class.fa-arrow-trend-up]="delta >= 0" [class.fa-arrow-trend-down]="delta < 0"></i>
            {{ delta >= 0 ? '+' : '' }}{{ delta }}%
          </p>
        }
      </div>
    </div>
  `,
})
export class DlxStatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input({ required: true }) icon = '';
  @Input() iconBg = 'bg-blue-50 dark:bg-blue-500/15';
  @Input() iconColor = 'text-blue-600 dark:text-blue-400';
  @Input() delta?: number | null;
}
