import { ChangeDetectionStrategy, Component, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService, ProductPayload } from '@features/superadmin/services/product.service';
import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { AuthService } from '@core/services/auth.service';
import { BrandService } from '@features/superadmin/services/brand.service';
import { CategoryService } from '@features/superadmin/services/category.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import {
  ManualProductModalComponent, ManualProduct, ProductInitial,
} from '@features/superadmin/components/manual-product-modal/manual-product-modal.component';

interface VRow {
  stockId: number;
  label: string;
  sku: string;
  price: number;   // precio de venta de la variante (override o base)
  cost: number;
  qty: number;
  origPrice: number;
  origCost: number;
  origQty: number;
}

@Component({
  selector: 'dlx-product-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManualProductModalComponent, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-4 md:px-6 py-6 pb-28">
      <div class="mb-5 flex items-center gap-3">
        <a routerLink="/app/admin/inventory" class="w-9 h-9 grid place-items-center rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
          <i class="fa-solid fa-arrow-left"></i>
        </a>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Editar producto</h1>
          <p class="text-slate-500 text-sm">Actualiza los datos del producto y el precio, costo y unidades de cada variante.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
      } @else if (init()) {
        <dlx-manual-product-modal [embedded]="true" [mode]="'edit'"
                                  [initial]="init()" [saving]="saving()"
                                  [showPrice]="showPriceField()" [showSubmit]="false"
                                  [brands]="brands()" [categories]="categories()" [categoryParents]="categoryParents()"
                                  (add)="onSave($event)" />

        <!-- Precios por variante -->
        @if (variants().length) {
          <div class="card p-5 mt-5">
            <div class="flex items-center justify-between mb-1">
              <h2 class="font-bold tracking-tight">Precios por variante</h2>
              <span class="text-xs text-slate-400">{{ variants().length }} variante(s)</span>
            </div>
            <p class="text-[11px] text-slate-400 mb-3">Cada talla/color tiene su propio precio, costo y unidades.@if (showPriceField()) {  Si cambias el precio de arriba, se aplica a todas.}</p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                  <tr class="text-left">
                    <th class="px-3 py-2.5 font-semibold">Variante</th>
                    <th class="px-3 py-2.5 font-semibold text-right min-w-[130px]">Precio</th>
                    <th class="px-3 py-2.5 font-semibold text-right min-w-[130px]">Costo</th>
                    <th class="px-3 py-2.5 font-semibold text-center min-w-[100px]">Unidades</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                  @for (v of variants(); track v.stockId) {
                    <tr>
                      <td class="px-3 py-2.5">
                        <p class="font-medium">{{ v.label }}</p>
                        <p class="text-[11px] text-slate-400 font-mono">{{ v.sku }}</p>
                      </td>
                      <td class="px-3 py-2.5 text-right"><dlx-price-input [(ngModel)]="v.price" extraClass="!h-9 w-28 text-right text-sm" /></td>
                      <td class="px-3 py-2.5 text-right"><dlx-price-input [(ngModel)]="v.cost" extraClass="!h-9 w-28 text-right text-sm" /></td>
                      <td class="px-3 py-2.5 text-center">
                        <input type="number" min="0" [(ngModel)]="v.qty" class="eg-input !h-9 w-20 text-center text-sm font-bold" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Barra de guardado (al final; guarda producto + variantes) -->
        <div class="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0d1320]/90 backdrop-blur px-4 md:px-6 py-3 flex justify-end">
          <button type="button" (click)="triggerSave()" [disabled]="saving()"
                  class="eg-btn-primary inline-flex items-center gap-2 disabled:opacity-70">
            <i class="fa-solid" [ngClass]="saving() ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>
            Guardar cambios
          </button>
        </div>
      } @else {
        <div class="card p-12 text-center text-slate-400">No se pudo cargar el producto.</div>
      }
    </div>
  `,
})
export class ProductEditComponent implements OnInit {
  private svc = inject(ProductService);
  private inv = inject(InventoryService);
  private branchCtx = inject(BranchContextService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);

  @ViewChild(ManualProductModalComponent) manual?: ManualProductModalComponent;

  constructor() {
    // La carga espera a que la sesión esté lista (si no, al refrescar la petición
    // de stocks sale sin el contexto de sucursal y la tabla de variantes queda vacía).
    effect(() => {
      const u = this.auth.user();
      if (u && !this.started) { this.started = true; this.load(); }
    });
  }
  private started = false;

  loading = signal(true);
  saving = signal(false);
  init = signal<ProductInitial | null>(null);
  variants = signal<VRow[]>([]);
  /** ¿Mostrar el precio único de arriba? Solo si todas las variantes tienen el mismo precio. */
  showPriceField = signal(true);
  private origUniquePrice: number | null = null;
  brands = signal<string[]>([]);
  categories = signal<string[]>([]);
  categoryParents = signal<Record<string, string>>({});
  private productId = 0;

  ngOnInit(): void {
    this.brandSvc.list({ page_size: 100 }).subscribe(r => this.brands.set(r.results.map(b => b.name)));
    this.catSvc.list({ page_size: 100 }).subscribe(r => {
      this.categories.set(r.results.map(c => c.name));
      const map: Record<string, string> = {};
      for (const c of r.results) { if (c.parent_name) map[c.name] = c.parent_name; }
      this.categoryParents.set(map);
    });
  }

  private load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.loading.set(false); return; }
    this.productId = id;
    forkJoin({
      p: this.svc.get(id),
      st: this.inv.stocks({ product: id, branch: this.branchCtx.current() ?? undefined, page_size: 200 }),
    }).subscribe({
      next: ({ p, st }) => {
        const rows: VRow[] = (st.results || []).map((s: Stock) => {
          const price = s.price_override != null ? +s.price_override : (+s.base_price || 0);
          const cost = +(s.cost ?? 0) || 0;
          const attrs = s.variant_attributes;
          const label = (attrs && Object.keys(attrs).length)
            ? Object.values(attrs).join(' · ')
            : `${s.variant_size || '—'} / ${s.variant_color || '—'}`;
          return {
            stockId: s.id, label, sku: s.variant_sku,
            price, cost, qty: s.quantity,
            origPrice: price, origCost: cost, origQty: s.quantity,
          };
        });
        this.variants.set(rows);

        // El precio de arriba solo se muestra si TODAS las variantes cuestan igual.
        const prices = rows.map(v => v.price);
        const unique = prices.length && prices.every(x => x === prices[0]) ? prices[0] : null;
        this.origUniquePrice = unique;
        this.showPriceField.set(unique != null);

        const firstBarcode = p.variants_detail?.find(v => v.barcode)?.barcode || '';
        this.init.set({
          product_name: p.name,
          brand: p.brand_name || '',
          category: p.category_name || '',
          kind: 'OTRO',
          description: p.description || '',
          barcode: firstBarcode,
          base_price: unique != null ? unique : (Number(p.base_price) || 0),
          compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
          tax_rate: p.tax_rate != null ? Number(p.tax_rate) : null,
          discount_percent: Number(p.discount_percent ?? 0) || 0,
          images: (p.images || []).map(i => i.url),
        });
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('No se pudo cargar el producto.'); },
    });
  }

  /** El botón de la barra inferior dispara el submit del formulario del producto. */
  triggerSave(): void { this.manual?.submit(); }

  onSave(list: ManualProduct[]): void {
    const p = list[0];
    if (!p) return;
    this.saving.set(true);
    // Si el precio único de arriba cambió, se aplica a TODAS las variantes.
    if (this.showPriceField() && this.origUniquePrice != null && +p.price > 0 && +p.price !== this.origUniquePrice) {
      this.variants.update(rows => rows.map(v => ({ ...v, price: +p.price })));
    }
    // Datos a nivel de producto. NO se envía base_price: el precio es por variante.
    const body: Partial<ProductPayload> = {
      name: p.product_name,
      brand_name: p.brand || '',
      category_name: p.category || '',
      description: p.description,
      tax_rate: p.tax_rate,
      discount_percent: p.discount_percent,
      tag: (p.discount_percent > 0) ? 'SALE' : '',
      main_image_url: p.images[0] || '',
      images: p.images.map((u, i) => ({ url: u, sort_order: i, is_main: i === 0 } as any)),
    };
    this.svc.update(this.productId, body).subscribe({
      next: () => this.saveVariants(),
      error: e => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo guardar.'); },
    });
  }

  /** Tras guardar el producto, aplica los cambios por variante (precio/costo/unidades). */
  private saveVariants(): void {
    const reqs: any[] = [];
    for (const v of this.variants()) {
      const priceCh = +v.price !== +v.origPrice;
      const costCh = +v.cost !== +v.origCost;
      if (priceCh || costCh) {
        reqs.push(this.inv.setPricing(v.stockId, {
          base_price: priceCh ? +v.price : undefined,
          cost: costCh ? +v.cost : undefined,
        }));
      }
      const delta = +v.qty - +v.origQty;
      if (delta !== 0) {
        reqs.push(this.inv.adjust(v.stockId, delta, 'Ajuste desde edición de producto', 'ADJ', 'CONTEO'));
      }
    }
    const done = () => {
      this.saving.set(false);
      this.notify.success('Producto actualizado');
      this.router.navigate(['/app/admin/inventory']);
    };
    if (!reqs.length) { done(); return; }
    forkJoin(reqs).subscribe({
      next: done,
      error: () => { this.saving.set(false); this.notify.error('El producto se guardó, pero algunas variantes no.'); this.router.navigate(['/app/admin/inventory']); },
    });
  }
}
