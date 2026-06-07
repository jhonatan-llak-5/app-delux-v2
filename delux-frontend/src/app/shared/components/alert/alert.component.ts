import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

/**
 * Dlx-Alert — banner inline persistente (no efímero como toast).
 *
 * Uso:
 *   <dlx-alert variant="warning" title="Stock limitado"
 *              message="Quedan menos de 5 unidades de esta talla." />
 *
 *   <dlx-alert variant="error" title="Error del servidor"
 *              [dismissible]="true" (closed)="onClosed()">
 *     <p>No pudimos completar tu pedido. Intenta de nuevo.</p>
 *   </dlx-alert>
 *
 * Variantes: info (azul) · success (verde) · warning (ámbar) · error (rojo)
 */
@Component({
  selector: 'dlx-alert',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="alert"
         class="flex items-start gap-3 p-4 rounded-2xl border"
         [ngClass]="{
           'bg-[#0095f6]/8 border-[#0095f6]/25 text-[#0066b3] dark:text-[#7ec5f2]': variant === 'info',
           'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300': variant === 'success',
           'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-300': variant === 'warning',
           'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300': variant === 'error'
         }">

      <!-- Icono -->
      <div class="w-8 h-8 rounded-full grid place-items-center shrink-0"
           [ngClass]="{
             'bg-[#0095f6]/15': variant === 'info',
             'bg-emerald-500/15': variant === 'success',
             'bg-amber-500/15': variant === 'warning',
             'bg-rose-500/15': variant === 'error'
           }">
        <i class="fa-solid text-[13px]"
           [class.fa-circle-info]="variant === 'info'"
           [class.fa-circle-check]="variant === 'success'"
           [class.fa-triangle-exclamation]="variant === 'warning'"
           [class.fa-circle-exclamation]="variant === 'error'"></i>
      </div>

      <!-- Contenido -->
      <div class="flex-1 min-w-0">
        @if (title) {
          <h4 class="font-semibold text-[14px] leading-tight">{{ title }}</h4>
        }
        @if (message) {
          <p class="text-[13px] leading-relaxed opacity-90"
             [class.mt-1]="title">{{ message }}</p>
        }
        <ng-content />
      </div>

      <!-- Cerrar -->
      @if (dismissible) {
        <button type="button" (click)="closed.emit()"
                aria-label="Cerrar"
                class="w-7 h-7 grid place-items-center rounded-full
                       hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0
                       opacity-60 hover:opacity-100">
          <i class="fa-solid fa-xmark text-[12px]"></i>
        </button>
      }
    </div>
  `,
})
export class AlertComponent {
  @Input() variant: AlertVariant = 'info';
  @Input() title = '';
  @Input() message = '';
  @Input() dismissible = false;
  @Output() closed = new EventEmitter<void>();
}
