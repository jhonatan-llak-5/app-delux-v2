import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService, ProductPayload } from '@features/superadmin/services/product.service';
import { BrandService } from '@features/superadmin/services/brand.service';
import { CategoryService } from '@features/superadmin/services/category.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import {
  ManualProductModalComponent, ManualProduct, ProductInitial,
} from '@features/superadmin/components/manual-product-modal/manual-product-modal.component';

@Component({
  selector: 'dlx-product-edit',
  standalone: true,
  imports: [CommonModule, RouterLink, ManualProductModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-4 md:px-6 py-6 max-w-5xl mx-auto">
      <div class="mb-5 flex items-center gap-3">
        <a routerLink="/app/admin/inventory" class="w-9 h-9 grid place-items-center rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
          <i class="fa-solid fa-arrow-left"></i>
        </a>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Editar producto</h1>
          <p class="text-slate-500 text-sm">Actualiza los datos del producto. El stock y las variantes se ajustan desde la tabla de inventario.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
      } @else if (init()) {
        <dlx-manual-product-modal [embedded]="true" [mode]="'edit'"
                                  [initial]="init()" [saving]="saving()"
                                  [brands]="brands()" [categories]="categories()" [categoryParents]="categoryParents()"
                                  (add)="onSave($event)" />
      } @else {
        <div class="card p-12 text-center text-slate-400">No se pudo cargar el producto.</div>
      }
    </div>
  `,
})
export class ProductEditComponent implements OnInit {
  private svc = inject(ProductService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);

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

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.loading.set(false); return; }
    this.productId = id;
    this.svc.get(id).subscribe({
      next: p => {
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
          images: (p.images || []).map(i => i.url),
        });
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('No se pudo cargar el producto.'); },
    });
  }

  onSave(list: ManualProduct[]): void {
    const p = list[0];
    if (!p) return;
    this.saving.set(true);
    const body: Partial<ProductPayload> = {
      name: p.product_name,
      brand_name: p.brand || '',
      category_name: p.category || '',
      description: p.description,
      base_price: p.price,
      compare_at_price: p.compare_at_price,
      tax_rate: p.tax_rate,
      tag: p.compare_at_price ? 'SALE' : '',
      main_image_url: p.images[0] || '',
      images: p.images.map((u, i) => ({ url: u, sort_order: i, is_main: i === 0 } as any)),
    };
    this.svc.update(this.productId, body).subscribe({
      next: () => { this.saving.set(false); this.notify.success('Producto actualizado'); this.router.navigate(['/app/admin/inventory']); },
      error: e => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo guardar.'); },
    });
  }
}
