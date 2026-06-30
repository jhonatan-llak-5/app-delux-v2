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
  template: `
    <dlx-modal [open]="true" [maxWidth]="760" title="Nuevo producto" (closed)="cancel.emit()">
      <div class="space-y-4">
        <div>
          <label class="eg-label">Tipo de producto</label>
          <select [(ngModel)]="nf.kind" class="eg-input w-full">
            @for (k of kinds; track k.value) { <option [ngValue]="k.value">{{ k.label }}</option> }
          </select>
        </div>

        <div>
          <label class="eg-label">Modelo / nombre *</label>
          <input [(ngModel)]="nf.product_name" class="eg-input w-full" [class.!border-rose-400]="fe('product_name')" placeholder="Ej. CAMPUS MK" />
          <dlx-field-error [error]="fe(\'product_name\')" />
        </div>

        <div>
          <label class="eg-label">Descripción (opcional)</label>
          <textarea [(ngModel)]="nf.description" rows="2" class="eg-input w-full" placeholder="Descripción breve del producto…"></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="relative">
            <label class="eg-label">Marca *</label>
            <input [(ngModel)]="nf.brand" (focus)="brandOpen.set(true)" (ngModelChange)="brandOpen.set(true)" (blur)="closeSoon('brand')"
                   class="eg-input w-full" [class.!border-rose-400]="fe('brand')" placeholder="Marca" autocomplete="off" />
            @if (brandOpen() && filteredBrands().length) {
              <div class="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl py-1
                          bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
                @for (b of filteredBrands(); track b) {
                  <button type="button" (click)="pickBrand(b)"
                          class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition">{{ b }}</button>
                }
              </div>
            }
            <dlx-field-error [error]="fe(\'brand\')" />
          </div>
          <div class="relative">
            <label class="eg-label">Categoría *</label>
            <input [(ngModel)]="nf.category" (focus)="catOpen.set(true)" (ngModelChange)="catOpen.set(true)" (blur)="closeSoon('cat')"
                   class="eg-input w-full" [class.!border-rose-400]="fe('category')" placeholder="Categoría" autocomplete="off" />
            @if (catOpen() && filteredCats().length) {
              <div class="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl py-1
                          bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
                @for (c of filteredCats(); track c) {
                  <button type="button" (click)="pickCat(c)"
                          class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    {{ c }}@if (parentOf(c)) { <span class="text-slate-400 text-xs"> · {{ parentOf(c) }}</span> }
                  </button>
                }
              </div>
            }
            <dlx-field-error [error]="fe(\'category\')" />
            @if (parentOf(nf.category)) {
              <p class="text-[11px] text-slate-400 mt-1"><i class="fa-solid fa-sitemap"></i> Pertenece a: {{ parentOf(nf.category) }}</p>
            }
          </div>
        </div>

        <div class="space-y-2">
          <label class="eg-label !mb-0">Colores (elige uno o varios)</label>
          <div class="flex flex-wrap gap-1.5">
            @for (c of colorPresets; track c) {
              <button type="button" (click)="toggleColor(c)"
                      class="px-2.5 py-1 rounded-lg text-xs font-semibold border transition inline-flex items-center gap-1.5"
                      [ngClass]="selColors.includes(c) ? 'bg-ink-950 text-white border-ink-950 dark:bg-white dark:text-ink-950' : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70'">
                <span class="w-3 h-3 rounded-full border border-black/10 dark:border-white/20" [style.background]="colorHex(c)"></span>{{ c }}
              </button>
            }
          </div>
          <div class="flex gap-2">
            <input [(ngModel)]="newColor" (keydown.enter)="$event.preventDefault(); addColorText()"
                   class="eg-input flex-1" placeholder="Otro color…" autocomplete="off" />
            <button type="button" class="eg-btn-secondary text-sm" (click)="addColorText()" [disabled]="!newColor.trim()">Añadir</button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="eg-label !mb-0">{{ sizeLabel() }}s (elige una o varias)</label>
          @if (sizePreset().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (s of sizePreset(); track s) {
                <button type="button" (click)="toggleSize(s)"
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                        [ngClass]="selSizes.includes(s) ? 'bg-ink-950 text-white border-ink-950 dark:bg-white dark:text-ink-950' : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70'">{{ s }}</button>
              }
            </div>
          }
          <div class="flex gap-2">
            <input [(ngModel)]="newSizeText" (keydown.enter)="$event.preventDefault(); addSizeText()"
                   class="eg-input flex-1" placeholder="Otra talla/medida…" autocomplete="off" />
            <button type="button" class="eg-btn-secondary text-sm" (click)="addSizeText()" [disabled]="!newSizeText.trim()">Añadir</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <label class="eg-label !mb-0">{{ useMatrix() ? 'Cantidad por color y talla' : 'Cantidad' }}</label>
            @if (comboList().length > 1) {
              <div class="flex items-center gap-1.5">
                <input type="number" min="0" [(ngModel)]="bulkQty" class="eg-input !h-9 w-20 text-center text-sm" />
                <button type="button" class="eg-btn-secondary !h-9 text-xs" (click)="applyBulk()"><i class="fa-solid fa-wand-magic-sparkles"></i> Aplicar a todas</button>
              </div>
            }
          </div>

          @if (useMatrix()) {
            <!-- Matriz color × talla (solo con varios colores y varias tallas) -->
            <div class="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
              <table class="text-sm border-collapse min-w-full">
                <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                  <tr>
                    <th class="sticky left-0 z-10 bg-slate-50 dark:bg-[#161a26] px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-200 dark:border-white/10">Color / Talla</th>
                    @for (sz of sizesOrDefault(); track sz) { <th class="px-2 py-2 text-center font-semibold min-w-[64px]">{{ sz || '—' }}</th> }
                  </tr>
                </thead>
                <tbody>
                  @for (c of colorsOrDefault(); track c) {
                    <tr class="border-t border-slate-100 dark:border-white/5">
                      <td class="sticky left-0 z-10 bg-white dark:bg-[#121826] px-3 py-2 font-medium whitespace-nowrap border-r border-slate-200 dark:border-white/10">
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full border border-black/10 dark:border-white/20" [style.background]="colorHex(c)"></span>{{ c || '—' }}</span>
                      </td>
                      @for (sz of sizesOrDefault(); track sz) {
                        <td class="px-1.5 py-1.5 text-center">
                          <input type="number" min="0" [ngModel]="getQty(c, sz)" (ngModelChange)="setQty(c, sz, $event)"
                                 class="eg-input !h-9 w-16 text-center text-sm" placeholder="0" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <!-- Lista simple (1 sola combinación o una sola dimensión múltiple) -->
            <div class="space-y-2">
              @for (cb of comboList(); track cb.key) {
                <div class="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-3 h-12">
                  <span class="flex-1 text-sm font-medium truncate inline-flex items-center gap-1.5">
                    @if (cb.color) { <span class="w-3 h-3 rounded-full border border-black/10 dark:border-white/20 shrink-0" [style.background]="colorHex(cb.color)"></span> }
                    {{ comboLabel(cb) }}
                  </span>
                  <div class="w-28 shrink-0">
                    <input type="number" min="0" [ngModel]="getQty(cb.color, cb.size)" (ngModelChange)="setQty(cb.color, cb.size, $event)"
                           class="eg-input !h-9 w-full text-center" placeholder="0" />
                  </div>
                </div>
              }
            </div>
          }
          <p class="text-xs text-slate-400 mt-2">Total: <b class="text-ink-950 dark:text-white">{{ totalUnits() }}</b> unidad(es) · <b>{{ comboCount() }}</b> variante(s)</p>
        </div>

        <div>
          <label class="eg-label">Código de barras</label>
          <input [(ngModel)]="nf.barcode" class="eg-input w-full font-mono" placeholder="Escanea o escribe (opcional)" />
          <p class="text-[11px] text-slate-400 mt-1">Si lo dejas vacío, el sistema genera un código interno.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="eg-label">Costo (compra)</label>
            <dlx-price-input [(ngModel)]="nf.cost" extraClass="w-full" />
          </div>
          <div>
            <label class="eg-label">Precio venta (sin IVA)</label>
            <dlx-price-input [(ngModel)]="nf.price" extraClass="w-full" />
          </div>
        </div>
        @if ((+nf.price || 0) > 0 || (+nf.cost || 0) > 0) {
          <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-xs space-y-1">
            <div class="flex justify-between"><span class="text-slate-500">Precio sin IVA</span><span>{{ money(+nf.price || 0) }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">IVA ({{ ivaRate() }}%)</span><span>{{ money(ivaAmount()) }}</span></div>
            <div class="flex justify-between font-semibold"><span>Precio final con IVA</span><span class="text-[#1e40af] dark:text-[#7aa2ff]">{{ money(finalPrice()) }}</span></div>
            <div class="flex justify-between border-t border-slate-200 dark:border-white/10 pt-1 mt-1">
              <span class="text-slate-500">Margen (precio − costo)</span>
              <span [class.text-emerald-600]="margin() >= 0" [class.text-rose-600]="margin() < 0">{{ money(margin()) }}@if (marginPct()) { · {{ marginPct() | number:'1.0-0' }}% }</span>
            </div>
          </div>
        }

        <div>
          <dlx-image-uploader [(ngModel)]="images" label="Fotos del producto (opcional)" [maxImages]="8" />
        </div>

        @if (error()) { <p class="text-rose-600 text-sm">{{ error() }}</p> }

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
          <button type="button" (click)="cancel.emit()" class="eg-btn-secondary">Cancelar</button>
          <button type="button" (click)="submit()" class="eg-btn-primary">
            <i class="fa-solid fa-plus"></i> Agregar a la recepción
          </button>
        </div>
      </div>
    </dlx-modal>
  `,
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
  ivaAmount(): number { return (+this.nf.price || 0) * this.ivaRate() / 100; }
  finalPrice(): number { return (+this.nf.price || 0) + this.ivaAmount(); }
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
