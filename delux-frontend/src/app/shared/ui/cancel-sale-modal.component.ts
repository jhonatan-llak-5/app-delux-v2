import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Modal reutilizable para cancelar/anular una venta.
 *
 * <dlx-cancel-sale-modal [code]="o.code" [saving]="cancelling()"
 *   (confirm)="doCancel($event)" (close)="cancelOrder.set(null)" />
 *
 * El padre lo muestra con @if y maneja la llamada real a la API. El componente
 * gestiona su propio estado (motivo + detalle + devolver stock) y lo emite en
 * `confirm`. Al recrearse con @if, el estado arranca limpio.
 */
@Component({
  selector: 'dlx-cancel-sale-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="close.emit()">
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
           (click)="$event.stopPropagation()">
        <div class="p-5 border-b border-slate-100 dark:border-white/10">
          <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <i class="fa-solid fa-ban text-rose-500"></i> Cancelar venta{{ code ? ' ' + code : '' }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Anula la venta internamente. La nota de crédito, si aplica, se emite aparte en NovaFactura.
          </p>
        </div>
        <div class="p-5 space-y-4">
          <label class="block">
            <span class="eg-label">Motivo <span class="text-rose-400">*</span></span>
            <select class="eg-input" [(ngModel)]="reason">
              <option value="">Selecciona un motivo…</option>
              <option value="Devolución">Devolución</option>
              <option value="Producto defectuoso">Producto defectuoso</option>
              <option value="Error de registro">Error de registro</option>
              <option value="Cliente se arrepintió">Cliente se arrepintió</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          @if (reason === 'Otro') {
            <input class="eg-input" [(ngModel)]="detail" placeholder="Describe el motivo…" />
          }
          <label class="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" [(ngModel)]="restoreStock" class="w-4 h-4 mt-0.5" />
            <span class="text-sm text-slate-700 dark:text-slate-200">
              Devolver los productos al inventario
              <span class="block text-[11px] text-slate-400">Actívalo si la mercadería vuelve al stock (no la marques si está defectuosa o no revendible).</span>
            </span>
          </label>
        </div>
        <div class="p-5 pt-0 flex gap-2">
          <button (click)="emitConfirm()" [disabled]="!effectiveReason() || saving"
                  class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition">
            @if (saving) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-ban"></i> }
            Cancelar venta
          </button>
          <button (click)="close.emit()" [disabled]="saving"
                  class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold transition">
            Volver
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DlxCancelSaleModalComponent {
  /** Código de la venta a mostrar en el título (opcional). */
  @Input() code = '';
  /** Estado de carga: deshabilita los botones y muestra el spinner. */
  @Input() saving = false;
  @Output() confirm = new EventEmitter<{ reason: string; restoreStock: boolean }>();
  @Output() close = new EventEmitter<void>();

  reason = '';
  detail = '';
  restoreStock = false;

  /** Motivo final: si eligió "Otro", usa el detalle escrito. */
  effectiveReason(): string {
    return this.reason === 'Otro' ? this.detail.trim() : this.reason;
  }
  emitConfirm(): void {
    const reason = this.effectiveReason();
    if (!reason || this.saving) return;
    this.confirm.emit({ reason, restoreStock: this.restoreStock });
  }
}
