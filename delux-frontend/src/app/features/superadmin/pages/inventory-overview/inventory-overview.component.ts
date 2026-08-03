import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { AuthService } from '@core/services/auth.service';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { BarcodeScanDirective } from '@shared/directives/barcode-scan.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, Subject, forkJoin } from 'rxjs';

import { Stock, InventorySummary, InventoryService, ProductGroup } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { onImageError, imgOrPlaceholder } from '@shared/utils/img-placeholder';
import { StockAdjustModalComponent } from '@features/superadmin/components/stock-adjust-modal/stock-adjust-modal.component';
import { TransferModalComponent } from '@features/superadmin/components/transfer-modal/transfer-modal.component';
import { printProductLabels } from '@shared/utils/print-labels';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { ProductService } from '@features/superadmin/services/product.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { parseApiError } from '@shared/utils/api-error.util';

// Lector de código de barras USB (HID): captura global vía BarcodeScanDirective.
@Component({
  selector: 'dlx-inventory-overview',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxStatCardComponent, DlxSearchInputComponent, BarcodeScanDirective, CommonModule, FormsModule, RouterLink, StockAdjustModalComponent, TransferModalComponent, RowActionsComponent, DlxPaginationComponent, DlxExportMenuComponent, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-overview.component.html',
})
export class InventoryOverviewComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);
  private branchCtx = inject(BranchContextService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  private productSvc = inject(ProductService);
  private confirm = inject(ConfirmService);

  // ── Selección múltiple (por PRODUCTO) ──
  selected = signal<Set<number>>(new Set());   // guarda product_id
  /** ¿Mostrar columna Sucursal? Solo si el usuario puede cambiar de sucursal. */
  showBranchCol = computed(() => this.branchCtx.canSwitch());
  isSel(productId: number): boolean { return this.selected().has(productId); }
  toggleSel(productId: number): void { const n = new Set(this.selected()); n.has(productId) ? n.delete(productId) : n.add(productId); this.selected.set(n); }
  allSelected = computed(() => { const g = this.groups(); return g.length > 0 && g.every(x => this.selected().has(x.product_id)); });
  toggleAllSel(): void { this.allSelected() ? this.selected.set(new Set()) : this.selected.set(new Set(this.groups().map(x => x.product_id))); }
  clearSel(): void { this.selected.set(new Set()); }
  private selectedProductIds(): number[] { return [...this.selected()]; }

  // ── Expandir / colapsar producto ──
  expanded = signal<Set<number>>(new Set());
  isExpanded(productId: number): boolean { return this.expanded().has(productId); }
  toggleExpand(productId: number): void { const n = new Set(this.expanded()); n.has(productId) ? n.delete(productId) : n.add(productId); this.expanded.set(n); }
  isActive(s: Stock): boolean { return (s.product_status || 'PUBLISHED') === 'PUBLISHED'; }
  isActiveGroup(g: ProductGroup): boolean { return (g.product_status || 'PUBLISHED') === 'PUBLISHED'; }
  /** Precio a mostrar de una variante (override o precio base del producto). */
  variantPrice(s: Stock): number { return s.price_override != null ? +s.price_override : (+s.base_price || 0); }
  /** Etiqueta de la variante: usa los atributos personalizados o talla/color. */
  variantLabel(s: Stock): string {
    const a = s.variant_attributes;
    if (a && Object.keys(a).length) return Object.values(a).join(' · ');
    return `${s.variant_size || '—'} / ${s.variant_color || '—'}`;
  }
  /** Rango "$min – $max" (o un solo valor si son iguales) para la fila de producto. */
  private fmtRange(min: number, max: number): string {
    const lo = +min || 0, hi = +max || 0;
    if (!lo && !hi) return '—';
    return lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)} – $${hi.toFixed(2)}`;
  }
  priceRange(g: ProductGroup): string { return this.fmtRange(g.price_min, g.price_max); }
  costRange(g: ProductGroup): string { return this.fmtRange(g.cost_min, g.cost_max); }

  bulkSetStatus(status: 'PUBLISHED' | 'PAUSED'): void {
    const pids = this.selectedProductIds();
    if (!pids.length) return;
    this.productSvc.bulkStatus(pids, status).subscribe({
      next: r => {
        this.notify.success(`${r.updated} producto(s) ${status === 'PUBLISHED' ? 'activado(s)' : 'desactivado(s)'}.`);
        this.clearSel(); this.reload();
      },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo actualizar el estado.'),
    });
  }
  async bulkDelete(): Promise<void> {
    const pids = this.selectedProductIds();
    if (!pids.length) return;
    const ok = await this.confirm.ask({
      title: 'Eliminar productos',
      message: `¿Eliminar ${pids.length} producto(s)? Dejarán de aparecer en el catálogo, el inventario y el punto de venta. Las ventas ya registradas se conservan intactas.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.productSvc.bulkDelete(pids).subscribe({
      next: r => {
        if (r.deleted) this.notify.success(`${r.deleted} producto(s) eliminado(s).`);
        else this.notify.info('No se eliminó ningún producto.');
        this.clearSel(); this.reload();
      },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo eliminar.'),
    });
  }

  /** Elimina (borrado lógico) un producto completo (todas sus variantes). */
  async deleteProduct(g: ProductGroup): Promise<void> {
    const n = g.variants_count;
    const ok = await this.confirm.ask({
      title: 'Eliminar producto',
      message: `¿Eliminar "${g.product_name}"${n > 1 ? ` y sus ${n} variantes` : ''}? Dejará de aparecer en el catálogo, el inventario y el punto de venta. Las ventas ya registradas se conservan intactas.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.productSvc.delete(g.product_id).subscribe({
      next: () => { this.notify.success(`Producto "${g.product_name}" eliminado.`); this.clearSel(); this.reload(); },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo eliminar.'),
    });
  }

  constructor() {
    // La carga la maneja este efecto (no ngOnInit): así el inventario se carga
    // recién cuando la sesión y el contexto de sucursal están listos. En un
    // refresco en frío el usuario/sucursal se resuelven DESPUÉS de crear el
    // componente; si cargáramos de una en ngOnInit la petición saldría sin
    // contexto y la tabla se quedaba en "Cargando…". El efecto reacciona a
    // ambos y recarga cuando ya hay sesión.
    effect(() => {
      const user = this.auth.user();          // espera a que la sesión esté lista
      const b = this.branchCtx.current();      // y reacciona al selector global
      if (!user) return;
      // reload() lee otros signals (search, page…); los envolvemos en untracked
      // para que el efecto SOLO dependa de user y sucursal. Si no, al escribir en
      // el buscador el efecto se re-dispararía y llamaría a las APIs por duplicado.
      untracked(() => { this.branchFilter = b; this.reload(); });
    }, { allowSignalWrites: true });
  }

  stocks = signal<Stock[]>([]);          // aplanado (para edición/guardado por variante)
  groups = signal<ProductGroup[]>([]);   // agrupado por producto (para render)
  total = signal(0);
  page = signal(1);
  pageSize = signal(50);
  summary = signal<InventorySummary | null>(null);
  branches = signal<AdminBranch[]>([]);
  // Indicadores colapsables (se recuerda la preferencia; por defecto ocultos)
  kpisOpen = signal<boolean>(typeof localStorage !== 'undefined' && localStorage.getItem('dlx_inv_kpis') === '1');
  toggleKpis(): void {
    const v = !this.kpisOpen();
    this.kpisOpen.set(v);
    try { localStorage.setItem('dlx_inv_kpis', v ? '1' : '0'); } catch {}
  }
  loading = signal(true);

  search = signal('');
  branchFilter: number | null = null;
  lowOnly = false;
  outOnly = false;
  private search$ = new Subject<void>();

  adjustStock = signal<Stock | null>(null);
  transferStock = signal<Stock | null>(null);

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    // Búsqueda inicial desde la URL (?search=CODIGO), p. ej. al venir del aviso
    // de "código duplicado". Se aplica antes de la carga del effect.
    const q = this.route.snapshot.queryParamMap.get('search');
    if (q) this.search.set(q);
    // Si ya estás en inventario y cambia el ?search=, reacciona (salta la 1ª
    // emisión: la carga inicial la hace el effect con el valor del snapshot).
    let firstQp = true;
    this.route.queryParamMap.subscribe(pm => {
      if (firstQp) { firstQp = false; return; }
      const s = pm.get('search') || '';
      if (s !== this.search()) { this.search.set(s); this.page.set(1); this.reload(); }
    });
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    // La carga inicial la dispara el effect del constructor cuando la sesión y
    // el contexto de sucursal ya están listos (evita quedarse en "Cargando…"
    // al refrescar la página directamente en /inventory).
  }

  reload(): void {
    this.loading.set(true);
    this.clearSel();
    this.svc.summary(this.branchFilter || undefined).subscribe(s => this.summary.set(s));
    this.svc.stocksByProduct({
      search: this.search(),
      branch: this.branchFilter || undefined,
      low_stock: this.lowOnly,
      out_of_stock: this.outOnly,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => {
        this.groups.set(r.results);
        const flat = r.results.flatMap(g => g.stocks);
        this.stocks.set(flat);
        this.total.set(r.count);
        this.loading.set(false);
        this.buildDraft(flat);
      },
      error: () => this.loading.set(false),
    });
  }

  exportColumns: ExportColumn<Stock>[] = [
    { header: 'Producto', key: 'product_name' },
    { header: 'SKU', key: 'variant_sku' },
    { header: 'Código barras', key: s => s.barcode || '' },
    { header: 'Marca', key: 'brand_name' },
    { header: 'Talla', key: 'variant_size' },
    { header: 'Color', key: 'variant_color' },
    { header: 'Sucursal', key: 'branch_name' },
    { header: 'Stock', key: 'quantity' },
    { header: 'Precio', key: s => Number(s.price_override || s.base_price || 0).toFixed(2) },
  ];
  fetchAllForExport = async (): Promise<Stock[]> => {
    const r = await firstValueFrom(this.svc.stocks({
      search: this.search(), branch: this.branchFilter || undefined,
      low_stock: this.lowOnly, out_of_stock: this.outOnly, page: 1, page_size: 5000,
    }));
    return (r.results || []).filter(s => s.quantity > 0);
  };

  onSearch(v: string) { this.search.set(v); this.page.set(1); this.search$.next(); }
  /** Código escaneado (lo pone en el buscador y recarga al instante). */
  onScanned(code: string) { this.search.set(code); this.page.set(1); this.reload(); }
  /**
   * Código leído con el LECTOR USB físico (pistola HID). Reutiliza el mismo flujo
   * que la búsqueda por código: normaliza y lo manda al buscador para recargar.
   */
  onBarcodeScanned(code: string) {
    const clean = (code || '').trim();
    if (!clean) return;
    this.onScanned(clean);
  }
  onFilter() { this.page.set(1); this.reload(); }
  onPage(p: number) { this.page.set(p); this.reload(); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); this.reload(); }

  setBranchFilter(id: number) {
    this.branchFilter = this.branchFilter === id ? null : id;
    this.reload();
  }

  /** Acciones a nivel de PRODUCTO (fila principal). */
  productActions(g: ProductGroup): RowAction[] {
    return [
      { label: 'Editar producto', icon: 'fa-pen-to-square', run: () => this.router.navigate(['/app/admin/products', g.product_id]) },
      { label: 'Ver historial', icon: 'fa-clock-rotate-left', run: () => this.router.navigate(['/app/admin/inventory/movements'], { queryParams: { product: g.product_id, name: g.product_name } }) },
      { label: 'Eliminar producto', icon: 'fa-trash', variant: 'danger', run: () => this.deleteProduct(g) },
    ];
  }

  /** Acciones a nivel de VARIANTE (línea dentro del producto). */
  variantActions(s: Stock, g: ProductGroup): RowAction[] {
    return [
      { label: 'Ajustar', icon: 'fa-pen', run: () => this.openAdjust(s) },
      { label: 'Imprimir etiqueta', icon: 'fa-barcode', run: () => this.printLabel(s) },
      { label: 'Eliminar variante', icon: 'fa-trash', variant: 'danger', run: () => this.deleteVariant(s, g) },
    ];
  }

  /** Elimina (borrado lógico) una sola variante talla/color. */
  async deleteVariant(s: Stock, g: ProductGroup): Promise<void> {
    const last = g.variants_count <= 1;
    const detalle = `${s.variant_size || '—'} / ${s.variant_color || '—'}`;
    const ok = await this.confirm.ask({
      title: 'Eliminar variante',
      message: last
        ? `"${detalle}" es la única variante de "${s.product_name}". Al eliminarla se elimina también el producto. ¿Continuar?`
        : `¿Eliminar la variante "${detalle}" de "${s.product_name}"? Las demás variantes se conservan.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.svc.deleteVariant(s.variant).subscribe({
      next: r => {
        this.notify.success(r.product_deleted ? `Producto "${s.product_name}" eliminado.` : 'Variante eliminada.');
        this.clearSel(); this.reload();
      },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo eliminar la variante.'),
    });
  }

  printLabel(s: Stock): void {
    const price = s.price_override != null ? +s.price_override : +s.base_price || 0;
    printProductLabels(
      [{ sku: s.variant_sku, name: s.product_name, size: s.variant_size, price, quantity: 1 }],
      { store: this.branding.siteName(), taxRate: this.branding.taxRate(), onError: m => this.notify.error(m) },
    );
  }

  openAdjust(s: Stock) { this.adjustStock.set(s); }
  openTransfer(s: Stock) { this.transferStock.set(s); }

  onAdjusted() {
    this.adjustStock.set(null);
    this.reload();
  }
  onTransferred() {
    this.transferStock.set(null);
    this.reload();
  }

  // ── Edición inline estilo Treinta ──
  draft: Record<number, { price: number; cost: number; qty: number }> = {};
  private draftV = signal(0);
  motivosOpen = signal(false);
  motives: Record<number, string> = {};
  motiveOther: Record<number, string> = {};
  saving = signal(false);
  readonly motiveChips = [
    { v: 'COMPRA', label: 'Compra/Reposición' },
    { v: 'CONTEO', label: 'Error de conteo' },
    { v: 'MERMA', label: 'Merma o daño' },
    { v: 'PERDIDA', label: 'Pérdida' },
    { v: 'OTRO', label: 'Otro' },
  ];

  private origPrice(s: Stock): number { return +(s.price_override ?? s.base_price) || 0; }
  private origCost(s: Stock): number { return +(s.cost ?? 0) || 0; }

  buildDraft(rows: Stock[]): void {
    const d: Record<number, { price: number; cost: number; qty: number }> = {};
    for (const s of rows) d[s.id] = { price: this.origPrice(s), cost: this.origCost(s), qty: s.quantity };
    this.draft = d;
    this.draftV.set(0);
  }
  onDraftChange(): void { this.draftV.update(v => v + 1); }
  dr(s: Stock): { price: number; cost: number; qty: number } {
    if (!this.draft[s.id]) this.draft[s.id] = { price: this.origPrice(s), cost: this.origCost(s), qty: s.quantity };
    return this.draft[s.id];
  }

  changed = computed<Stock[]>(() => {
    this.draftV();
    return this.stocks().filter(s => {
      const d = this.draft[s.id]; if (!d) return false;
      return +d.price !== this.origPrice(s) || +d.cost !== this.origCost(s) || +d.qty !== s.quantity;
    });
  });
  qtyChanged = computed<Stock[]>(() => { this.draftV(); return this.changed().filter(s => +this.draft[s.id].qty !== s.quantity); });
  hasChanges = computed(() => { this.draftV(); return this.changed().length > 0; });
  motivesReady = computed(() => { this.draftV(); return this.qtyChanged().every(s => !!this.motives[s.id]); });

  ganancia(s: Stock): number { const d = this.draft[s.id]; return d ? (+d.price - +d.cost) : 0; }
  gananciaPct(s: Stock): number { const d = this.draft[s.id]; return d && +d.price > 0 ? (+d.price - +d.cost) / +d.price * 100 : 0; }
  qtyDelta(s: Stock): number { const d = this.draft[s.id]; return d ? (+d.qty - s.quantity) : 0; }

  saveChanges(): void {
    if (!this.hasChanges()) return;
    if (this.qtyChanged().length > 0) {
      this.motives = {}; this.motiveOther = {};
      for (const s of this.qtyChanged()) this.motives[s.id] = this.qtyDelta(s) > 0 ? 'COMPRA' : 'CONTEO';
      this.motivosOpen.set(true);
    } else {
      this.applyChanges(true);
    }
  }

  applyChanges(skipMotives = false): void {
    const reqs: any[] = [];
    for (const s of this.changed()) {
      const d = this.draft[s.id];
      const priceCh = +d.price !== this.origPrice(s);
      const costCh = +d.cost !== this.origCost(s);
      if (priceCh || costCh) {
        reqs.push(this.svc.setPricing(s.id, {
          base_price: priceCh ? +d.price : undefined,
          cost: costCh ? +d.cost : undefined,
        }));
      }
      const delta = +d.qty - s.quantity;
      if (delta !== 0) {
        const reason = skipMotives ? '' : (this.motives[s.id] || '');
        const unit_cost = reason === 'COMPRA' ? +d.cost : undefined;
        reqs.push(this.svc.adjust(s.id, delta, this.motiveOther[s.id] || '', 'ADJ', reason, unit_cost));
      }
    }
    if (!reqs.length) { this.motivosOpen.set(false); return; }
    this.saving.set(true);
    forkJoin(reqs).subscribe({
      next: () => { this.saving.set(false); this.motivosOpen.set(false); this.notify.success('Cambios guardados'); this.reload(); },
      error: () => { this.saving.set(false); this.notify.error('No se pudieron guardar algunos cambios.'); this.reload(); },
    });
  }
  discardChanges(): void { this.buildDraft(this.stocks()); }

  imgSrc(u?: string | null): string { return imgOrPlaceholder(u); }
}
