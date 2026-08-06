import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { BranchContextService } from '@core/services/branch-context.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { InventoryService, Stock, ProductGroup } from '@features/superadmin/services/inventory.service';
import { printProductLabels, LabelItem } from '@shared/utils/print-labels';
import { PrinterSetupGuideComponent } from '@shared/components/printer-setup-guide/printer-setup-guide.component';

@Component({
  selector: 'dlx-labels',
  standalone: true,
  imports: [CommonModule, FormsModule, ImgFallbackDirective, DlxSearchInputComponent, DlxEmptyStateComponent, PrinterSetupGuideComponent, DlxPaginationComponent],
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
        <div class="flex items-center gap-2">
          <button type="button" (click)="guide.open()" class="btn-secondary text-sm">
            <i class="fa-solid fa-circle-question"></i> Configurar impresora
          </button>
          <button type="button" (click)="print()" [disabled]="selected().size === 0"
                  class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-d)] text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
            <i class="fa-solid fa-print"></i> Imprimir ({{ totalLabels() }})
          </button>
        </div>
      </div>

      <dlx-printer-setup-guide #guide />
      <div class="flex justify-end -mt-3">
        <button type="button" (click)="guide.open()"
                class="text-xs text-slate-400 hover:text-[var(--dash-primary)] inline-flex items-center gap-1.5">
          <i class="fa-solid fa-circle-question"></i> ¿Primera vez? Cómo configurar la impresora de etiquetas
        </button>
      </div>

      <!-- Buscador -->
      <div class="flex flex-wrap items-center gap-3">
        <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)"
                          placeholder="Buscar por nombre, código o color…" class="flex-1 min-w-64" />
        @if (selected().size) {
          <span class="text-sm text-slate-500">{{ selected().size }} variante(s) · {{ totalLabels() }} etiqueta(s)</span>
          <button type="button" (click)="clearSel()" class="text-sm font-semibold text-slate-500 hover:text-ink-950 dark:hover:text-white">Limpiar</button>
        }
      </div>

      <!-- Tabla -->
      <div class="card overflow-hidden">
        @if (loading()) {
          <div class="p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i><p>Cargando…</p></div>
        } @else if (!groups().length) {
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
                  <th class="px-4 py-3 font-semibold text-center">Unidades</th>
                  <th class="px-4 py-3 font-semibold text-right">Precio</th>
                  <th class="px-4 py-3 font-semibold text-center w-28">Copias</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5 align-middle">
                @for (g of groups(); track g.product_id) {

                  @if (g.stocks.length > 1) {
                    <!-- Fila del PRODUCTO (acordeón) -->
                    <tr class="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td class="px-4 py-3">
                        <input type="checkbox" [checked]="groupAllSelected(g)" (change)="toggleGroup(g)"
                               class="w-4 h-4 accent-[var(--dash-primary)]" title="Seleccionar todas las variantes" />
                      </td>
                      <td class="px-4 py-3 cursor-pointer" (click)="toggleExpand(g.product_id)">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <i class="fa-solid fa-chevron-right text-xs text-slate-400 transition-transform shrink-0"
                             [ngClass]="isExpanded(g.product_id) ? 'rotate-90' : ''"></i>
                          <img [src]="g.product_main_image" [alt]="g.product_name" class="w-9 h-9 rounded-lg object-cover bg-slate-100 shrink-0" dlxImgFallback />
                          <div class="min-w-0">
                            <p class="font-medium truncate">{{ g.product_name }}</p>
                            <p class="text-[11px] text-slate-500 truncate">{{ g.category_name }} · {{ g.brand_name }}</p>
                            <p class="text-[11px] text-slate-400">{{ g.variants_count }} variante(s)</p>
                          </div>
                        </div>
                      </td>
                      @if (showBranchCol()) { <td class="px-4 py-3"></td> }
                      <td class="px-4 py-3 text-center font-semibold">{{ g.total_qty }}</td>
                      <td class="px-4 py-3 text-right font-semibold whitespace-nowrap">{{ priceRange(g) }}</td>
                      <td class="px-4 py-3"></td>
                    </tr>

                    @if (isExpanded(g.product_id)) {
                      @for (s of g.stocks; track s.id) {
                        <tr class="bg-slate-50/40 dark:bg-white/[0.015]"
                            [ngClass]="isSel(s.id) ? 'bg-[var(--dash-primary)]/5' : ''">
                          <td class="px-4 py-2.5">
                            <input type="checkbox" [checked]="isSel(s.id)" (change)="toggle(s.id)" class="w-4 h-4 accent-[var(--dash-primary)]" />
                          </td>
                          <td class="px-4 py-2.5 pl-12">
                            <p class="text-sm font-medium truncate">{{ variantLabel(s) }}</p>
                            <p class="text-[11px] text-slate-400 font-mono">{{ s.variant_sku }}</p>
                          </td>
                          @if (showBranchCol()) {
                            <td class="px-4 py-2.5 text-xs"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>{{ s.branch_name }}</td>
                          }
                          <td class="px-4 py-2.5 text-center text-slate-500">{{ s.quantity }}</td>
                          <td class="px-4 py-2.5 text-right font-semibold">\${{ price(s) | number:'1.2-2' }}</td>
                          <td class="px-4 py-2.5 text-center">
                            <input type="number" min="1" [ngModel]="copiesOf(s.id)" (ngModelChange)="setCopies(s.id, $event)"
                                   class="eg-input !h-9 w-20 text-center text-sm" [disabled]="!isSel(s.id)" />
                          </td>
                        </tr>
                      }
                    }

                  } @else {
                    <!-- Producto de una sola variante: fila directa -->
                    @for (s of g.stocks; track s.id) {
                      <tr class="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                          [ngClass]="isSel(s.id) ? 'bg-[var(--dash-primary)]/5' : ''">
                        <td class="px-4 py-3">
                          <input type="checkbox" [checked]="isSel(s.id)" (change)="toggle(s.id)" class="w-4 h-4 accent-[var(--dash-primary)]" />
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-3 min-w-0">
                            <img [src]="g.product_main_image" [alt]="g.product_name" class="w-9 h-9 rounded-lg object-cover bg-slate-100 shrink-0" dlxImgFallback />
                            <div class="min-w-0">
                              <p class="font-medium truncate">{{ g.product_name }}</p>
                              <p class="text-[11px] text-slate-500 truncate">{{ g.category_name }} · {{ g.brand_name }}</p>
                              @if (hasVariantInfo(s)) {
                                <p class="text-[11px] font-medium text-slate-600 dark:text-slate-300">{{ variantLabel(s) }}</p>
                              }
                              <p class="text-[11px] text-slate-400 font-mono">{{ s.variant_sku }}</p>
                            </div>
                          </div>
                        </td>
                        @if (showBranchCol()) {
                          <td class="px-4 py-3 text-xs"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>{{ s.branch_name }}</td>
                        }
                        <td class="px-4 py-3 text-center text-slate-500">{{ s.quantity }}</td>
                        <td class="px-4 py-3 text-right font-semibold">\${{ price(s) | number:'1.2-2' }}</td>
                        <td class="px-4 py-3 text-center">
                          <input type="number" min="1" [ngModel]="copiesOf(s.id)" (ngModelChange)="setCopies(s.id, $event)"
                                 class="eg-input !h-9 w-20 text-center text-sm" [disabled]="!isSel(s.id)" />
                        </td>
                      </tr>
                    }
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      @if (total() > pageSize()) {
        <dlx-pagination [page]="page()" [pageSize]="pageSize()" [total]="total()"
                        (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
      }

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
  groups = signal<ProductGroup[]>([]);
  /** Aplanado de variantes (para selección/copias/impresión). */
  stocks = signal<Stock[]>([]);
  search = signal('');
  page = signal(1);
  pageSize = signal(50);
  total = signal(0);
  showBranchCol = computed(() => this.ctx.canSwitch());
  selected = signal<Set<number>>(new Set());
  private copies = signal<Record<number, number>>({});
  /** Productos expandidos manualmente. Al buscar se expanden todos. */
  private expandedSet = signal<Set<number>>(new Set());

  constructor() {
    effect(() => { this.search(); this.ctx.current(); this.page(); this.pageSize(); this.load(); },
      { allowSignalWrites: true });
  }

  load(): void {
    this.loading.set(true);
    this.inv.stocksByProduct({
      search: this.search().trim() || undefined,
      branch: this.ctx.current() ?? undefined,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => {
        this.groups.set(r.results);
        this.stocks.set(r.results.flatMap(g => g.stocks));
        this.total.set(r.count);
        this.loading.set(false);
      },
      error: () => { this.groups.set([]); this.stocks.set([]); this.loading.set(false); },
    });
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); }
  onPage(p: number): void { this.page.set(p); }
  onSize(s: number): void { this.pageSize.set(s); this.page.set(1); }

  price(s: Stock): number { return s.price_override != null ? +s.price_override : (+s.base_price || 0); }
  variantLabel(s: Stock): string { return `${s.variant_size || '—'} / ${s.variant_color || '—'}`; }
  hasVariantInfo(s: Stock): boolean { return !!(s.variant_size || '').trim() || !!(s.variant_color || '').trim(); }

  private fmtRange(min: number, max: number): string {
    const lo = +min || 0, hi = +max || 0;
    return lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)} – $${hi.toFixed(2)}`;
  }
  priceRange(g: ProductGroup): string { return this.fmtRange(g.price_min, g.price_max); }

  // ── Expandir / colapsar ──
  isExpanded(productId: number): boolean {
    return !!this.search().trim() || this.expandedSet().has(productId);
  }
  toggleExpand(productId: number): void {
    const n = new Set(this.expandedSet());
    n.has(productId) ? n.delete(productId) : n.add(productId);
    this.expandedSet.set(n);
  }

  // ── Selección ──
  isSel(id: number): boolean { return this.selected().has(id); }
  toggle(id: number): void {
    const n = new Set(this.selected());
    if (n.has(id)) n.delete(id); else { n.add(id); this.setCopies(id, this.copiesOf(id)); }
    this.selected.set(n);
  }
  groupAllSelected(g: ProductGroup): boolean {
    return g.stocks.length > 0 && g.stocks.every(s => this.selected().has(s.id));
  }
  toggleGroup(g: ProductGroup): void {
    const n = new Set(this.selected());
    if (this.groupAllSelected(g)) { g.stocks.forEach(s => n.delete(s.id)); }
    else { g.stocks.forEach(s => { n.add(s.id); this.setCopies(s.id, this.copiesOf(s.id)); }); }
    this.selected.set(n);
  }
  allSelected(): boolean { const s = this.stocks(); return s.length > 0 && s.every(x => this.selected().has(x.id)); }
  toggleAll(): void {
    if (this.allSelected()) { this.selected.set(new Set()); }
    else {
      const n = new Set(this.selected());
      this.stocks().forEach(s => { n.add(s.id); this.setCopies(s.id, this.copiesOf(s.id)); });
      this.selected.set(n);
    }
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
