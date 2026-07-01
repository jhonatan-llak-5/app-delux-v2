import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Product, ProductService } from '@features/superadmin/services/product.service';
import { BrandService, Brand } from '@features/superadmin/services/brand.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { InventoryService } from '@features/superadmin/services/inventory.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { onImageError } from '@shared/utils/img-placeholder';
import { NotifyService } from '@shared/services/notify.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'dlx-products-list',
  standalone: true,
  imports: [DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink],
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
        <button (click)="cameraOn() ? stopCamera() : startCamera()"
                class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#334155]
                       text-slate-700 dark:text-slate-200 text-sm font-semibold
                       hover:bg-slate-100 dark:hover:bg-[#1e293b] transition flex items-center gap-2">
          <i class="fa-solid" [class.fa-barcode]="!cameraOn()" [class.fa-xmark]="cameraOn()"></i>
          {{ cameraOn() ? 'Cerrar' : 'Escanear' }}
        </button>
        <a routerLink="/app/admin/products/import"
           class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#334155]
                  text-slate-700 dark:text-slate-200 text-sm font-semibold
                  hover:bg-slate-100 dark:hover:bg-[#1e293b] transition flex items-center gap-2">
          <i class="fa-solid fa-file-import"></i> Importar masivo
        </a>
        <a routerLink="/app/admin/products/new"
           class="px-4 py-2.5 rounded-lg bg-[var(--dash-primary)] dark:bg-[#2563eb]
                  text-white text-sm font-semibold
                  hover:bg-[var(--dash-primary-d)] dark:hover:bg-[var(--dash-primary-d)] transition flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> Nuevo producto
        </a>
      </div>
    </div>

    @if (cameraOn()) {
      <div class="rounded-2xl overflow-hidden bg-black relative mb-4 max-w-md">
        <video #camVideo class="w-full max-h-72 object-contain" muted playsinline></video>
        <div class="absolute inset-0 border-4 border-white/30 m-8 rounded-lg pointer-events-none"></div>
        <p class="absolute bottom-2 left-0 right-0 text-center text-white/80 text-sm">Apunta al código del producto</p>
      </div>
    }
    @if (camError()) { <p class="text-sm text-amber-600 mb-3">{{ camError() }}</p> }

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <dlx-stat-card label="Total" [value]="products().length" icon="fa-box" />
      <dlx-stat-card label="Publicados" [value]="countByStatus('PUBLISHED')" icon="fa-circle-check" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Borradores" [value]="countByStatus('DRAFT')" icon="fa-pen-ruler" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      <dlx-stat-card label="Destacados" [value]="featuredCount()" icon="fa-star" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
    </div>

    <!-- Filtros -->
    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por nombre, slug o descripción..." class="flex-1 min-w-64" />
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
      @if (showStoreFilter()) {
        <select [(ngModel)]="branchFilter" (change)="reload()" title="Filtrar por tienda"
                class="eg-input border-transparent">
          <option [ngValue]="null">Todas las tiendas</option>
          @for (b of stores(); track b.id) { <option [ngValue]="b.id">{{ b.name }} · {{ b.city }}</option> }
        </select>
      }
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
export class ProductsListComponent implements OnInit, OnDestroy {
  private svc = inject(ProductService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private adminSvc = inject(AdminService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private inv = inject(InventoryService);
  private auth = inject(AuthService);

  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;

  ngOnDestroy(): void { this.stopCamera(); }

  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta escaneo por cámara. Usa el buscador por nombre.');
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
      if (codes && codes.length) { this.onCode(codes[0].rawValue || ''); return; }
    } catch { /* frame sin código */ }
    if (this.cameraOn()) this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  private onCode(raw: string): void {
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (!code) return;
    this.stopCamera();
    this.inv.scan(code).subscribe({
      next: (r) => {
        if (r.found && r.variant) {
          this.router.navigate(['/app/admin/products', r.variant.product_id]);
        } else {
          this.notify.error('No se encontró un producto con ese código.');
        }
      },
      error: () => this.notify.error('No se pudo buscar el código.'),
    });
  }
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
  // Mostrar filtro de tienda solo si la cuenta ve varias sucursales.
  showStoreFilter = computed(() => {
    const u = this.auth.user();
    if (!u) return false;
    if (u.role === 'SUPERADMIN' || u.role === 'TENANT_ADMIN') return true;
    return !u.branch_id;
  });
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

  onImgErr(ev: Event) { onImageError(ev); }
}
