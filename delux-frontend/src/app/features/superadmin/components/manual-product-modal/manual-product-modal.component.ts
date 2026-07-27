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
  @Input() saving = false;
  @Output() add = new EventEmitter<ManualProduct[]>();
  @Output() cancel = new EventEmitter<void>();

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
  hasVariants = signal(false);
  toggleVariants(v: boolean): void {
    this.hasVariants.set(v);
    if (!v) { this.selColors = []; this.selSizes = []; }
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
    if (this.qtyMap['|'] == null) this.qtyMap['|'] = 1;
    if (this.initial) this.prefill(this.initial);
  }

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
    this.images = []; this.selColors = []; this.selSizes = [];
    this.newColor = ''; this.newSizeText = ''; this.bulkQty = 1;
    this.qtyMap = { '|': 1 };
    this.hasVariants.set(false);
    this.onOffer = false; this.discount = 0; this.taxRate = null;
    this.fieldErrors.set({}); this.error.set(null);
  }

  sizePreset(): string[] { return KIND_PRESETS[this.nf.kind]?.sizes ?? []; }
  sizeLabel(): string { return KIND_PRESETS[this.nf.kind]?.sizeLabel ?? 'Talla'; }

  // ── Multi-color × multi-talla (matriz) ──
  selColors: string[] = [];
  selSizes: string[] = [];
  newColor = '';
  newSizeText = '';
  bulkQty = 1;
  qtyMap: Record<string, number> = {};

  colorsOrDefault(): string[] { return this.selColors.length ? this.selColors : ['']; }
  sizesOrDefault(): string[] { return this.selSizes.length ? this.selSizes : ['']; }
  private comboKey(c: string, sz: string): string { return c + '|' + sz; }
  getQty(c: string, sz: string): number { return this.qtyMap[this.comboKey(c, sz)] ?? 0; }
  setQty(c: string, sz: string, v: any): void { this.qtyMap[this.comboKey(c, sz)] = Math.max(0, +v || 0); }
  toggleColor(c: string): void { const i = this.selColors.indexOf(c); if (i >= 0) this.selColors.splice(i, 1); else this.selColors.push(c); }
  addColorText(): void { const v = this.newColor.trim(); if (v && !this.selColors.includes(v)) this.selColors.push(v); this.newColor = ''; }
  toggleSize(sz: string): void { const i = this.selSizes.indexOf(sz); if (i >= 0) this.selSizes.splice(i, 1); else this.selSizes.push(sz); }
  addSizeText(): void { const v = this.newSizeText.trim(); if (v && !this.selSizes.includes(v)) this.selSizes.push(v); this.newSizeText = ''; }
  applyBulk(): void {
    const q = Math.max(0, +this.bulkQty || 0);
    for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) this.qtyMap[this.comboKey(c, sz)] = q;
  }
  private combos(): { color: string; size: string; qty: number }[] {
    const out: { color: string; size: string; qty: number }[] = [];
    for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) {
      const q = this.getQty(c, sz);
      if (q > 0) out.push({ color: c, size: sz, qty: q });
    }
    return out;
  }
  totalUnits(): number { return this.combos().reduce((a, x) => a + x.qty, 0); }
  comboCount(): number { return this.combos().length; }
  useMatrix(): boolean { return this.selColors.length > 1 && this.selSizes.length > 1; }
  comboList(): { key: string; color: string; size: string }[] {
    const out: { key: string; color: string; size: string }[] = [];
    for (const c of this.colorsOrDefault()) for (const sz of this.sizesOrDefault()) out.push({ key: c + '|' + sz, color: c, size: sz });
    return out;
  }
  isSingleVariant(): boolean { return this.comboList().length === 1; }
  comboLabel(cb: { color: string; size: string }): string {
    const parts: string[] = [];
    if (cb.color) parts.push(cb.color);
    if (cb.size) parts.push(this.sizeLabel() + ' ' + cb.size);
    return parts.length ? parts.join(' · ') : 'Cantidad';
  }

  submit(): void {
    this.error.set(null);
    const errs: Record<string, string> = {};
    if (!this.nf.product_name.trim()) errs['product_name'] = 'Este campo es obligatorio.';
    if ((+this.nf.price || 0) <= 0) errs['price'] = 'Ingresa un precio válido.';
    if (!this.isEdit()) {
      if ((+this.nf.cost || 0) <= 0) errs['cost'] = 'Ingresa un costo válido.';
      if (!this.hasVariants() && this.getQty('', '') <= 0) errs['qty'] = 'Ingresa la cantidad.';
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

    const list = this.combos();
    if (!list.length) { this.error.set('Pon al menos una cantidad.'); return; }
    const single = list.length === 1;
    // El precio de la variante es el que se cobra (con oferta aplicada).
    const finalUnit = this.finalPrice();
    this.add.emit(list.map(x => ({
      product_name: this.nf.product_name.trim(),
      brand: this.nf.brand.trim(),
      category: this.nf.category.trim(),
      kind: this.nf.kind,
      color: x.color.trim(),
      size: x.size.trim(),
      barcode: single ? this.nf.barcode.trim() : '',
      cost: +(this.nf.cost ?? 0),
      price: finalUnit,
      quantity: x.qty,
      tax_rate: tax,
      compare_at_price: cmp,
      description: (this.nf.description || '').trim(),
      images: imgs,
    })));
    if (this.embedded) this.resetForm();
  }
}
