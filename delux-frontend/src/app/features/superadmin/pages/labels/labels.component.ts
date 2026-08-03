import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { BranchContextService } from '@core/services/branch-context.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { printProductLabels, LabelItem } from '@shared/utils/print-labels';

@Component({
  selector: 'dlx-labels',
  standalone: true,
  imports: [CommonModule, FormsModule, ImgFallbackDirective, DlxSearchInputComponent, DlxEmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-4 md:px-6 py-6 space-y-5">
      <!-- Header -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <i class="fa-solid fa-barcode"></i>
            <span class="uppercase tracking-widest font-semibold">Inventario</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Etiquetas</h1>
          <p class="text-slate-500 text-sm mt-1">Busca productos, elige cuáles imprimir y genera las etiquetas en lote.</p>
        </div>
        <button type="button" (click)="print()" [disabled]="selected().size === 0"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-d)] text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
          <i class="fa-solid fa-print"></i> Imprimir ({{ totalLabels() }})
        </button>
      </div>

      <!-- Buscador -->
      <div class="flex flex-wrap items-center gap-3">
        <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)"
                          placeholder="Buscar por nombre, código o color…" class="flex-1 min-w-64" />
        @if (selected().size) {
          <span class="text-sm text-slate-500">{{ selected().size }} seleccionado(s) · {{ totalLabels() }} etiqueta(s)</span>
          <button type="button" (click)="clearSel()" class="text-sm font-semibold text-slate-500 hover:text-ink-950 dark:hover:text-white">Limpiar</button>
        }
      </div>

      <!-- Tabla -->
      <div class="card overflow-hidden">
        @if (loading()) {
          <div class="p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i><p>Cargando…</p></div>
        } @else if (!stocks().length) {
          <dlx-empty-state icon="fa-barcode" title="No hay productos con esos filtros." />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                <tr class="text-left">
                  <th class="px-4 py-3 w-10">
                    <input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" class="w-4 h-4 accent-[var(--dash-primary)]" />
                  </th>
                  <th class="px-4 py-3 font-semibold">Producto</th>
                  @if (showBranchCol()) { <th class="px-4 py-3 font-semibold">Sucursal</th> }
                  <th class="px-4 py-3 font-semibold text-right">Precio</th>
                  <th class="px-4 py-3 font-semibold text-center w-28">Copias</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5 align-middle">
                @for (s of stocks(); track s.id) {
                  <tr class="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                      [ngClass]="isSel(s.id) ? 'bg-[var(--dash-primary)]/5' : ''">
                    <td class="px-4 py-3">
                      <input type="checkbox" [checked]="isSel(s.id)" (change)="toggle(s.id)" class="w-4 h-4 accent-[var(--dash-primary)]" />
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <img [src]="s.product_main_image" [alt]="s.product_name" class="w-9 h-9 rounded-lg object-cover bg-slate-100 shrink-0" dlxImgFallback />
                        <div class="min-w-0">
                          <p class="font-medium truncate">{{ s.product_name }}</p>
                          <p class="text-[11px] text-slate-500 truncate">{{ s.category_name }} · {{ s.brand_name }}</p>
                          <p class="text-[11px] text-slate-400 font-mono">{{ s.variant_sku }} · {{ s.variant_size || '—' }} / {{ s.variant_color || '—' }}</p>
                        </div>
                      </div>
                    </td>
                    @if (showBranchCol()) {
                      <td class="px-4 py-3 text-xs"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>{{ s.branch_name }}</td>
                    }
                    <td class="px-4 py-3 text-right font-semibold">\${{ price(s) | number:'1.2-2' }}</td>
                    <td class="px-4 py-3 text-center">
                      <input type="number" min="1" [ngModel]="copiesOf(s.id)" (ngModelChange)="setCopies(s.id, $event)"
                             class="eg-input !h-9 w-20 text-center text-sm" [disabled]="!isSel(s.id)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
      <p class="text-[11px] text-slate-400">La etiqueta (50×30 mm) incluye el nombre, el código interno como código de barras y el precio con IVA.</p>
    </div>
  `,
})
export class LabelsComponent {
  private inv = inject(InventoryService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  ctx = inject(BranchContextService);

  loading = signal(true);
  stocks = signal<Stock[]>([]);
  search = signal('');
  /** ¿Mostrar columna Sucursal? Solo si el usuario puede cambiar de sucursal. */
  showBranchCol = computed(() => this.ctx.canSwitch());
  selected = signal<Set<number>>(new Set());
  private copies = signal<Record<number, number>>({});

  constructor() {
    effect(() => { this.search(); this.ctx.current(); this.load(); }, { allowSignalWrites: true });
  }

  load(): void {
    this.loading.set(true);
    this.inv.stocks({
      search: this.search().trim() || undefined,
      branch: this.ctx.current() ?? undefined,
      page_size: 200,
    }).subscribe({
      next: r => { this.stocks.set(r.results); this.loading.set(false); },
      error: () => { this.stocks.set([]); this.loading.set(false); },
    });
  }

  onSearch(v: string): void { this.search.set(v); }
  price(s: Stock): number { return s.price_override != null ? +s.price_override : (+s.base_price || 0); }

  isSel(id: number): boolean { return this.selected().has(id); }
  toggle(id: number): void {
    const n = new Set(this.selected());
    if (n.has(id)) n.delete(id); else { n.add(id); this.setCopies(id, this.copiesOf(id)); }
    this.selected.set(n);
  }
  allSelected(): boolean { const s = this.stocks(); return s.length > 0 && s.every(x => this.selected().has(x.id)); }
  toggleAll(): void {
    if (this.allSelected()) { this.selected.set(new Set()); }
    else { this.selected.set(new Set(this.stocks().map(x => x.id))); }
  }
  clearSel(): void { this.selected.set(new Set()); }

  copiesOf(id: number): number { return this.copies()[id] ?? 1; }
  setCopies(id: number, v: any): void {
    const n = Math.max(1, Math.floor(+v || 1));
    this.copies.set({ ...this.copies(), [id]: n });
  }
  totalLabels = computed(() => {
    let t = 0;
    for (const id of this.selected()) t += this.copiesOf(id);
    return t;
  });

  print(): void {
    const ids = this.selected();
    const items: LabelItem[] = this.stocks()
      .filter(s => ids.has(s.id))
      .map(s => ({
        sku: s.variant_sku, name: s.product_name, size: s.variant_size,
        price: this.price(s), quantity: this.copiesOf(s.id),
      }));
    if (!items.length) { this.notify.warning('Selecciona al menos un producto.'); return; }
    printProductLabels(items, {
      store: this.branding.siteName(), taxRate: this.branding.taxRate(),
      onError: m => this.notify.error(m),
    });
  }
}
