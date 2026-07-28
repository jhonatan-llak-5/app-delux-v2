import { ChangeDetectionStrategy, Component, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService, ProductPayload } from '@features/superadmin/services/product.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { AuthService } from '@core/services/auth.service';
import { BrandService } from '@features/superadmin/services/brand.service';
import { CategoryService } from '@features/superadmin/services/category.service';
import { NotifyService } from '@shared/services/notify.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { parseApiError } from '@shared/utils/api-error.util';
import {
  ManualProductModalComponent, ManualProduct, ProductInitial,
} from '@features/superadmin/components/manual-product-modal/manual-product-modal.component';

@Component({
  selector: 'dlx-product-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManualProductModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-4 md:px-6 py-6 pb-28">
      <div class="mb-5 flex items-center gap-3">
        <a routerLink="/app/admin/inventory" class="w-9 h-9 grid place-items-center rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
          <i class="fa-solid fa-arrow-left"></i>
        </a>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Editar producto</h1>
          <p class="text-slate-500 text-sm">Actualiza los datos del producto y, si quieres, agrega variantes o lotes nuevos.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
      } @else if (init()) {
        <dlx-manual-product-modal [embedded]="true" [mode]="'edit'"
                                  [initial]="init()" [saving]="saving()"
                                  [showPrice]="false" [showSubmit]="false"
                                  [brands]="brands()" [categories]="categories()" [categoryParents]="categoryParents()"
                                  (add)="onSave($event)" />

        <!-- Barra de guardado (al final; guarda producto + variantes nuevas) -->
        <div class="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0d1320]/90 backdrop-blur px-4 md:px-6 py-3 flex justify-end gap-2">
          <button type="button" (click)="cancel()" [disabled]="saving()"
                  class="inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-70">
            <i class="fa-solid fa-xmark"></i> Cancelar
          </button>
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
  private branchCtx = inject(BranchContextService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);

  @ViewChild(ManualProductModalComponent) manual?: ManualProductModalComponent;

  constructor() {
    // La carga espera a que la sesión esté lista.
    effect(() => {
      const u = this.auth.user();
      if (u && !this.started) { this.started = true; this.load(); }
    });
  }
  private started = false;

  loading = signal(true);
  saving = signal(false);
  init = signal<ProductInitial | null>(null);
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
    this.svc.get(id).subscribe({
      next: (p) => {
        const firstBarcode = p.variants_detail?.find(v => v.barcode)?.barcode || '';
        this.init.set({
          product_name: p.name,
          brand: p.brand_name || '',
          category: p.category_name || '',
          kind: 'OTRO',
          description: p.description || '',
          barcode: firstBarcode,
          base_price: Number(p.base_price) || 0,
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

  cancel(): void { this.router.navigate(['/app/admin/inventory']); }

  async onSave(list: ManualProduct[]): Promise<void> {
    const p = list[0];
    if (!p) return;
    const newVariants = list.slice(1);  // variantes/lotes nuevos a agregar
    // Si el lote trae unidades, se registrará como una compra: pide confirmación.
    const units = newVariants.reduce((a, v) => a + Math.max(0, +v.quantity || 0), 0);
    if (units > 0) {
      const ok = await this.confirm.ask({
        title: 'Registrar compra',
        message: `Vas a agregar ${newVariants.length} variante(s) con ${units} unidad(es). Este lote quedará registrado como una compra y se sumará al inventario. ¿Continuar?`,
        confirmText: 'Sí, registrar compra',
      });
      if (!ok) return;
    }
    this.saving.set(true);
    // Datos a nivel de producto. NO se envía base_price: el precio es por variante
    // y se edita en la tabla de Inventario.
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
      next: () => this.addNewVariants(newVariants, p.supplier_name || '', p.note || ''),
      error: e => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo guardar.'); },
    });
  }

  /** Si el usuario agregó lotes/variantes nuevas, se crean en el producto. */
  private addNewVariants(items: ManualProduct[], supplierName: string, note: string): void {
    const done = (extra?: string) => {
      this.saving.set(false);
      this.notify.success('Producto actualizado' + (extra ? ` · ${extra}` : ''));
      this.router.navigate(['/app/admin/inventory']);
    };
    if (!items.length) { done(); return; }
    const branch = this.branchCtx.current() ?? this.auth.user()?.branch_id ?? null;
    const variants = items.map(x => ({
      size: x.size || '', color: x.color || '',
      attributes: x.attributes || undefined,
      cost: +x.cost || 0, price: +x.price || 0,
      quantity: Math.max(0, +x.quantity || 0),
    }));
    this.svc.addVariants(this.productId, {
      branch, variants,
      supplier_name: supplierName || undefined,
      note: note || undefined,
    }).subscribe({
      next: r => done(`${r.created} variante(s) nueva(s)`),
      error: () => { this.saving.set(false); this.notify.error('El producto se guardó, pero no se pudieron agregar las variantes nuevas.'); this.router.navigate(['/app/admin/inventory']); },
    });
  }
}
