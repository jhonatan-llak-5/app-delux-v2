import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal, effect} from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Product, ProductService, ProductSummary } from '@features/superadmin/services/product.service';
import { BrandService, Brand } from '@features/superadmin/services/brand.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { InventoryService } from '@features/superadmin/services/inventory.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { onImageError } from '@shared/utils/img-placeholder';
import { NotifyService } from '@shared/services/notify.service';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';

@Component({
  selector: 'dlx-products-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-list.component.html',
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
  private branchCtx = inject(BranchContextService);
  private ready = false;
  constructor() {
    // Reacciona al selector GLOBAL de sucursal del header.
    effect(() => { this.branchCtx.current(); if (this.ready) this.reload(); }, { allowSignalWrites: true });
  }

  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;

  ngOnDestroy(): void { this.stopCamera(); this.io?.disconnect(); }

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
  total = signal(0);
  summary = signal<ProductSummary | null>(null);
  loadingMore = signal(false);
  private page = 1;
  private readonly pageSize = 40;
  hasMore = computed(() => this.products().length < this.total());
  private io?: IntersectionObserver;
  @ViewChild('loadSentinel') set sentinel(ref: ElementRef<HTMLElement> | undefined) {
    this.io?.disconnect();
    const el = ref?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) this.loadMore();
    }, { rootMargin: '400px' });
    this.io.observe(el);
  }
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
    this.reload();
    this.ready = true;
  }

  private filters() {
    return {
      search: this.search(),
      brand: this.brandFilter || undefined,
      category: this.categoryFilter || undefined,
      status: this.statusFilter || undefined,
      branch: this.branchCtx.current() || undefined,
    };
  }

  reload(): void {
    this.loading.set(true);
    this.page = 1;
    this.svc.summary().subscribe(sm => this.summary.set(sm));
    this.svc.list({ ...this.filters(), page: 1, page_size: this.pageSize }).subscribe({
      next: r => { this.products.set(r.results); this.total.set(r.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadMore(): void {
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.svc.list({ ...this.filters(), page: this.page, page_size: this.pageSize }).subscribe({
      next: r => {
        this.products.set([...this.products(), ...r.results]);
        this.total.set(r.count);
        this.loadingMore.set(false);
      },
      error: () => { this.page -= 1; this.loadingMore.set(false); },
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

}
