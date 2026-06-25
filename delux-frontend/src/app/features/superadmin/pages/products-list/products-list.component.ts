import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Product, ProductService } from '@features/superadmin/services/product.service';
import { BrandService, Brand } from '@features/superadmin/services/brand.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-products-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-box"></i>
          <span class="uppercase tracking-widest font-semibold">Catálogo</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-ink-950 dark:text-white">Productos</h1>
        <p class="text-slate-500 dark:text-white/50 text-sm mt-1">
          Administra tu catálogo. {{ products().length }} productos en pantalla.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <a routerLink="/app/admin/products/import"
           class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#334155]
                  text-slate-700 dark:text-slate-200 text-sm font-semibold
                  hover:bg-slate-100 dark:hover:bg-[#1e293b] transition flex items-center gap-2">
          <i class="fa-solid fa-file-import"></i> Importar masivo
        </a>
        <a routerLink="/app/admin/products/new"
           class="px-4 py-2.5 rounded-lg bg-[#1e40af] dark:bg-[#2563eb]
                  text-white text-sm font-semibold
                  hover:bg-[#1e3a8a] dark:hover:bg-[#1d4ed8] transition flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> Nuevo producto
        </a>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total</p>
        <p class="text-2xl font-bold mt-1">{{ products().length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Publicados</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ countByStatus('PUBLISHED') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Borradores</p>
        <p class="text-2xl font-bold text-amber-600 mt-1">{{ countByStatus('DRAFT') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Destacados</p>
        <p class="text-2xl font-bold text-violet-600 mt-1">{{ featuredCount() }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar por nombre, slug o descripción..."
               [ngModel]="search()" (ngModelChange)="onSearch($event)"
               class="eg-input pl-9 pr-3 border-transparent" />
      </div>
      <select [(ngModel)]="brandFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option [ngValue]="null">Todas las marcas</option>
        @for (b of brands(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
      </select>
      <select [(ngModel)]="categoryFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option [ngValue]="null">Todas las categorías</option>
        @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
      </select>
      <select [(ngModel)]="statusFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option value="">Todos los estados</option>
        <option value="PUBLISHED">Publicados</option>
        <option value="DRAFT">Borradores</option>
        <option value="PAUSED">Pausados</option>
        <option value="ARCHIVED">Archivados</option>
      </select>
      <select [(ngModel)]="branchFilter" (change)="reload()" title="Filtrar por tienda"
              class="eg-input border-transparent">
        <option [ngValue]="null">Todas las tiendas</option>
        @for (b of stores(); track b.id) { <option [ngValue]="b.id">{{ b.name }} · {{ b.city }}</option> }
      </select>
    </div>

    <!-- Grid -->
    @if (loading()) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
        <p>Cargando productos...</p>
      </div>
    } @else if (products().length === 0) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-box-open text-3xl mb-3"></i>
        <p>No hay productos que coincidan con los filtros.</p>
      </div>
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        @for (p of products(); track p.id) {
          <div class="card overflow-hidden hover:shadow-lg transition group">
            <!-- Imagen -->
            <div class="relative aspect-square bg-slate-100 overflow-hidden">
              @if (p.main_image_url) {
                <img [src]="p.main_image_url" [alt]="p.name"
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     loading="lazy" crossorigin="anonymous" (error)="onImgErr($event)" />
              } @else {
                <div class="grid place-items-center h-full text-slate-300">
                  <i class="fa-solid fa-image text-3xl"></i>
                </div>
              }

              <!-- Badges -->
              <div class="absolute top-2 left-2 flex flex-col gap-1">
                @if (p.tag) {
                  <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur"
                        [ngClass]="tagBadgeClass(p.tag)">{{ tagLabel(p.tag) }}</span>
                }
                @if (p.is_featured) {
                  <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-violet-600/90 text-white backdrop-blur">
                    <i class="fa-solid fa-star"></i> Featured
                  </span>
                }
              </div>

              <!-- Estado -->
              <span class="absolute top-2 right-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur"
                    [ngClass]="statusBadgeClass(p.status)">
                {{ statusLabel(p.status) }}
              </span>

              <!-- Galería contador -->
              @if (p.images_count > 1) {
                <span class="absolute bottom-2 right-2 text-[10px] font-mono bg-black/40 text-white px-2 py-0.5 rounded backdrop-blur">
                  <i class="fa-solid fa-images"></i> {{ p.images_count }}
                </span>
              }
            </div>

            <!-- Info -->
            <div class="p-4">
              <p class="text-[10px] font-mono uppercase tracking-widest text-slate-500">{{ p.brand_name }} · {{ p.category_name }}</p>
              <h3 class="font-semibold text-sm mt-1 truncate">{{ p.name }}</h3>
              <p class="text-xs text-slate-500 truncate mt-0.5">{{ p.short_description }}</p>

              <div class="mt-3 flex items-baseline justify-between">
                <div>
                  <span class="font-display text-lg font-bold">\${{ p.base_price }}</span>
                  @if (p.compare_at_price) {
                    <span class="text-xs text-slate-400 line-through ml-1">\${{ p.compare_at_price }}</span>
                  }
                </div>
                <div class="text-[10px] font-mono text-slate-500">
                  <i class="fa-solid fa-cube"></i> {{ p.variants_count }}v
                  <span class="ml-1.5"><i class="fa-solid fa-boxes-stacked"></i> {{ p.total_stock ?? 0 }}</span>
                </div>
              </div>

              <!-- Acciones -->
              <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
                <button (click)="edit(p)"
                        class="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.12]
                               text-slate-700 dark:text-white/85 text-xs font-semibold transition">
                  <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button (click)="toggleFeatured(p)" [title]="p.is_featured ? 'Quitar destaque' : 'Destacar'"
                        class="w-9 h-9 rounded-lg hover:bg-violet-100 hover:text-violet-700 transition"
                        [class.text-violet-600]="p.is_featured" [class.text-slate-400]="!p.is_featured">
                  <i class="fa-solid fa-star text-xs"></i>
                </button>
                @if (p.status !== 'PUBLISHED') {
                  <button (click)="publish(p)" title="Publicar"
                          class="w-9 h-9 rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition text-slate-400">
                    <i class="fa-solid fa-rocket text-xs"></i>
                  </button>
                } @else {
                  <button (click)="archive(p)" title="Archivar"
                          class="w-9 h-9 rounded-lg hover:bg-amber-100 hover:text-amber-700 transition text-slate-400">
                    <i class="fa-solid fa-box-archive text-xs"></i>
                  </button>
                }
                <button (click)="remove(p)" title="Eliminar"
                        class="w-9 h-9 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition text-slate-400">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ProductsListComponent implements OnInit {
  private svc = inject(ProductService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private adminSvc = inject(AdminService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  products = signal<Product[]>([]);
  brands = signal<Brand[]>([]);
  categories = signal<Category[]>([]);
  stores = signal<AdminBranch[]>([]);
  loading = signal(true);
  search = signal('');
  brandFilter: number | null = null;
  categoryFilter: number | null = null;
  statusFilter = '';
  branchFilter: number | null = null;
  private search$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.route.queryParamMap.subscribe(pm => {
      const q = pm.get('search');
      if (q !== null && q !== this.search()) { this.search.set(q); this.reload(); }
    });
    this.brandSvc.list({ search: '' }).subscribe(r => this.brands.set(r.results || []));
    this.catSvc.list().subscribe(r => this.categories.set(r.results || []));
    this.adminSvc.listBranches().subscribe(r => this.stores.set(r.results || []));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.svc.list({
      search: this.search(),
      brand: this.brandFilter || undefined,
      category: this.categoryFilter || undefined,
      status: this.statusFilter || undefined,
      branch: this.branchFilter || undefined,
    }).subscribe({
      next: r => { this.products.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  countByStatus(s: string) { return this.products().filter(p => p.status === s).length; }
  featuredCount() { return this.products().filter(p => p.is_featured).length; }

  tagLabel(t: string) {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as any)[t] || t;
  }
  tagBadgeClass(t: string) {
    return ({
      NEW:       'bg-emerald-500/90 text-white',
      DROP:      'bg-cyan-500/90 text-white',
      SALE:      'bg-orange-500/90 text-white',
      EXCLUSIVE: 'bg-ink-950 text-white',
    } as any)[t] || 'bg-slate-500/90 text-white';
  }
  statusLabel(s: string) {
    return ({ PUBLISHED: 'Activo', DRAFT: 'Borrador', PAUSED: 'Pausado', ARCHIVED: 'Archivado' } as any)[s] || s;
  }
  statusBadgeClass(s: string) {
    return ({
      PUBLISHED: 'bg-emerald-100/90 text-emerald-700',
      DRAFT:     'bg-amber-100/90 text-amber-700',
      PAUSED:    'bg-slate-100/90 text-slate-700',
      ARCHIVED:  'bg-rose-100/90 text-rose-700',
    } as any)[s] || 'bg-slate-100/90 text-slate-700';
  }

  edit(p: Product) { this.router.navigate(['/app/admin/products', p.id]); }

  toggleFeatured(p: Product) {
    this.svc.toggleFeatured(p.id).subscribe({
      next: () => { this.notify.success(p.is_featured ? 'Quitado de destacados' : 'Producto destacado'); this.reload(); },
      error: e => this.notify.fromServerError(e),
    });
  }
  publish(p: Product) {
    this.svc.publish(p.id).subscribe({
      next: () => { this.notify.success('Producto publicado'); this.reload(); },
      error: e => this.notify.fromServerError(e),
    });
  }
  archive(p: Product) {
    this.svc.archive(p.id).subscribe({
      next: () => { this.notify.success('Producto archivado'); this.reload(); },
      error: e => this.notify.fromServerError(e),
    });
  }
  async remove(p: Product) {
    const ok = await this.confirm.ask({
      title: 'Eliminar producto',
      message: `¿Eliminar "${p.name}"? Esta acción es permanente y no se puede deshacer.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.svc.delete(p.id).subscribe({
      next: () => {
        // Quita de la lista de inmediato (borrado físico confirmado por el backend).
        this.products.set(this.products().filter(x => x.id !== p.id));
        this.notify.success(`"${p.name}" eliminado`);
      },
      error: e => this.notify.fromServerError(e, 'No se pudo eliminar el producto.'),
    });
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
