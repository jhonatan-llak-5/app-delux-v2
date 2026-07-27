import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { DlxImageUploaderComponent, DlxImageItem } from '@shared/ui/image-uploader.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { inject } from '@angular/core';
import { BrandingService } from '@core/services/branding.service';
import { SRI_IVA_OPTIONS } from '@shared/data/taxes';

export interface ManualProduct {
  product_name: string; brand: string; category: string; kind: string;
  color: string; size: string; barcode: string;
  cost: number; price: number; quantity: number;
  tax_rate: number | null; compare_at_price: number | null;
  description: string;
  images: string[];
  /** Atributos de dimensiones personalizadas: {"Talla":"40","Color":"Rojo"}. */
  attributes?: Record<string, string>;
  /** Definición de dimensiones del producto (se repite en cada variante). */
  variant_options?: { name: string; values: string[] }[];
}

/** Snapshot completo del formulario embebido (para persistir el borrador). */
export interface ManualDraft {
  nf: Omit<ManualProduct, 'images' | 'tax_rate' | 'compare_at_price'>;
  images: DlxImageItem[];
  taxRate: number | null;
  onOffer: boolean;
  discount: number;
  hasVariants: boolean;
  variantMode: 'classic' | 'custom';
  selColors: string[];
  selSizes: string[];
  qtyMap: Record<string, number>;
  dims: { name: string; values: string[] }[];
  comboQty: Record<string, number>;
  simpleQty: number;
}

/** Datos para prellenar el formulario al EDITAR un producto. */
export interface ProductInitial {
  product_name: string; brand: string; category: string; kind: string;
  description: string; barcode: string;
  base_price: number; compare_at_price: number | null; tax_rate: number | null;
  images: string[];
}

const KIND_PRESETS: Record<string, { label: string; sizeLabel: string; sizes: string[] }> = {
  CALZADO:   { label: 'Calzado',   sizeLabel: 'Talla',  sizes: ['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45'] },
  ROPA:      { label: 'Ropa',      sizeLabel: 'Talla',  sizes: ['2','4','6','8','10','12','14','16','XS','S','M','L','XL','XXL'] },
  GORRA:     { label: 'Gorras',    sizeLabel: 'Talla',  sizes: ['Única','S/M','L/XL','Ajustable'] },
  MOCHILA:   { label: 'Mochilas',  sizeLabel: 'Tamaño', sizes: ['Única','S','M','L'] },
  BISUTERIA: { label: 'Bisutería', sizeLabel: 'Medida', sizes: ['Única'] },
  ACCESORIO: { label: 'Accesorios',sizeLabel: 'Medida', sizes: ['Única'] },
  OTRO:      { label: 'Otro',      sizeLabel: 'Talla',  sizes: [] },
};

@Component({
  selector: 'dlx-manual-product-modal',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule, DlxModalComponent, DlxImageUploaderComponent, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-product-modal.component.html',
})
export class ManualProductModalComponent implements OnInit, OnDestroy {
  @Input() brands: string[] = [];
  @Input() categories: string[] = [];
  @Input() categoryParents: Record<string, string> = {};
  @Input() barcode = '';
  @Input() embedded = false;
  /** 'create' (recepción, multi + variantes) o 'edit' (solo datos del producto). */
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() initial: ProductInitial | null = null;
  /** Borrador a restaurar (solo en modo embebido). */
  @Input() draft: ManualDraft | null = null;
  @Input() saving = false;
  @Output() add = new EventEmitter<ManualProduct[]>();
  @Output() cancel = new EventEmitter<void>();
  /** Se emite cuando el formulario cambia, para que el padre persista el borrador. */
  @Output() changed = new EventEmitter<void>();

  private branding = inject(BrandingService);

  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  /** Limpia el error de un campo apenas el usuario corrige el valor. */
  clearErr(k: string): void {
    const e = this.fieldErrors();
    if (e[k]) { const n = { ...e }; delete n[k]; this.fieldErrors.set(n); }
  }

  isEdit(): boolean { return this.mode === 'edit'; }

  // ── Escáner de código de barras con cámara ──
  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private detector: any;
  private scanTimer: any;

