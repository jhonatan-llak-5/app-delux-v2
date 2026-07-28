import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService, Supplier, ReceptionItemIn, ReceptionResult, ScanResult } from '@features/superadmin/services/inventory.service';
import { ManualProductModalComponent, ManualProduct, ManualDraft } from '@features/superadmin/components/manual-product-modal/manual-product-modal.component';
import { Subject, debounceTime } from 'rxjs';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { BrandService } from '@features/superadmin/services/brand.service';
import { CategoryService } from '@features/superadmin/services/category.service';
import { BrandingService } from '@core/services/branding.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { code128BSvg } from '@shared/utils/code128';
import { environment } from '@env/environment';
import { TourService, TourStep } from '@shared/components/app-tour/tour.service';
import { DlxConfirmDialogComponent } from '@shared/ui/confirm-dialog.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { AuthService } from '@core/services/auth.service';
import { SupplierSelectComponent } from '@features/superadmin/components/supplier-select/supplier-select.component';
import { ConfirmService } from '@shared/components/confirm/confirm.service';

interface Row {
  key: number;
  variant_id?: number;
  product_name: string;
  brand_name?: string;
  category_name?: string;
  kind: string;
  color: string;
  size: string;
  barcode: string;
  sku?: string;
  unit_cost: number;
  price?: number;
  tax_rate?: number | null;
  compare_at_price?: number | null;
  discount_percent?: number | null;
  isNew: boolean;
  description?: string;
  branchQty: Record<number, number>;
  branchMemo?: Record<number, number>;
  images?: string[];
  attributes?: Record<string, string>;
  variant_options?: { name: string; values: string[] }[];
}

interface AddDraft {
  variant: NonNullable<ScanResult['variant']>;
  unit_cost: number;
  branchQty: Record<number, number>;
}

const KIND_LABELS: Record<string, string> = {
  CALZADO: 'Calzado', ROPA: 'Ropa', GORRA: 'Gorras', MOCHILA: 'Mochilas',
  BISUTERIA: 'Bisutería', ACCESORIO: 'Accesorios', OTRO: 'Otro',
};

