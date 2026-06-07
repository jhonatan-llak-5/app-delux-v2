import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-ui-kpi-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-5">
      <div class="flex items-center justify-between">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">{{ label }}</p>
        @if (icon) {
          <div class="w-9 h-9 rounded-lg grid place-items-center"
               [ngClass]="iconBg ?? 'bg-slate-100 text-slate-600'">
            <i class="fa-solid {{ icon }} text-sm"></i>
          </div>
        }
      </div>
      <p class="mt-3 text-2xl md:text-3xl font-bold tracking-tight">{{ value }}</p>
      @if (delta !== undefined) {
        <div class="mt-2 flex items-center gap-1.5 text-xs font-semibold"
             [class.text-emerald-600]="delta >= 0"
             [class.text-rose-600]="delta < 0">
          <i class="fa-solid" [class.fa-arrow-trend-up]="delta >= 0" [class.fa-arrow-trend-down]="delta < 0"></i>
          <span>{{ delta >= 0 ? '+' : '' }}{{ delta }}%</span>
          <span class="text-slate-400 font-normal">vs mes anterior</span>
        </div>
      }
    </div>
  `,
})
export class UiKpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string;
  @Input() delta?: number;
  /** Clase FA, ej "fa-dollar-sign" */
  @Input() icon?: string;
  @Input() iconBg?: string;
}
