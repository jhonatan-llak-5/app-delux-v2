import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { DlxSearchInputComponent } from './search-input.component';
import { InventoryService, DeliverableVariant } from '@features/superadmin/services/inventory.service';
import { Order, OrderItem } from '@features/superadmin/services/order.service';

/**
 * Modal reutilizable de CAMBIO producto-por-producto sobre una venta.
 *
 * <dlx-change-sale-modal [order]="order()" [saving]="saving()"
 *   (confirm)="doChange($event)" (close)="close()" />
 *
 * El cliente DEVUELVE ítems (checks, un check por unidad) y se lleva a cambio
 * ítems NUEVOS (buscador con lector de barras). Las cantidades deben coincidir.
 * Se muestra la diferencia de precio (cliente paga / devolver). El padre maneja
 * la llamada real a la API con el payload emitido en `confirm`.
 */
interface ReturnUnit { key: string; orderItemId: number; label: string; sku: string; unitPrice: number; }
interface DeliverLine { variant: DeliverableVariant; qty: number; }

@Component({
  selector: 'dlx-change-sale-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxSearchInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="close.emit()">
      <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-ink-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
           (click)="$event.stopPropagation()">

        <!-- Cabecera -->
        <div class="p-5 border-b border-slate-100 dark:border-white/10">
          <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <i class="fa-solid fa-right-left text-amber-500"></i> Registrar cambio{{ order?.code ? ' · ' + order?.code : '' }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            El cliente devuelve productos y se lleva otros a cambio. Las cantidades deben coincidir. La venta no se anula.
          </p>
        </div>

        <div class="p-5 space-y-5 overflow-y-auto">
          <!-- 1. Productos que DEVUELVE -->
          <div>
            <div class="eg-label flex items-center justify-between gap-3">
              <span>1. Productos que devuelve el cliente</span>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    [class]="returnedCount() > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'">
                {{ returnedCount() }} seleccionado(s)
              </span>
            </div>
            @if (returnUnits().length === 0) {
              <p class="text-xs text-slate-400 mt-2">No hay unidades disponibles para devolver en esta venta.</p>
            } @else {
              <div class="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                @for (u of returnUnits(); track u.key) {
                  <label class="flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition"
                         [class]="selectedReturns().has(u.key)
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                            : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'">
                    <input type="checkbox" class="w-4 h-4" [checked]="selectedReturns().has(u.key)"
                           (change)="toggleReturn(u.key)" />
                    <span class="flex-1 text-sm text-slate-800 dark:text-slate-100">
                      {{ u.label }}
                      <span class="block text-[11px] text-slate-400">SKU {{ u.sku || '—' }}</span>
                    </span>
                    <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ u.unitPrice | currency:'USD':'symbol':'1.2-2' }}</span>
                  </label>
                }
              </div>
            }
          </div>

          <!-- 2. Productos que se LLEVA a cambio -->
          <div>
            <div class="eg-label flex items-center justify-between gap-3">
              <span>2. Productos que se lleva a cambio</span>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    [class]="deliveredCount() === returnedCount() && deliveredCount() > 0
                        ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ deliveredCount() }} de {{ returnedCount() }}
              </span>
            </div>
            <dlx-search-input class="mt-2 block" [fluid]="true" [scanHint]="true"
              placeholder="Escanea o busca el producto nuevo (nombre, SKU, código)…"
              [value]="searchTerm()" (valueChange)="onSearch($event)" />

            @if (searching()) {
              <p class="text-xs text-slate-400 mt-2"><i class="fa-solid fa-spinner fa-spin"></i> Buscando…</p>
            }
            @if (results().length > 0) {
              <div class="mt-2 rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 max-h-40 overflow-y-auto">
                @for (r of results(); track r.id) {
                  <button type="button" (click)="addDeliver(r)"
                          [disabled]="r.branch_qty <= 0"
                          class="w-full flex items-center gap-3 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition">
                    <span class="flex-1 text-sm text-slate-800 dark:text-slate-100">
                      {{ r.product_name }}
                      <span class="block text-[11px] text-slate-400">
                        {{ r.size }} {{ r.color }} · SKU {{ r.sku }} · stock {{ r.branch_qty }}
                      </span>
                    </span>
                    <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ r.price | currency:'USD':'symbol':'1.2-2' }}</span>
                    <i class="fa-solid fa-plus text-emerald-500"></i>
                  </button>
                }
              </div>
            }

            @if (delivered().length > 0) {
              <div class="mt-3 space-y-1.5">
                @for (d of delivered(); track d.variant.id) {
                  <div class="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10">
                    <span class="flex-1 text-sm text-slate-800 dark:text-slate-100">
                      {{ d.variant.product_name }}
                      <span class="block text-[11px] text-slate-400">{{ d.variant.size }} {{ d.variant.color }} · SKU {{ d.variant.sku }}</span>
                    </span>
                    <div class="flex items-center gap-1.5">
                      <button type="button" (click)="decDeliver(d)" class="w-6 h-6 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600">−</button>
                      <span class="w-6 text-center text-sm font-semibold">{{ d.qty }}</span>
                      <button type="button" (click)="incDeliver(d)" [disabled]="d.qty >= d.variant.branch_qty"
                              class="w-6 h-6 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 disabled:opacity-30">+</button>
                    </div>
                    <span class="w-20 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{{ d.variant.price * d.qty | currency:'USD':'symbol':'1.2-2' }}</span>
                    <button type="button" (click)="removeDeliver(d)" class="text-rose-400 hover:text-rose-600"><i class="fa-solid fa-trash-can text-sm"></i></button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Diferencia -->
          <div class="rounded-xl p-4 flex items-center justify-between"
               [class]="diffClass()">
            <div>
              <p class="text-xs opacity-70">Valor devuelto {{ returnedValue() | currency:'USD':'symbol':'1.2-2' }} · Valor entregado {{ deliveredValue() | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="font-bold text-base mt-0.5">{{ diffMessage() }}</p>
            </div>
            <i class="fa-solid text-2xl opacity-80" [class]="diffIcon()"></i>
          </div>

          <!-- Aviso de validación -->
          @if (returnedCount() > 0 && deliveredCount() > 0 && returnedCount() !== deliveredCount()) {
            <div class="rounded-xl p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <i class="fa-solid fa-triangle-exclamation"></i>
              El cliente devuelve {{ returnedCount() }} producto(s), debes entregarle {{ returnedCount() }}. Ahora tienes {{ deliveredCount() }}.
            </div>
          }

          <!-- Fecha + Descripción -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block">
              <span class="eg-label">Fecha del cambio</span>
              <input type="date" [max]="today" [ngModel]="changeDate()" (ngModelChange)="changeDate.set($event)"
                     class="eg-input mt-1 w-full text-sm" />
              <span class="block text-[11px] text-slate-400 mt-1">Déjala vacía para usar la fecha de hoy.</span>
            </label>
            <label class="block">
              <span class="eg-label">Descripción / motivo</span>
              <textarea [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)" rows="2" maxlength="500"
                        placeholder="Ej: talla equivocada / producto defectuoso…"
                        class="eg-input mt-1 w-full resize-none text-sm"></textarea>
            </label>
          </div>
        </div>

        <!-- Acciones -->
        <div class="p-5 pt-0 flex gap-2 border-t border-slate-100 dark:border-white/10 mt-auto pt-4">
          <button (click)="emitConfirm()" [disabled]="!canConfirm()"
                  class="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition">
            @if (saving) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-right-left"></i> }
            Registrar cambio
          </button>
          <button (click)="close.emit()" [disabled]="saving"
                  class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DlxChangeSaleModalComponent implements OnInit {
  private inv = inject(InventoryService);

  @Input({ required: true }) order!: Order | null;
  @Input() saving = false;
  @Output() confirm = new EventEmitter<{
    returned: { order_item_id: number; quantity: number }[];
    delivered: { variant_id: number; quantity: number }[];
    descripcion: string;
    change_date: string;
  }>();
  @Output() close = new EventEmitter<void>();

  returnUnits = signal<ReturnUnit[]>([]);
  selectedReturns = signal<Set<string>>(new Set());
  delivered = signal<DeliverLine[]>([]);
  descripcion = signal('');
  changeDate = signal('');
  readonly today = new Date().toISOString().slice(0, 10);
  searchTerm = signal('');
  results = signal<DeliverableVariant[]>([]);
  searching = signal(false);

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.buildReturnUnits();
    this.search$.pipe(debounceTime(300)).subscribe(q => this.runSearch(q));
  }

  /** Expande cada ítem de la venta en una unidad seleccionable, descontando lo ya devuelto. */
  private buildReturnUnits(): void {
    const o = this.order;
    if (!o) { this.returnUnits.set([]); return; }
    // Unidades ya devueltas por order_item en cambios previos ACTIVOS
    // (los cambios anulados no cuentan: sus unidades volvieron a estar disponibles).
    const already = new Map<number, number>();
    for (const ch of o.changes || []) {
      if (ch.annulled) continue;
      for (const li of ch.returned_items || []) {
        if (li.order_item != null) already.set(li.order_item, (already.get(li.order_item) || 0) + li.quantity);
      }
    }
    const units: ReturnUnit[] = [];
    for (const it of o.items || []) {
      const remaining = it.quantity - (already.get(it.id) || 0);
      const attrs = [it.size, it.color].filter(Boolean).join(' ');
      for (let i = 0; i < remaining; i++) {
        units.push({
          key: `${it.id}-${i}`,
          orderItemId: it.id,
          label: it.product_name + (attrs ? ` · ${attrs}` : ''),
          sku: it.sku,
          unitPrice: Number(it.unit_price || 0),
        });
      }
    }
    this.returnUnits.set(units);
  }

  toggleReturn(key: string): void {
    const s = new Set(this.selectedReturns());
    s.has(key) ? s.delete(key) : s.add(key);
    this.selectedReturns.set(s);
  }

  onSearch(v: string): void { this.searchTerm.set(v); this.search$.next(v); }

  private runSearch(q: string): void {
    const branch = this.order?.branch;
    if (!q || q.trim().length < 2 || !branch) { this.results.set([]); this.searching.set(false); return; }
    this.searching.set(true);
    this.inv.variantSearchDeliverable(q.trim(), branch).subscribe({
      next: r => {
        this.searching.set(false);
        this.results.set(r.results || []);
        // Auto-agrega si hay coincidencia EXACTA de código de barras o SKU (lector).
        const exact = (r.results || []).find(x =>
          x.barcode?.toLowerCase() === q.trim().toLowerCase() || x.sku?.toLowerCase() === q.trim().toLowerCase());
        if (exact && exact.branch_qty > 0) { this.addDeliver(exact); this.searchTerm.set(''); this.results.set([]); }
      },
      error: () => { this.searching.set(false); this.results.set([]); },
    });
  }

  addDeliver(v: DeliverableVariant): void {
    if (v.branch_qty <= 0) return;
    const list = [...this.delivered()];
    const found = list.find(d => d.variant.id === v.id);
    if (found) { if (found.qty < v.branch_qty) found.qty++; }
    else list.push({ variant: v, qty: 1 });
    this.delivered.set(list);
    this.searchTerm.set(''); this.results.set([]);
  }
  incDeliver(d: DeliverLine): void {
    if (d.qty >= d.variant.branch_qty) return;
    this.delivered.set(this.delivered().map(x => x === d ? { ...x, qty: x.qty + 1 } : x));
  }
  decDeliver(d: DeliverLine): void {
    const list = this.delivered().map(x => x === d ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty > 0);
    this.delivered.set(list);
  }
  removeDeliver(d: DeliverLine): void { this.delivered.set(this.delivered().filter(x => x !== d)); }

  returnedCount = computed(() => this.selectedReturns().size);
  deliveredCount = computed(() => this.delivered().reduce((s, d) => s + d.qty, 0));
  returnedValue = computed(() => {
    const sel = this.selectedReturns();
    return this.returnUnits().filter(u => sel.has(u.key)).reduce((s, u) => s + u.unitPrice, 0);
  });
  deliveredValue = computed(() => this.delivered().reduce((s, d) => s + d.variant.price * d.qty, 0));
  difference = computed(() => +(this.deliveredValue() - this.returnedValue()).toFixed(2));

  canConfirm = computed(() =>
    !this.saving && this.returnedCount() > 0 && this.deliveredCount() > 0 &&
    this.returnedCount() === this.deliveredCount());

  diffMessage(): string {
    const d = this.difference();
    if (this.returnedCount() === 0 || this.deliveredCount() === 0) return 'Selecciona los productos del cambio';
    if (d > 0) return `El cliente debe pagar ${d.toFixed(2)} adicional`;
    if (d < 0) return `Debes devolver ${Math.abs(d).toFixed(2)} al cliente`;
    return 'Sin diferencia de precio';
  }
  diffClass(): string {
    const d = this.difference();
    if (this.returnedCount() === 0 || this.deliveredCount() === 0) return 'bg-slate-100 dark:bg-white/5 text-slate-500';
    if (d > 0) return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (d < 0) return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300';
    return 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300';
  }
  diffIcon(): string {
    const d = this.difference();
    if (d > 0) return 'fa-arrow-down text-emerald-500';
    if (d < 0) return 'fa-arrow-up text-rose-500';
    return 'fa-equals';
  }

  emitConfirm(): void {
    if (!this.canConfirm()) return;
    // Agrupa las unidades seleccionadas por order_item.
    const sel = this.selectedReturns();
    const byItem = new Map<number, number>();
    for (const u of this.returnUnits()) {
      if (sel.has(u.key)) byItem.set(u.orderItemId, (byItem.get(u.orderItemId) || 0) + 1);
    }
    const returned = Array.from(byItem.entries()).map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
    const delivered = this.delivered().map(d => ({ variant_id: d.variant.id, quantity: d.qty }));
    this.confirm.emit({ returned, delivered, descripcion: this.descripcion().trim(), change_date: this.changeDate() });
  }
}
