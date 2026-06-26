import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Stock, InventoryService } from '@features/superadmin/services/inventory.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-stock-adjust-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="onBackdrop($event)">
      <div class="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-bold tracking-tight">Ajustar stock</h2>
          <button type="button" (click)="close.emit()" class="w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="px-6 py-5 space-y-4">
          <div class="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <img [src]="stock.product_main_image" [alt]="stock.product_name"
                 class="w-14 h-14 rounded-lg object-cover bg-white"
                 crossorigin="anonymous" (error)="onImgErr($event)" />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate">{{ stock.product_name }}</p>
              <p class="text-xs text-slate-500 font-mono">
                {{ stock.variant_sku }} · {{ stock.variant_size }} · {{ stock.variant_color }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">
                <i class="fa-solid fa-location-dot"></i> {{ stock.branch_name }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="p-3 rounded-lg bg-slate-50">
              <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Actual</p>
              <p class="text-xl font-bold mt-1">{{ stock.quantity }}</p>
            </div>
            <div class="p-3 rounded-lg bg-violet-50">
              <p class="text-[10px] uppercase tracking-widest text-violet-600 font-semibold">Cambio</p>
              <p class="text-xl font-bold mt-1 text-violet-700"
                 [class.text-emerald-700]="delta() > 0"
                 [class.text-rose-700]="delta() < 0">
                {{ delta() > 0 ? '+' : '' }}{{ delta() }}
              </p>
            </div>
            <div class="p-3 rounded-lg bg-emerald-50">
              <p class="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">Resultado</p>
              <p class="text-xl font-bold mt-1 text-emerald-700">{{ resultQty() }}</p>
            </div>
          </div>

          <div>
            <label class="eg-label">Operación</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" (click)="setType('IN')"
                      class="px-3 py-2 rounded-lg text-xs font-semibold border transition"
                      [class.bg-emerald-100]="type() === 'IN'"
                      [class.border-emerald-400]="type() === 'IN'"
                      [class.text-emerald-700]="type() === 'IN'"
                      [class.border-slate-200]="type() !== 'IN'"
                      [class.text-slate-600]="type() !== 'IN'">
                <i class="fa-solid fa-arrow-down"></i> Entrada
              </button>
              <button type="button" (click)="setType('OUT')"
                      class="px-3 py-2 rounded-lg text-xs font-semibold border transition"
                      [class.bg-rose-100]="type() === 'OUT'"
                      [class.border-rose-400]="type() === 'OUT'"
                      [class.text-rose-700]="type() === 'OUT'"
                      [class.border-slate-200]="type() !== 'OUT'"
                      [class.text-slate-600]="type() !== 'OUT'">
                <i class="fa-solid fa-arrow-up"></i> Salida
              </button>
              <button type="button" (click)="setType('ADJ')"
                      class="px-3 py-2 rounded-lg text-xs font-semibold border transition"
                      [class.bg-amber-100]="type() === 'ADJ'"
                      [class.border-amber-400]="type() === 'ADJ'"
                      [class.text-amber-700]="type() === 'ADJ'"
                      [class.border-slate-200]="type() !== 'ADJ'"
                      [class.text-slate-600]="type() !== 'ADJ'">
                <i class="fa-solid fa-pen"></i> Ajuste
              </button>
            </div>
          </div>

          <div>
            <label class="eg-label">Cantidad</label>
            <div class="flex items-center gap-2">
              <button type="button" (click)="absQty.set(Math.max(1, absQty() - 1))"
                      class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center">
                <i class="fa-solid fa-minus text-sm"></i>
              </button>
              <input type="number" [ngModel]="absQty()" (ngModelChange)="absQty.set(+$event || 0)"
                     min="1"
                     class="eg-input flex-1 text-center text-lg font-bold" />
              <button type="button" (click)="absQty.set(absQty() + 1)"
                      class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center">
                <i class="fa-solid fa-plus text-sm"></i>
              </button>
            </div>
          </div>

          <div>
            <label class="eg-label">Nota (opcional)</label>
            <input [(ngModel)]="note" maxlength="240"
                   class="eg-input"
                   placeholder="ej. Recepción de pedido #1234" />
          </div>

          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" (click)="close.emit()"
                    class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
              Cancelar
            </button>
            <button type="button" (click)="save()" [disabled]="absQty() < 1 || saving()"
                    class="px-5 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold
                           hover:bg-ink-900 disabled:opacity-50 transition">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-check"></i> Aplicar }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class StockAdjustModalComponent {
  private svc = inject(InventoryService);
  Math = Math;

  @Input({ required: true }) stock!: Stock;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<number>();

  type = signal<'IN' | 'OUT' | 'ADJ'>('IN');
  absQty = signal(1);
  note = '';
  saving = signal(false);
  error = signal<string | null>(null);

  setType(t: 'IN' | 'OUT' | 'ADJ') { this.type.set(t); }

  delta() {
    const t = this.type();
    if (t === 'OUT') return -this.absQty();
    return this.absQty();
  }

  resultQty() {
    return Math.max(0, this.stock.quantity + this.delta());
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    this.svc.adjust(this.stock.id, this.delta(), this.note, this.type()).subscribe({
      next: r => { this.saving.set(false); this.saved.emit(r.quantity); },
      error: e => {
        this.saving.set(false);
        this.error.set(parseApiError(e).message || 'Error al ajustar');
      },
    });
  }

  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.close.emit(); }
  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