  async startScan(): Promise<void> {
    this.camError.set(null);
    const BD = (window as any).BarcodeDetector;
    if (!BD) { this.camError.set('Tu navegador no soporta escaneo por cámara. Escribe o usa un lector USB.'); return; }
    try {
      this.detector = new BD({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.cameraOn.set(true);
      setTimeout(() => {
        const v = this.camVideo?.nativeElement;
        if (v) { v.srcObject = this.stream!; v.play().catch(() => {}); this.loop(); }
      }, 120);
    } catch { this.camError.set('No se pudo abrir la cámara.'); }
  }
  private async loop(): Promise<void> {
    if (!this.cameraOn()) return;
    const v = this.camVideo?.nativeElement;
    if (v && v.readyState >= 2) {
      try {
        const codes = await this.detector.detect(v);
        if (codes && codes.length && codes[0].rawValue) { this.nf.barcode = String(codes[0].rawValue); this.stopScan(); return; }
      } catch { /* frame sin código */ }
    }
    this.scanTimer = setTimeout(() => this.loop(), 300);
  }
  stopScan(): void {
    this.cameraOn.set(false);
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }
  ngOnDestroy(): void { this.stopScan(); }

  // ── Variantes ──
  // Modo por defecto = CLÁSICO (talla + color, como siempre). El modo
  // PERSONALIZADO (dimensiones libres estilo Treinta) queda como opción avanzada.
  hasVariants = signal(false);
  variantMode = signal<'classic' | 'custom'>('classic');
  private readonly SEP = '¦';
  bulkQty = 1;
  simpleQty = 1;                       // cantidad cuando el producto NO tiene variantes
  private dimsV = signal(0);           // fuerza recomputar combos en el template

  toggleVariants(v: boolean): void {
    this.hasVariants.set(v);
    if (!v) { this.selColors = []; this.selSizes = []; }
    this.changed.emit();
  }
  setVariantMode(m: 'classic' | 'custom'): void {
    this.variantMode.set(m);
    if (m === 'custom' && !this.dims.length) this.dims = [{ name: 'Talla', values: [] }];
    this.dimsV.update(x => x + 1); this.changed.emit();
  }

  // ── Modo CLÁSICO: multi-color × multi-talla (matriz) ──
  selColors: string[] = [];
  selSizes: string[] = [];
  newColor = '';
  newSizeText = '';
  qtyMap: Record<string, number> = {};
  colorsOrDefault(): string[] { return this.selColors.length ? this.selColors : ['']; }
  sizesOrDefault(): string[] { return this.selSizes.length ? this.selSizes : ['']; }
  private comboKey(c: string, sz: string): string { return c + '|' + sz; }
  getQty(c: string, sz: string): number { return this.qtyMap[this.comboKey(c, sz)] ?? 0; }
  setQty(c: string, sz: string, v: any): void { this.qtyMap[this.comboKey(c, sz)] = Math.max(0, +v || 0); this.changed.emit(); }
  toggleColor(c: string): void { const i = this.selColors.indexOf(c); if (i >= 0) this.selColors.splice(i, 1); else this.selColors.push(c); this.changed.emit(); }
  addColorText(): void { const v = this.newColor.trim(); if (v && !this.selColors.includes(v)) this.selColors.push(v); this.newColor = ''; this.changed.emit(); }
  toggleSize(sz: string): void { const i = this.selSizes.indexOf(sz); if (i >= 0) this.selSizes.splice(i, 1); else this.selSizes.push(sz); this.changed.emit(); }
  addSizeText(): void { const v = this.newSizeText.trim(); if (v && !this.selSizes.includes(v)) this.selSizes.push(v); this.newSizeText = ''; this.changed.emit(); }
  useMatrix(): boolean { return this.selColors.length > 1 && this.selSizes.length > 1; }
  comboList(): { key: string; color: string; size: string }[] {
    const out: { key: string; color: string; size: string }[] = [];
    for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) out.push({ key: c + '|' + sz, color: c, size: sz });
    return out;
  }
  comboLabel(cb: { color: string; size: string }): string {
    const parts: string[] = [];
    if (cb.color) parts.push(cb.color);
    if (cb.size) parts.push(this.sizeLabel() + ' ' + cb.size);
    return parts.length ? parts.join(' · ') : 'Cantidad';
  }
  private classicCombos(): { color: string; size: string; qty: number }[] {
    const out: { color: string; size: string; qty: number }[] = [];
    for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) {
      const q = this.getQty(c, sz);
      if (q > 0) out.push({ color: c, size: sz, qty: q });
    }
    return out;
  }