@Component({
  selector: 'dlx-reception',
  standalone: true,
  imports: [ImgFallbackDirective, CommonModule, FormsModule, ManualProductModalComponent, DlxConfirmDialogComponent, DlxPriceInputComponent, SupplierSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reception.component.html',
})
export class ReceptionComponent implements OnInit, OnDestroy {
  private inv = inject(InventoryService);
  private admin = inject(AdminService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private branding = inject(BrandingService);
  private branchCtx = inject(BranchContextService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private tour = inject(TourService);
  private confirmSvc = inject(ConfirmService);

  private readonly STORAGE_KEY = 'dlx_reception_draft';

  @ViewChild('manualRef') manual?: ManualProductModalComponent;
  /** Borrador del formulario de producto (en progreso) restaurado del storage. */
  restoredManual: ManualDraft | null = null;
  clearFormOpen = signal(false);

  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;
  private lastScan = '';
  private lastScanAt = 0;

  tab = signal<'upload' | 'review' | 'confirm'>('upload');

  branches = signal<AdminBranch[]>([]);
  suppliers = signal<Supplier[]>([]);
  brands = signal<string[]>([]);
  categories = signal<string[]>([]);
  categoryParents = signal<Record<string, string>>({});

  selectedBranches = signal<number[]>([]);
  private restoredBranches: number[] | null = null;
  supplierName = '';
  note = '';

  scanCode = '';
  scanMsg = signal<string | null>(null);

  items = signal<Row[]>([]);
  private keySeq = 1;
  showManual = signal(false);
  manualBarcode = signal('');
  detailRow = signal<Row | null>(null);
  detailImg = signal(0);
  brokenImgs = signal<Set<number>>(new Set());
  addDraft = signal<AddDraft | null>(null);
  clearOpen = signal(false);
  confirmOpen = signal(false);
  prodQuery = '';
  searchOpen = signal(false);
  searchResults = signal<NonNullable<ScanResult['variant']>[]>([]);
  prodSearch$ = new Subject<string>();
  saving = signal(false);
  result = signal<ReceptionResult | null>(null);
  labelPerUnit = true;

  isMulti = computed(() => this.selectedBranches().length > 1);
  singleBranch = computed(() => this.selectedBranches()[0] ?? 0);
  totalUnits = computed(() => this.items().reduce((a, r) => a + this.rowUnits(r), 0));
  totalCost = computed(() => this.items().reduce((a, r) => a + this.rowUnits(r) * (+r.unit_cost || 0), 0));

  ngOnInit(): void {
    this.restoreState();
    this.prodSearch$.pipe(debounceTime(250)).subscribe(q => this.runProdSearch(q));
    this.admin.listBranches().subscribe(r => {
      const active = r.results.filter(b => b.is_active);
      this.branches.set(active);
      if (this.restoredBranches && this.restoredBranches.length) {
        const valid = this.restoredBranches.filter(id => active.some(b => b.id === id));
        this.selectedBranches.set(valid.length ? valid : (active.length ? [active[0].id] : []));
      } else {
        const ctx = this.branchCtx.current();
        this.selectedBranches.set(ctx ? [ctx] : (active.length ? [active[0].id] : []));
      }
    });
    this.inv.listSuppliers().subscribe(r => this.suppliers.set(r.results));
    this.brandSvc.list({ page_size: 100 }).subscribe(r => this.brands.set(r.results.map(b => b.name)));
    this.catSvc.list({ page_size: 100 }).subscribe(r => {
      this.categories.set(r.results.map(c => c.name));
      const map: Record<string, string> = {};
      for (const c of r.results) { if (c.parent_name) map[c.name] = c.parent_name; }
      this.categoryParents.set(map);
    });
    if (typeof window !== 'undefined' && localStorage.getItem('dlx_tour_reception') !== '1') {
      setTimeout(() => { this.startTour(); localStorage.setItem('dlx_tour_reception', '1'); }, 700);
    }
  }

  // ── Persistencia del borrador ──
  saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      // Formulario de producto en progreso: solo se guarda si tiene contenido.
      const productDraft = (this.manual && this.manual.hasContent()) ? this.manual.snapshot() : null;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        items: this.items(),
        selectedBranches: this.selectedBranches(),
        supplierName: this.supplierName,
        note: this.note,
        keySeq: this.keySeq,
        productDraft,
      }));
    } catch { /* storage lleno o no disponible */ }
  }

  private restoreState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      // Lista de productos ya agregados.
      if (Array.isArray(d.items) && d.items.length) {
        this.items.set((d.items as any[]).map(r => {
          if (!r.branchQty) {
            const bid = r.branch_id;
            r.branchQty = (bid != null) ? { [bid]: r.quantity ?? 1 } : {};
          }
          return r as Row;
        }));
        const maxKey = d.items.reduce((m: number, r: any) => Math.max(m, r.key || 0), 0);
        this.keySeq = d.keySeq && d.keySeq > maxKey ? d.keySeq : maxKey + 1;
      }
      // Proveedor / nota / sucursales y el formulario en progreso se restauran
      // SIEMPRE (aunque aún no haya productos agregados a la lista).
      if (d.supplierName) this.supplierName = d.supplierName;
      if (d.note) this.note = d.note;
      if (Array.isArray(d.selectedBranches) && d.selectedBranches.length) {
        this.restoredBranches = d.selectedBranches;
      }
      if (d.productDraft) this.restoredManual = d.productDraft as ManualDraft;
    } catch { /* draft corrupto */ }
  }

  private clearState(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(this.STORAGE_KEY);
  }

  /** Persiste tras un cambio en el formulario de producto embebido. */
  persistManual(): void { this.saveState(); }
  /** Persiste tras un click (deja que el modelo se actualice primero). */
  persistManualDeferred(): void { setTimeout(() => this.saveState(), 0); }

  /** ¿Hay algo escrito en el formulario de producto? (para el botón Limpiar). */
  formHasContent(): boolean { return !!this.manual?.hasContent(); }

  askClearForm(): void { if (this.formHasContent()) this.clearFormOpen.set(true); }
  doClearForm(): void {
    this.manual?.clearForm();
    this.restoredManual = null;
    this.clearFormOpen.set(false);
    this.saveState();
    this.notify.success('Formulario limpiado.');
  }

  startTour(): void { this.tour.runSteps(this.tourSteps); }

  readonly tourSteps: TourStep[] = [
    { target: null, placement: 'center', icon: 'fa-truck-ramp-box',
      title: 'Cómo recibir mercadería',
      body: 'En 3 pasos: subes los productos, revisas la lista y confirmas. La lista se guarda sola aunque recargues la página.' },
    { target: '[data-tour=\"recv-branch\"]', placement: 'right', icon: 'fa-store',
      title: '1. Sucursales destino',
      body: 'Marca a qué sucursales llega la mercadería. Si son varias, asignas cada producto a su sucursal en la pestaña Revisar.' },
    { target: '[data-tour=\"recv-supplier\"]', placement: 'right', icon: 'fa-truck-field',
      title: '2. Proveedor',
      body: 'Escribe el proveedor. Si no existe, se crea solo. Queda el historial de quién te entregó.' },
    { target: '[data-tour=\"recv-manual\"]', placement: 'left', icon: 'fa-box-open',
      title: '3. Datos del producto',
      body: 'Llena el producto y pulsa «Agregar a la lista». Puedes cargar varios seguidos. Si tiene tallas o colores, activa «Este producto tiene variantes».' },
    { target: '[data-tour=\"recv-confirm\"]', placement: 'top', icon: 'fa-check',
      title: '4. Confirma',
      body: 'Al confirmar se crea todo de golpe y se genera el código interno. Luego podrás imprimir las etiquetas. ¡Listo! 🚀' },
  ];

  canConfirm(): boolean { return this.selectedBranches().length > 0 && this.totalUnits() > 0 && !!this.supplierName.trim(); }

  /** Avanza al paso Confirmar validando que haya proveedor (obligatorio). */
  goToConfirm(): void {
    if (!this.supplierName.trim()) { this.notify.warning('El proveedor es obligatorio para la recepción.'); return; }
    this.tab.set('confirm');
  }

  confirmMessage(): string {
    const prods = this.items().length;
    const uds = this.totalUnits();
    const sucs = this.selectedBranchList().length;
    const dest = this.branchNames();
    return `Estás por confirmar la recepción de ${prods} producto(s) con un total de ${uds} unidad(es). ` +
      `Estas unidades se SUMARÁN al inventario (stock) de ${sucs > 1 ? sucs + ' sucursales' : dest}. ` +
      `Se generará el código interno de cada producto nuevo y la recepción quedará registrada en el historial. ` +
      `Esta acción no se puede deshacer.`;
  }

  rowUnits(r: Row): number {
    return Object.values(r.branchQty || {}).reduce((a, q) => a + (+q || 0), 0);
  }
  /** Etiqueta de la variante: atributos personalizados o talla/color. */
  rowVariantLabel(r: Row): string {
    const a = r.attributes;
    if (a && Object.keys(a).length) return Object.values(a).join(' · ');
    if (r.size || r.color) return `${r.size || '—'} / ${r.color || '—'}`;
    return '—';
  }
  rowBranchOptions(_r: Row): AdminBranch[] {
    // El paso 2 muestra SIEMPRE todas las sucursales de la tienda.
    // Las "activas" (marcadas) son las que el producto tiene asignadas (branchQty),
    // que vienen de lo elegido en el paso 1 al momento de agregarlo. Independiente del paso 1.
    return this.branches();
  }
  hasBranch(r: Row, bid: number): boolean { return r.branchQty?.[bid] != null; }
  toggleRowBranch(r: Row, bid: number): void {
    if (!r.branchQty) r.branchQty = {};
    if (!r.branchMemo) r.branchMemo = {};
    if (r.branchQty[bid] != null) {
      // Siempre debe quedar al menos una sucursal seleccionada.
      if (Object.keys(r.branchQty).length <= 1) {
        this.notify.warning('Debe quedar al menos una sucursal seleccionada.');
        this.touchItems();   // re-sincroniza el checkbox (queda marcado)
        return;
      }
      // Desmarcar: recuerda la cantidad que tenía.
      r.branchMemo[bid] = +r.branchQty[bid] || 0;
      delete r.branchQty[bid];
    } else {
      // Volver a marcar: restaura la cantidad previa, o 1 si no había.
      const prev = +(r.branchMemo[bid] ?? 0);
      r.branchQty[bid] = prev > 0 ? prev : 1;
    }
    this.touchItems();
  }
  setRowQty(r: Row, bid: number, val: any): void {
    if (!r.branchQty) r.branchQty = {};
    r.branchQty[bid] = Math.max(0, +val || 0);
    this.items.set([...this.items()]);
    this.saveState();
  }
  rowBranchSummary(r: Row): string {
    return Object.entries(r.branchQty || {})
      .filter(([, q]) => (+q) > 0)
      .map(([bid, q]) => this.branchLabel(+bid) + ': ' + q)
      .join(' · ');
  }
  /** Solo los nombres de sucursal (sin cantidades). */
  rowBranchNames(r: Row): string {
    return Object.entries(r.branchQty || {})
      .filter(([, q]) => (+q) > 0)
      .map(([bid]) => this.branchLabel(+bid))
      .join(' · ');
  }
  /** Nombre+cantidad si hay más de una sucursal; solo el nombre si es una. */
  rowBranchDisplay(r: Row): string {
    const active = Object.entries(r.branchQty || {}).filter(([, q]) => (+q) > 0);
    return active.length > 1 ? this.rowBranchSummary(r) : this.rowBranchNames(r);
  }
  groupedSummary(): { key: string; name: string; isNew: boolean; rows: Row[] }[] {
    const groups: { key: string; name: string; isNew: boolean; rows: Row[] }[] = [];
    const idx = new Map<string, number>();
    for (const it of this.items()) {
      const key = it.product_name + '|' + (it.isNew ? 'n' : 'e');
      let i = idx.get(key);
      if (i == null) { i = groups.length; idx.set(key, i); groups.push({ key, name: it.product_name, isNew: it.isNew, rows: [] }); }
      groups[i].rows.push(it);
    }
    return groups;
  }
  groupUnits(rows: Row[]): number { return rows.reduce((a, r) => a + this.rowUnits(r), 0); }
  groupCost(rows: Row[]): number { return rows.reduce((a, r) => a + this.rowUnits(r) * (+r.unit_cost || 0), 0); }
  /** Primera imagen disponible del grupo (todas las variantes comparten fotos). */
  groupImage(rows: Row[]): string | undefined { for (const r of rows) if (r.images && r.images.length) return r.images[0]; return undefined; }

  // ── Acordeón de productos (pasos 2 y 3) ──
  expandedGroups = signal<Set<string>>(new Set());
  isGroupOpen(key: string): boolean { return this.expandedGroups().has(key); }
  toggleGroup(key: string): void {
    const n = new Set(this.expandedGroups());
    n.has(key) ? n.delete(key) : n.add(key);
    this.expandedGroups.set(n);
  }
  /** Quita todas las variantes de un producto de la lista (con confirmación). */
  async removeGroup(rows: Row[]): Promise<void> {
    const name = (rows[0]?.product_name || 'este producto').trim();
    const ok = await this.confirmSvc.ask({
      title: 'Quitar producto',
      message: `¿Quitar "${name}" y sus ${rows.length} variante(s) de la lista? No se eliminará nada del inventario, solo de esta recepción.`,
      variant: 'danger', confirmText: 'Quitar',
    });
    if (!ok) return;
    const keys = new Set(rows.map(r => r.key));
    this.items.set(this.items().filter(r => !keys.has(r.key)));
    this.saveState();
  }
  private bumpBranchQty(r: Row, bid: number | null): void {
    if (bid == null) return;
    if (!r.branchQty) r.branchQty = {};
    r.branchQty[bid] = (+r.branchQty[bid] || 0) + 1;
  }
  private normalizeRows(): void {
    // Solo quita las sucursales que ya no están seleccionadas; NO toca las
    // asignaciones por producto (cada producto recuerda sus sucursales/cantidades).
    const sel = this.selectedBranches();
    this.items.update(list => list.map(r => {
      const bq: Record<number, number> = {};
      for (const [bid, q] of Object.entries(r.branchQty || {})) if (sel.includes(+bid)) bq[+bid] = +q;
      return { ...r, branchQty: bq };
    }));
  }

  isSelected(id: number): boolean { return this.selectedBranches().includes(id); }
  isBranchLocked(id: number): boolean {
    const r = this.auth.user()?.role;
    const single = (r === 'BRANCH_MANAGER' || r === 'SALESPERSON') && !!this.auth.user()?.branch_id;
    return single && this.auth.user()?.branch_id === id;
  }
  defaultBranchId(): number | null { return this.selectedBranches()[0] ?? null; }
  selectedBranchList() { return this.branches().filter(b => this.selectedBranches().includes(b.id)); }
  branchLabel(id: number | null): string {
    if (id == null) return '';
    return this.branches().find(b => b.id === id)?.name ?? '';
  }
  branchNames(): string {
    const list = this.selectedBranchList();
    return list.length ? list.map(b => b.name).join(', ') : '—';
  }
  kindLabel(k: string): string { return KIND_LABELS[k] ?? k ?? 'Otro'; }

  tabCls(t: string): string {
    const base = 'relative px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition';
    return this.tab() === t
      ? base + ' bg-white dark:bg-[#1e2535] shadow text-[var(--dash-primary)] dark:text-white'
      : base + ' text-slate-500 hover:text-slate-700 dark:hover:text-white';
  }
  goReview(): void { this.tab.set('review'); }
  goConfirm(): void { this.tab.set(this.items().length ? 'confirm' : 'review'); }

  readonly steps: { id: 'upload' | 'review' | 'confirm'; label: string }[] = [
    { id: 'upload', label: 'Subir productos' },
    { id: 'review', label: 'Revisar lista' },
    { id: 'confirm', label: 'Confirmar' },
  ];
  private stepOrder: Record<'upload' | 'review' | 'confirm', number> = { upload: 0, review: 1, confirm: 2 };
  stepState(id: 'upload' | 'review' | 'confirm'): 'done' | 'active' | 'todo' {
    const cur = this.stepOrder[this.tab()];
    const idx = this.stepOrder[id];
    if (idx === cur) return 'active';
    return idx < cur ? 'done' : 'todo';
  }
  stepDone(id: 'upload' | 'review' | 'confirm'): boolean { return this.stepOrder[id] < this.stepOrder[this.tab()]; }
  stepCircleCls(id: 'upload' | 'review' | 'confirm'): string {
    const st = this.stepState(id);
    if (st === 'active') return 'bg-gradient-to-br from-[var(--dash-primary)] to-[#3b82f6] text-white shadow-lg shadow-[var(--dash-primary)]/30 ring-4 ring-[var(--dash-primary)]/15 scale-105';
    if (st === 'done') return 'bg-[var(--dash-primary)] text-white shadow-md shadow-[var(--dash-primary)]/25';
    return 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10';
  }
  goStep(id: 'upload' | 'review' | 'confirm'): void {
    if (id === 'confirm' && !this.items().length) { this.tab.set('review'); return; }
    this.tab.set(id);
  }


  toggleBranch(id: number): void {
    if (this.isBranchLocked(id)) return;
    const cur = this.selectedBranches();
    if (cur.includes(id)) {
      this.selectedBranches.set(cur.filter(x => x !== id));
    } else {
      this.selectedBranches.set([...cur, id]);
    }
    // No tocar los productos ya agregados: cada uno conserva sus sucursales.
    this.saveState();
  }

  onScan(): void {
    const code = this.scanCode.trim();
    if (!code || !this.defaultBranchId()) return;
    this.scanMsg.set('Buscando...');
    this.inv.scan(code, this.defaultBranchId()!).subscribe({
      next: (res) => {
        this.scanCode = '';
        if (res.found && res.variant) {
          const v = res.variant;
          const def = this.defaultBranchId();
          const existing = this.items().find(r => r.variant_id === v.id);
          if (existing) {
            this.bumpBranchQty(existing, def);
            this.items.set([...this.items()]);
            this.scanMsg.set(`+1 a ${v.product_name} (${v.size}/${v.color})`);
          } else {
            this.items.update(list => [...list, {
              key: this.keySeq++, variant_id: v.id, product_name: v.product_name,
              brand_name: v.brand_name, category_name: v.category_name,
              kind: v.kind, color: v.color, size: v.size, barcode: v.barcode || code,
              sku: v.sku,
              unit_cost: +v.cost || 0,
              price: v.price_override != null ? +v.price_override : +v.base_price || 0,
              isNew: false, branchQty: def != null ? { [def]: 1 } : {}, images: v.images,
            }]);
            this.scanMsg.set(`Agregado: ${v.product_name} (${v.size}/${v.color})`);
          }
          this.saveState();
        } else {
          this.scanMsg.set('Código nuevo: completa los datos del producto.');
          this.openNew(code);
        }
      },
      error: () => this.scanMsg.set('No se pudo buscar el código.'),
    });
  }

  openNew(barcode: string): void {
    this.manualBarcode.set(barcode);
    this.showManual.set(true);
  }

  openDetail(it: Row): void { this.detailImg.set(0); this.brokenImgs.set(new Set()); this.detailRow.set(it); }
  isImgBroken(idx: number): boolean { return this.brokenImgs().has(idx); }
  markImgBroken(idx: number): void { const set = new Set(this.brokenImgs()); set.add(idx); this.brokenImgs.set(set); }
  touchItems(): void { this.items.set([...this.items()]); this.saveState(); }

  onManualAdd(list: ManualProduct[]): void {
    const def = this.defaultBranchId();
    this.items.update(cur => [...cur, ...list.map(p => ({
      key: this.keySeq++, product_name: p.product_name, brand_name: p.brand,
      category_name: p.category, kind: p.kind, color: p.color, size: p.size,
      barcode: p.barcode, unit_cost: p.cost, price: p.price, description: p.description,
      tax_rate: p.tax_rate, compare_at_price: p.compare_at_price, discount_percent: p.discount_percent,
      attributes: p.attributes, variant_options: p.variant_options,
      // Se respeta la cantidad recibida (incluida 0) para poder ajustarla aquí en el Paso 2.
      isNew: true, branchQty: (def != null ? { [def]: Math.max(0, +p.quantity || 0) } : {}), images: p.images,
    }))]);
    this.showManual.set(false);
    this.scanMsg.set('Agregado: ' + list.length + ' variante(s)');
    const nm = (list[0]?.product_name || 'Producto').trim();
    this.notify.success(list.length > 1
      ? `«${nm}» agregado a la lista (${list.length} variantes).`
      : `«${nm}» agregado a la lista.`);
    // El formulario se resetea solo (embedded); limpiamos su borrador guardado.
    this.restoredManual = null;
    this.saveState();
  }

  runProdSearch(q: string): void {
    const t = (q || '').trim();
    if (t.length < 2) { this.searchResults.set([]); return; }
    this.inv.variantSearch(t).subscribe({
      next: r => this.searchResults.set(r.results),
      error: () => this.searchResults.set([]),
    });
  }

  closeSearchSoon(): void { setTimeout(() => this.searchOpen.set(false), 150); }

  addExisting(v: NonNullable<ScanResult['variant']>): void {
    this.searchOpen.set(false); this.prodQuery = ''; this.searchResults.set([]);
    const existing = this.items().find(r => r.variant_id === v.id);
    let branchQty: Record<number, number>;
    if (existing) {
      // Ya está en la lista: refleja su asignación actual para editarla.
      branchQty = { ...existing.branchQty };
    } else {
      // Nuevo: pre-marca todas las sucursales elegidas en el paso 1.
      branchQty = {};
      for (const id of this.selectedBranches()) branchQty[id] = 1;
    }
    this.addDraft.set({ variant: v, unit_cost: existing ? existing.unit_cost : (+v.cost || 0), branchQty });
  }

  panelToggle(bid: number): void {
    const d = this.addDraft(); if (!d) return;
    if (d.branchQty[bid] != null) delete d.branchQty[bid]; else d.branchQty[bid] = 1;
    this.addDraft.set({ ...d, branchQty: { ...d.branchQty } });
  }
  panelSetQty(bid: number, val: any): void {
    const d = this.addDraft(); if (!d) return;
    d.branchQty[bid] = Math.max(0, +val || 0);
    this.addDraft.set({ ...d, branchQty: { ...d.branchQty } });
  }
  confirmAddExisting(): void {
    const d = this.addDraft(); if (!d) return;
    const v = d.variant;
    const sel = this.selectedBranches();
    const bq: Record<number, number> = {};
    for (const [b, q] of Object.entries(d.branchQty)) if (sel.includes(+b) && (+q) > 0) bq[+b] = +q;
    if (!Object.keys(bq).length) { this.notify.error('Marca al menos una sucursal con cantidad.'); return; }
    const existing = this.items().find(r => r.variant_id === v.id);
    if (existing) {
      existing.branchQty = bq;
      existing.unit_cost = d.unit_cost;
      this.items.set([...this.items()]);
    } else {
      this.items.update(list => [...list, {
        key: this.keySeq++, variant_id: v.id, product_name: v.product_name,
        brand_name: v.brand_name, category_name: v.category_name,
        kind: v.kind, color: v.color, size: v.size, barcode: v.barcode || '',
        sku: v.sku, unit_cost: d.unit_cost,
        price: v.price_override != null ? +v.price_override : +v.base_price || 0,
        isNew: false, branchQty: bq, images: v.images,
      }]);
    }
    this.scanMsg.set('Agregado: ' + v.product_name);
    this.addDraft.set(null);
    this.saveState();
  }

  removeRow(key: number): void {
    this.items.update(list => list.filter(r => r.key !== key));
    this.saveState();
  }

  askClear(): void { this.clearOpen.set(true); }
  doClear(): void {
    this.items.set([]);
    this.scanMsg.set(null);
    this.clearOpen.set(false);
    this.clearState();
    this.tab.set('upload');
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    this.saving.set(true);
    const sel = this.selectedBranches();
    const items: ReceptionItemIn[] = [];
    for (const r of this.items()) {
      const entries = Object.entries(r.branchQty || {}).filter(([, q]) => (+q) > 0);
      for (const [bid, q] of entries) {
        items.push(r.variant_id
          ? { variant_id: r.variant_id, quantity: +q, unit_cost: +r.unit_cost, branch: +bid }
          : {
              quantity: +q, unit_cost: +r.unit_cost, barcode: r.barcode,
              product_name: r.product_name, kind: r.kind,
              brand_name: r.brand_name, category_name: r.category_name,
              color: r.color, size: r.size, price: +(r.price ?? 0),
              tax_rate: r.tax_rate ?? null, compare_at_price: r.compare_at_price ?? null,
              discount_percent: r.discount_percent ?? null,
              attributes: r.attributes, variant_options: r.variant_options,
              branch: +bid, images: r.images, description: r.description,
            });
      }
    }
    if (!items.length) { this.saving.set(false); this.notify.error('Asigna cantidad a por lo menos una sucursal.'); return; }
    this.inv.createReception({
      branch: this.defaultBranchId()!, supplier_name: this.supplierName.trim() || undefined,
      note: this.note.trim() || undefined, items,
    }).subscribe({
      next: (r) => { this.saving.set(false); this.confirmOpen.set(false); this.result.set(r); this.clearState(); this.notify.success('Recepción confirmada'); },
      error: (e) => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo confirmar.'); },
    });
  }

  reset(): void {
    this.result.set(null);
    this.items.set([]);
    this.supplierName = '';
    this.note = '';
    this.scanMsg.set(null);
    this.tab.set('upload');
    this.clearState();
  }

  money(v: number): string { return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2); }

  ngOnDestroy(): void { this.stopCamera(); }

  supplierOpen = signal(false);
  showSupplierModal = signal(false);

  filteredSuppliers() {
    const q = this.supplierName.trim().toLowerCase();
    const list = this.suppliers();
    return (q ? list.filter(s => s.name.toLowerCase().includes(q)) : list).slice(0, 8);
  }
  pickSupplier(name: string): void {
    // La recepción usa un solo proveedor para todo el lote; si ya hay productos
    // agregados con otro proveedor, avisar que se aplicará a todos.
    const prev = (this.supplierName || '').trim();
    if (this.items().length && prev && prev.toLowerCase() !== name.trim().toLowerCase()) {
      this.notify.warning(`Esta subida se registra con un solo proveedor: «${name}» se aplicará a todos los productos.`);
    }
    this.supplierName = name; this.supplierOpen.set(false); this.saveState();
  }
  closeSupplierSoon(): void { setTimeout(() => this.supplierOpen.set(false), 150); }

  onSupplierCreated(s: Supplier): void {
    this.suppliers.update(l => {
      const others = l.filter(x => x.id !== s.id);
      return [s, ...others];
    });
    this.supplierName = s.name;
    this.showSupplierModal.set(false);
    this.notify.success('Proveedor guardado');
    this.saveState();
  }

  saveSupplier(): void {
    const name = this.supplierName.trim();
    if (!name) return;
    if (this.suppliers().some(s => s.name.toLowerCase() === name.toLowerCase())) {
      this.notify.success('Ese proveedor ya está guardado.');
      return;
    }
    this.inv.createSupplier({ name }).subscribe({
      next: (sup) => { this.suppliers.update(l => [...l, sup]); this.notify.success('Proveedor guardado'); },
      error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo guardar el proveedor.'),
    });
  }

  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta cámara para escanear. Usa una pistola o escribe el código.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara (requiere HTTPS y permiso).');
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.camVideo?.nativeElement;
      if (v && this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.camVideo?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) this.onCameraCode(codes[0].rawValue || '');
    } catch { /* frame sin codigo */ }
    if (this.cameraOn()) this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  private onCameraCode(raw: string): void {
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (!code) return;
    const now = Date.now();
    if (code === this.lastScan && now - this.lastScanAt < 2500) return;
    this.lastScan = code; this.lastScanAt = now;
    this.scanCode = code;
    this.onScan();
  }

  printLabels(): void {
    const r = this.result();
    if (!r || typeof window === 'undefined') return;
    const store = (this.branding.siteName() || 'DELUX').toUpperCase();
    let html = '';
    for (const it of r.items) {
      const copies = this.labelPerUnit ? Math.max(1, it.quantity) : 1;
      const finalP = (+it.price || 0);  // el precio ya incluye IVA
      const price = '$' + (Math.round(finalP * 100) / 100).toFixed(2);
      const bc = code128BSvg(it.variant_sku, { height: 50, moduleWidth: 1.5, margin: 4 });
      const sizeTxt = it.size ? ('Talla ' + it.size) : '';
      const kioskUrl = window.location.origin + '/kiosko?code=' + encodeURIComponent(it.variant_sku);
      const qrUrl = `${environment.apiUrl}/kiosk/qr/?data=${encodeURIComponent(kioskUrl)}`;
      for (let i = 0; i < copies; i++) {
        html += `<div class="lbl">
          <div class="row"><span class="store">${store}</span><span class="price">${price}</span></div>
          <div class="mid"><div class="bc">${bc}</div><img class="qr" src="${qrUrl}" alt="QR"/></div>
          <div class="code">${it.variant_sku}</div>
          <div class="name">${it.product_name}${sizeTxt ? ' · ' + sizeTxt : ''}</div>
        </div>`;
      }
    }
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) { this.notify.error('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
      <style>
        @page { size: 50mm 30mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .lbl { width: 50mm; height: 30mm; padding: 1.5mm 2mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .store { font-weight: 800; font-size: 9pt; letter-spacing: .5px; }
        .price { font-weight: 800; font-size: 11pt; background: #000; color: #fff; padding: 0 4px; border-radius: 2px; }
        .mid { display: flex; align-items: center; gap: 2mm; }
        .bc { flex: 1; height: 11mm; min-width: 0; }
        .bc svg { height: 100%; width: 100%; }
        .qr { height: 11mm; width: 11mm; flex-shrink: 0; }
        .code { font-size: 7pt; text-align: center; letter-spacing: 1px; margin-top: -1mm; }
        .name { font-size: 7.5pt; text-align: center; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>${html}
      <scr`+`ipt>
        window.onload=function(){
          var imgs=document.images, left=imgs.length;
          if(!left){ window.print(); return; }
          function done(){ if(--left<=0) window.print(); }
          for(var i=0;i<imgs.length;i++){ if(imgs[i].complete) done(); else { imgs[i].onload=done; imgs[i].onerror=done; } }
        };
      </scr`+`ipt></body></html>`);
    w.document.close();
  }
}
