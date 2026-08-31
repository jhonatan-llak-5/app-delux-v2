import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DlxStep {
  key: string;
  label: string;
  /** Contador opcional sobre el círculo (ej. nº de ítems cargados). */
  badge?: number | null;
}

/**
 * Barra de pasos para flujos guiados (apertura y cierre de caja, recepción…).
 * Mantiene el mismo lenguaje visual del wizard de Recepción: círculo de 44px,
 * "Paso N" + título, y barra de progreso que se llena al avanzar.
 *
 * Solo deja volver a pasos ya completados; nunca saltar hacia adelante.
 *
 * <dlx-stepper [steps]="steps" [current]="step()" (stepClick)="step.set($event)" />
 */
@Component({
  selector: 'dlx-stepper',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center">
      @for (s of steps; track s.key; let i = $index; let last = $last) {
        <button type="button" (click)="select(i)" [disabled]="i > current"
                class="flex items-center gap-3 shrink-0 focus:outline-none disabled:cursor-default">
          <span class="relative grid place-items-center w-11 h-11 rounded-full font-bold text-sm
                       transition-all duration-300"
                [ngClass]="circleCls(i)">
            @if (i < current) { <i class="fa-solid fa-check"></i> } @else { {{ i + 1 }} }

            @if (s.badge) {
              <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 grid place-items-center rounded-full
                           bg-emerald-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-[#0d1320]">
                {{ s.badge }}
              </span>
            }
          </span>

          <div class="text-left hidden sm:block pr-1">
            <p class="text-[10px] font-semibold uppercase tracking-wider transition-colors"
               [ngClass]="i > current
                 ? 'text-slate-400 dark:text-white/30'
                 : 'text-[var(--dash-primary)]'">
              Paso {{ i + 1 }}
            </p>
            <p class="text-sm font-bold leading-tight transition-colors whitespace-nowrap"
               [ngClass]="i > current
                 ? 'text-slate-400 dark:text-white/40'
                 : 'text-slate-800 dark:text-white'">
              {{ s.label }}
            </p>
          </div>
        </button>

        @if (!last) {
          <div class="flex-1 h-1 mx-2 sm:mx-4 rounded-full transition-colors duration-300 min-w-[1.5rem]"
               [ngClass]="i < current ? 'bg-[var(--dash-primary)]' : 'bg-slate-200 dark:bg-white/10'"></div>
        }
      }
    </div>
  `,
})
export class DlxStepperComponent {
  @Input({ required: true }) steps: DlxStep[] = [];
  @Input() current = 0;
  @Output() stepClick = new EventEmitter<number>();

  circleCls(i: number): string {
    if (i === this.current) {
      return 'bg-gradient-to-br from-[var(--dash-primary)] to-[#3b82f6] text-white '
           + 'shadow-lg shadow-[var(--dash-primary)]/30 ring-4 ring-[var(--dash-primary)]/15 scale-105';
    }
    if (i < this.current) {
      return 'bg-[var(--dash-primary)] text-white shadow-md shadow-[var(--dash-primary)]/25';
    }
    return 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10';
  }

  select(i: number): void {
    if (i <= this.current) this.stepClick.emit(i);
  }
}
