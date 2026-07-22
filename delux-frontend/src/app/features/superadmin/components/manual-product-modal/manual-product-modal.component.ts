import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { DlxImageUploaderComponent, DlxImageItem } from '@shared/ui/image-uploader.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { inject } from '@angular/core';
import { BrandingService } from '@core/services/branding.service';

export interface ManualProduct {
  product_name: string; brand: string; category: string; kind: string;
  color: string; size: string; barcode: string;
  cost: number; price: number; quantity: number;
  description: string;
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
export class ManualProductModalComponent implements OnInit {
  @Input() brands: string[] = [];
  @Input() categories: string[] = [];
  @Input() categoryParents: Record<string, string> = {};
  @Input() barcode = '';
  @Output() add = new EventEmitter<ManualProduct[]>();
  @Output() cancel = new EventEmitter<void>();

  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  private branding = inject(BrandingService);
  ivaRate(): number { return this.branding.taxRate(); }
  netPrice(): number { const b = +this.nf.price || 0; const r = this.ivaRate(); return r ? b / (1 + r / 100) : b; }
  ivaAmount(): number { return (+this.nf.price || 0) - this.netPrice(); }
  finalPrice(): number { return +this.nf.price || 0; }
  margin(): number { return (+this.nf.price || 0) - (+this.nf.cost || 0); }
  marginPct(): number { const c = +this.nf.cost || 0; return c > 0 ? (this.margin() / c) * 100 : 0; }
  money(v: number): string { return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2); }
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
  // Verdadero cuando lo escrito no coincide con ninguna marca/categoria existente:
  // el backend la creara automaticamente al guardar.
  brandIsNew(): boolean {
    const v = this.nf.brand.trim().toLowerCase();
    return !!v && !this.brands.some(b => b.toLowerCase() === v);
  }
  catIsNew(): boolean {
    const v = this.nf.category.trim().toLowerCase();
    return !!v && !this.categories.some(c => c.toLowerCase() === v);
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
  nf: Omit<ManualProduct, 'images'> = {
    product_name: '', brand: '', category: '', kind: 'CALZADO',
    color: '', size: '', barcode: '', cost: 0, price: 0, quantity: 1, description: '',
  };

  ngOnInit(): void { this.nf.barcode = this.barcode || ''; }

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
    if (!this.nf.brand.trim()) errs['brand'] = 'Este campo es obligatorio.';
    if (!this.nf.category.trim()) errs['category'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    const list = this.combos();
    if (!list.length) { this.error.set('Pon al menos una cantidad en la matriz.'); return; }
    this.error.set(null);
    const imgs = this.images.map(i => i.url).filter(u => !!u);
    const single = list.length === 1;
    this.add.emit(list.map(x => ({
      product_name: this.nf.product_name.trim(),
      brand: this.nf.brand.trim(),
      category: this.nf.category.trim(),
      kind: this.nf.kind,
      color: x.color.trim(),
      size: x.size.trim(),
      barcode: single ? this.nf.barcode.trim() : '',
      cost: +(this.nf.cost ?? 0),
      price: +(this.nf.price ?? 0),
      quantity: x.qty,
      description: (this.nf.description || '').trim(),
      images: imgs,
    })));
  }
}