  // ── Modo PERSONALIZADO: dimensiones libres (Treinta) ──
  dims: { name: string; values: string[] }[] = [{ name: 'Talla', values: [] }];
  newVal: Record<number, string> = {};
  comboQty: Record<string, number> = {};
  addDim(): void { if (this.dims.length < 4) { this.dims = [...this.dims, { name: '', values: [] }]; this.dimsV.update(x => x + 1); this.changed.emit(); } }
  removeDim(i: number): void { this.dims = this.dims.filter((_, idx) => idx !== i); this.dimsV.update(x => x + 1); this.changed.emit(); }
  onDimName(): void { this.dimsV.update(x => x + 1); this.changed.emit(); }
  addVal(i: number): void {
    const raw = (this.newVal[i] || '').trim();
    if (!raw) return;
    for (const part of raw.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!this.dims[i].values.includes(part)) this.dims[i].values.push(part);
    }
    this.newVal[i] = '';
    this.dimsV.update(x => x + 1); this.changed.emit();
  }
  removeVal(i: number, v: string): void { this.dims[i].values = this.dims[i].values.filter(x => x !== v); this.dimsV.update(x => x + 1); this.changed.emit(); }
  activeDims(): { name: string; values: string[] }[] { return this.dims.filter(d => d.name.trim() && d.values.length); }
  combos(): { key: string; attrs: Record<string, string>; label: string }[] {
    this.dimsV();
    const ds = this.activeDims();
    if (!ds.length) return [];
    let acc: Record<string, string>[] = [{}];
    for (const d of ds) {
      const next: Record<string, string>[] = [];
      for (const combo of acc) for (const val of d.values) next.push({ ...combo, [d.name.trim()]: val });
      acc = next;
    }
    return acc.map(attrs => {
      const parts = ds.map(d => attrs[d.name.trim()]);
      return { key: parts.join(this.SEP), attrs, label: parts.join(' · ') };
    });
  }
  comboQtyOf(key: string): number { return this.comboQty[key] ?? 0; }
  setComboQty(key: string, v: any): void { this.comboQty[key] = Math.max(0, +v || 0); this.dimsV.update(x => x + 1); this.changed.emit(); }

  // ── Compartido (según el modo activo) ──
  applyBulk(): void {
    const q = Math.max(0, +this.bulkQty || 0);
    if (this.variantMode() === 'custom') { for (const c of this.combos()) this.comboQty[c.key] = q; }
    else { for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) this.qtyMap[this.comboKey(c, sz)] = q; }
    this.dimsV.update(x => x + 1); this.changed.emit();
  }
  totalUnits(): number {
    return this.variantMode() === 'custom'
      ? this.combos().reduce((a, c) => a + this.comboQtyOf(c.key), 0)
      : this.classicCombos().reduce((a, x) => a + x.qty, 0);
  }
  comboCount(): number {
    return this.variantMode() === 'custom' ? this.combos().length : this.classicCombos().length;
  }
  /** ¿El producto quedará con una sola variante? (para el código de barras). */
  isSingleVariant(): boolean {
    return this.variantMode() === 'custom' ? this.combos().length === 1 : this.comboList().length === 1;
  }

  // ── Impuesto por producto (null = usa el IVA global de Configuración) ──
  taxRate: number | null = null;
  globalIva(): number { return this.branding.taxRate(); }
  effectiveIva(): number { return this.taxRate != null ? this.taxRate : this.globalIva(); }
  readonly taxOptions = SRI_IVA_OPTIONS;

  // ── Precio con IVA (nf.price = precio de venta con IVA incluido) ──
  netPrice(): number { const b = +this.nf.price || 0; const r = this.effectiveIva(); return r ? b / (1 + r / 100) : b; }
  ivaAmount(): number { return (+this.nf.price || 0) - this.netPrice(); }
  margin(): number { return (this.finalPrice()) - (+this.nf.cost || 0); }
  marginPct(): number { const c = +this.nf.cost || 0; return c > 0 ? (this.margin() / c) * 100 : 0; }
  money(v: number): string { return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2); }

  // ── Oferta (descuento %) ──
  onOffer = false;
  discount = 0;
  toggleOffer(v: boolean): void { this.onOffer = v; if (!v) this.discount = 0; }
  offerPrice(): number {
    const d = Math.min(99, Math.max(0, +this.discount || 0));
    return (+this.nf.price || 0) * (1 - d / 100);
  }
  /** Precio que realmente se cobra (base_price a guardar). */
  finalPrice(): number { return this.onOffer && +this.discount > 0 ? this.offerPrice() : (+this.nf.price || 0); }
  compareAtPrice(): number | null { return this.onOffer && +this.discount > 0 ? (+this.nf.price || 0) : null; }

  // ── Marca / categoría (combobox autocreable) ──
  brandOpen = signal(false);
  catOpen = signal(false);
  filteredBrands(): string[] {
    const q = this.nf.brand.trim().toLowerCase();
    return (q ? this.brands.filter(b => b.toLowerCase().includes(q)) : this.brands).slice(0, 50);
  }
  parentOf(name: string): string { return this.categoryParents[(name || '').trim()] || ''; }
  filteredCats(): string[] {
    const q = this.nf.category.trim().toLowerCase();
    return (q ? this.categories.filter(c => c.toLowerCase().includes(q)) : this.categories).slice(0, 50);
  }
  brandIsNew(): boolean {
    const v = this.nf.brand.trim().toLowerCase();
    return !!v && !this.brands.some(b => b.toLowerCase() === v);
  }
  catIsNew(): boolean {
    const v = this.nf.category.trim().toLowerCase();
    return !!v && !this.categories.some(c => c.toLowerCase() === v);
  }
  brandChosen(): boolean { return !!this.nf.brand.trim(); }
  catChosen(): boolean { return !!this.nf.category.trim(); }
  // Se registra visualmente como "creada" (aparece en la lista local) al confirmarla.
  createBrand(): void {
    const v = this.nf.brand.trim();
    if (v && !this.brands.some(b => b.toLowerCase() === v.toLowerCase())) this.brands = [...this.brands, v];
    this.brandOpen.set(false);
  }
  createCat(): void {
    const v = this.nf.category.trim();
    if (v && !this.categories.some(c => c.toLowerCase() === v.toLowerCase())) this.categories = [...this.categories, v];
    this.catOpen.set(false);
  }
  pickBrand(b: string): void { this.nf.brand = b; this.brandOpen.set(false); }
  pickCat(c: string): void { this.nf.category = c; this.catOpen.set(false); }
  closeSoon(which: 'brand' | 'cat'): void {
    setTimeout(() => (which === 'brand' ? this.brandOpen : this.catOpen).set(false), 150);
  }

  images: DlxImageItem[] = [];
  readonly colorPresets = ['Negro', 'Blanco', 'Gris', 'Azul', 'Celeste', 'Rojo', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Café', 'Beige', 'Multicolor'];
  private readonly colorHexMap: Record<string, string> = {
    'Negro': '#111827', 'Blanco': '#ffffff', 'Gris': '#9ca3af', 'Azul': '#2563eb', 'Celeste': '#7dd3fc',
    'Rojo': '#dc2626', 'Verde': '#16a34a', 'Amarillo': '#facc15', 'Naranja': '#f97316', 'Morado': '#7c3aed',
    'Rosa': '#ec4899', 'Café': '#92400e', 'Beige': '#e7d8b1',
    'Multicolor': 'linear-gradient(135deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)',
  };
  colorHex(name: string): string { return this.colorHexMap[name] || '#cbd5e1'; }
  readonly kinds = Object.entries(KIND_PRESETS).map(([value, v]) => ({ value, label: v.label }));
  nf: Omit<ManualProduct, 'images' | 'tax_rate' | 'compare_at_price'> = {
    product_name: '', brand: '', category: '', kind: 'CALZADO',
    color: '', size: '', barcode: '', cost: 0, price: 0, quantity: 1, description: '',
  };

  ngOnInit(): void {
    this.nf.barcode = this.barcode || '';
    if (this.initial) this.prefill(this.initial);
    if (this.embedded && this.draft) this.applyDraft(this.draft);
  }

  /** Restaura un borrador guardado (modo embebido). */
  private applyDraft(d: ManualDraft): void {
    try {
      if (d.nf) this.nf = { ...this.nf, ...d.nf };
      this.images = Array.isArray(d.images) ? d.images.map(i => ({ ...i })) : [];
      this.taxRate = d.taxRate ?? null;
      this.onOffer = !!d.onOffer;
      this.discount = +d.discount || 0;
      this.hasVariants.set(!!d.hasVariants);
      this.variantMode.set(d.variantMode === 'custom' ? 'custom' : 'classic');
      this.selColors = Array.isArray(d.selColors) ? [...d.selColors] : [];
      this.selSizes = Array.isArray(d.selSizes) ? [...d.selSizes] : [];
      this.qtyMap = d.qtyMap && typeof d.qtyMap === 'object' ? { ...d.qtyMap } : {};
      this.dims = Array.isArray(d.dims) && d.dims.length ? d.dims.map(x => ({ name: x.name, values: [...(x.values || [])] })) : [{ name: 'Talla', values: [] }];
      this.comboQty = d.comboQty && typeof d.comboQty === 'object' ? { ...d.comboQty } : {};
      this.simpleQty = +d.simpleQty || 1;
      this.dimsV.update(x => x + 1);
    } catch { /* borrador corrupto */ }
  }

  /** Snapshot serializable del formulario, para persistir el borrador. */
  snapshot(): ManualDraft {
    return {
      nf: { ...this.nf },
      images: this.images.map(i => ({ ...i })),
      taxRate: this.taxRate,
      onOffer: this.onOffer,
      discount: this.discount,
      hasVariants: this.hasVariants(),
      variantMode: this.variantMode(),
      selColors: [...this.selColors],
      selSizes: [...this.selSizes],
      qtyMap: { ...this.qtyMap },
      dims: this.dims.map(d => ({ name: d.name, values: [...d.values] })),
      comboQty: { ...this.comboQty },
      simpleQty: this.simpleQty,
    };
  }

  /** ¿El formulario tiene algo escrito/seleccionado? (para mostrar «Limpiar»). */
  hasContent(): boolean {
    const n = this.nf;
    if ((n.product_name || '').trim() || (n.brand || '').trim() || (n.category || '').trim()
        || (n.barcode || '').trim() || (n.description || '').trim()) return true;
    if ((+n.cost || 0) > 0 || (+n.price || 0) > 0) return true;
    if (this.images.length) return true;
    if (this.selColors.length || this.selSizes.length || this.activeDims().length) return true;
    if (this.onOffer && +this.discount > 0) return true;
    return false;
  }

  /** Vacía el formulario (uso externo desde el botón «Limpiar formulario»). */
  clearForm(): void { this.resetForm(); this.changed.emit(); }

  /** El uploader avisa cambios de imágenes -> el padre re-persiste. */
  onImagesChange(): void { this.changed.emit(); }

  private prefill(p: ProductInitial): void {
    this.nf.product_name = p.product_name || '';
    this.nf.brand = p.brand || '';
    this.nf.category = p.category || '';
    this.nf.kind = p.kind || 'OTRO';
    this.nf.description = p.description || '';
    this.nf.barcode = p.barcode || '';
    this.taxRate = p.tax_rate != null ? +p.tax_rate : null;
    this.images = (p.images || []).map(u => ({ url: u } as DlxImageItem));
    // Oferta: si compare_at_price > base_price, está en oferta.
    const base = +p.base_price || 0;
    const cmp = p.compare_at_price != null ? +p.compare_at_price : 0;
    if (cmp > base && cmp > 0) {
      this.onOffer = true;
      this.nf.price = cmp;                                    // precio regular
      this.discount = Math.round((1 - base / cmp) * 100);
    } else {
      this.onOffer = false;
      this.nf.price = base;
    }
  }

  private resetForm(): void {
    const keepKind = this.nf.kind;
    this.nf = { product_name: '', brand: '', category: '', kind: keepKind,
      color: '', size: '', barcode: '', cost: 0, price: 0, quantity: 1, description: '' };
    this.images = [];
    this.selColors = []; this.selSizes = []; this.newColor = ''; this.newSizeText = ''; this.qtyMap = {};
    this.dims = [{ name: 'Talla', values: [] }];
    this.newVal = {}; this.comboQty = {}; this.bulkQty = 1; this.simpleQty = 1;
    this.variantMode.set('classic');
    this.dimsV.update(x => x + 1);
    this.hasVariants.set(false);
    this.onOffer = false; this.discount = 0; this.taxRate = null;
    this.fieldErrors.set({}); this.error.set(null);
  }

  sizePreset(): string[] { return KIND_PRESETS[this.nf.kind]?.sizes ?? []; }
  sizeLabel(): string { return KIND_PRESETS[this.nf.kind]?.sizeLabel ?? 'Talla'; }

  submit(): void {
    this.error.set(null);
    const errs: Record<string, string> = {};
    if (!this.nf.product_name.trim()) errs['product_name'] = 'Este campo es obligatorio.';
    if ((+this.nf.price || 0) <= 0) errs['price'] = 'Ingresa un precio válido.';
    if (!this.isEdit()) {
      if ((+this.nf.cost || 0) <= 0) errs['cost'] = 'Ingresa un costo válido.';
      if (!this.hasVariants() && (+this.simpleQty || 0) <= 0) errs['qty'] = 'Ingresa la cantidad.';
    }
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;

    const imgs = this.images.map(i => i.url).filter(u => !!u);
    const tax = this.taxRate;
    const cmp = this.compareAtPrice();

    if (this.isEdit()) {
      // Edición: un solo producto, sin cantidades ni variantes.
      this.add.emit([{
        product_name: this.nf.product_name.trim(),
        brand: this.nf.brand.trim(), category: this.nf.category.trim(),
        kind: this.nf.kind, color: '', size: '', barcode: this.nf.barcode.trim(),
        cost: +(this.nf.cost ?? 0), price: this.finalPrice(), quantity: 0,
        tax_rate: tax, compare_at_price: cmp,
        description: (this.nf.description || '').trim(), images: imgs,
      }]);
      return;
    }

    const finalUnit = this.finalPrice();  // precio que se cobra (con oferta)
    const baseItem = {
      product_name: this.nf.product_name.trim(),
      brand: this.nf.brand.trim(),
      category: this.nf.category.trim(),
      kind: this.nf.kind,
      cost: +(this.nf.cost ?? 0),
      price: finalUnit,
      tax_rate: tax,
      compare_at_price: cmp,
      description: (this.nf.description || '').trim(),
      images: imgs,
    };

    if (!this.hasVariants()) {
      // Producto simple: una sola "variante" sin atributos.
      this.add.emit([{
        ...baseItem, color: '', size: '', barcode: this.nf.barcode.trim(),
        quantity: Math.max(0, +this.simpleQty || 0),
      }]);
      if (this.embedded) this.resetForm();
      return;
    }

    if (this.variantMode() === 'custom') {
      // Modo personalizado: producto cartesiano de las dimensiones libres.
      const opts = this.activeDims().map(d => ({ name: d.name.trim(), values: [...d.values] }));
      const combos = this.combos().filter(c => this.comboQtyOf(c.key) > 0);
      if (!combos.length) { this.error.set('Agrega al menos una cantidad en alguna variante.'); return; }
      const single = combos.length === 1;
      this.add.emit(combos.map(c => {
        const vals = Object.values(c.attrs).map(v => String(v));
        return {
          ...baseItem,
          size: vals[0] || '', color: vals[1] || '',
          barcode: single ? this.nf.barcode.trim() : '',
          quantity: this.comboQtyOf(c.key),
          attributes: c.attrs, variant_options: opts,
        };
      }));
      if (this.embedded) this.resetForm();
      return;
    }

    // Modo clásico: talla × color.
    const list = this.classicCombos();
    if (!list.length) { this.error.set('Agrega al menos una cantidad.'); return; }
    const single = list.length === 1;
    this.add.emit(list.map(x => ({
      ...baseItem,
      color: x.color.trim(), size: x.size.trim(),
      barcode: single ? this.nf.barcode.trim() : '',
      quantity: x.qty,
    })));
    if (this.embedded) this.resetForm();
  }
}
