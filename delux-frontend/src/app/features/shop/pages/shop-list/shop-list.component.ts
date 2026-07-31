import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';
import { PublicCatalogService, FacetCategory, FacetBrand, FacetGender } from '@shared/services/public-catalog.service';
import { ZoneService } from '@shared/services/zone.service';
import { BrandingService } from '@core/services/branding.service';


interface Product {
  id: string; name: string; brand: string;
  category: 'zapatillas' | 'ropa' | 'mochilas' | 'accesorios';
  price: number; oldPrice?: number; colors: string[]; sizes: string[];
  image: string; tag?: 'Nuevo' | 'Drop' | 'Oferta' | 'Exclusivo';
  gender: 'men' | 'women' | 'unisex'; available: boolean; soldOut?: boolean;
  branches: { id: number; name: string; province: string; stock: number }[];
}
interface Filter { categories: string[]; brands: number[]; sizes: string[]; priceMin: number | null; priceMax: number | null; }

@Component({
  selector: 'dlx-shop-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, CommonModule, RouterLink, HeroSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shop-list.component.html',
})
export class ShopListComponent {
  private catalog = inject(PublicCatalogService);
  zone = inject(ZoneService);
  branding = inject(BrandingService);
  showFilters = signal(false);
  isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  // Estado de colapso del sidebar de filtros (acordeón). Todas abiertas por defecto,
  // pero el usuario puede cerrar las que no usa para evitar scroll excesivo.
  openSections = signal<Record<string, boolean>>({ gender: true, cat: true, brand: true, size: true, price: true });
  isSectionOpen(key: string): boolean { return this.openSections()[key] !== false; }
  toggleSection(key: string): void { this.openSections.update(s => ({ ...s, [key]: !this.isSectionOpen(key) })); }
  // Género seleccionado: 'all' o el value del backend (MEN/WOMEN/UNISEX/KIDS).
  gender = signal<string>('all');
  sortBy = signal<'relevance' | 'price-asc' | 'price-desc' | 'new'>('relevance');
  filter = signal<Filter>({ categories: [], brands: [], sizes: [], priceMin: null, priceMax: null });

  // Facets dinámicos poblados desde GET /products/facets/.
  facetCats = signal<FacetCategory[]>([]);
  facetBrands = signal<FacetBrand[]>([]);
  facetSizes = signal<string[]>([]);
  facetGenders = signal<FacetGender[]>([]);
  priceBounds = signal<{ min: number; max: number }>({ min: 0, max: 0 });

products = signal<Product[]>([]);
  loadingProducts = signal(true);
  loadingMore = signal(false);
  total = signal(0);
  private page = 1;
  private readonly pageSize = 40;
  private currentProvince: string | null = null;
  private reloadTimer: any;
  private firstReload = true;
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

  constructor() {
    // Facets dinámicos: dependen de la provincia elegida por el cliente.
    effect(() => {
      const province = this.zone.province();
      this.loadFacets(province);
    });
    // Recarga desde el backend ante cualquier cambio de filtros/orden/provincia.
    effect(() => {
      // Lecturas para que el effect trackee estas dependencias.
      const province = this.zone.province();
      this.filter(); this.gender(); this.sortBy();
      this.currentProvince = province;
      this.scheduleReload();
    });
  }

  /** Debounce corto: precio/escritura no disparan una petición por tecla. */
  private scheduleReload(): void {
    // El primer disparo carga de inmediato; los cambios de filtro se debouncean.
    const delay = this.firstReload ? 0 : 280;
    this.firstReload = false;
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.loadProducts(), delay);
  }

  private loadFacets(province: string | null): void {
    this.catalog.facets({ province: province || undefined }).subscribe({
      next: f => {
        this.facetCats.set(f.categories || []);
        this.facetBrands.set(f.brands || []);
        this.facetSizes.set(f.sizes || []);
        this.facetGenders.set(f.genders || []);
        this.priceBounds.set({ min: f.min_price ?? 0, max: f.max_price ?? 0 });
      },
      error: () => {
        this.facetCats.set([]); this.facetBrands.set([]); this.facetSizes.set([]);
        this.facetGenders.set([]); this.priceBounds.set({ min: 0, max: 0 });
      },
    });
  }

  private mapSort(s: 'relevance' | 'price-asc' | 'price-desc' | 'new'): 'new' | 'featured' | 'price-asc' | 'price-desc' {
    return s === 'relevance' ? 'featured' : s;
  }

  /** Construye los query params del backend a partir del estado de filtros. */
  private buildParams(page: number): Parameters<PublicCatalogService['listProducts']>[0] {
    const f = this.filter();
    const g = this.gender();
    const params: Parameters<PublicCatalogService['listProducts']>[0] = {
      province: this.currentProvince || undefined,
      sort: this.mapSort(this.sortBy()),
      page,
      page_size: this.pageSize,
    };
    if (f.categories.length) params.category = f.categories.join(',');
    if (f.brands.length) params.brand = f.brands.join(',');
    if (f.sizes.length) params.size = f.sizes.join(',');
    if (g !== 'all') params.gender = g;
    if (f.priceMin != null) params.price_min = f.priceMin;
    if (f.priceMax != null) params.price_max = f.priceMax;
    return params;
  }

  private mapProduct = (pp: any): Product => ({
    id: String(pp.id),
    name: pp.name,
    brand: pp.brand_name,
    category: (pp.category_name || '').toLowerCase() as Product['category'],
    price: Number(pp.base_price),
    oldPrice: pp.compare_at_price ? Number(pp.compare_at_price) : undefined,
    colors: pp.colors || [],
    sizes: pp.sizes || [],
    image: pp.thumb_url || pp.main_image_url || IMG_PLACEHOLDER,
    tag: this.mapTag(pp.tag),
    gender: this.mapGender(pp.gender),
    available: pp.available_in_city !== false,
    soldOut: pp.in_stock === false,
    branches: pp.branches || [],
  });

  private loadProducts(): void {
    this.page = 1;
    this.loadingProducts.set(true);
    this.catalog.listProducts(this.buildParams(1)).subscribe({
      next: r => {
        this.products.set((r.results || []).map(this.mapProduct));
        this.total.set(r.count || 0);
        this.loadingProducts.set(false);
      },
      error: () => { this.products.set([]); this.total.set(0); this.loadingProducts.set(false); },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || this.loadingProducts() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.catalog.listProducts(this.buildParams(this.page)).subscribe({
      next: r => {
        this.products.set([...this.products(), ...(r.results || []).map(this.mapProduct)]);
        this.total.set(r.count || 0);
        this.loadingMore.set(false);
      },
      error: () => { this.page -= 1; this.loadingMore.set(false); },
    });
  }

  /** "Sucursal Norte" o "Sucursal Norte +2" cuando hay varias. */
  branchLabel(p: Product): string {
    const bs = p.branches || [];
    if (!bs.length) return '';
    const first = bs[0].name;
    return bs.length > 1 ? `${first} +${bs.length - 1}` : first;
  }

  private mapTag(t: string): Product['tag'] {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as const)[t as 'NEW'] ?? undefined;
  }
  private mapGender(g: string): Product['gender'] {
    const m = (g || '').toUpperCase();
    if (m === 'MEN') return 'men';
    if (m === 'WOMEN') return 'women';
    return 'unisex';
  }

  // El backend ya devuelve la lista filtrada/ordenada; aquí solo agrupamos
  // los disponibles en la provincia primero (para el separador "Solo por envío").
  filtered = computed(() =>
    [...this.products()].sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1))
  );

  // "N disponibles en {provincia}" usa el total real que devuelve el backend.
  availableCount = computed(() => this.total());
  unavailableCount = computed(() => this.products().filter(p => !p.available).length);
  firstUnavailableId = computed(() => this.filtered().find(p => !p.available)?.id ?? null);

  activeFiltersCount = computed(() => {
    const f = this.filter();
    const price = (f.priceMin != null || f.priceMax != null) ? 1 : 0;
    return f.categories.length + f.brands.length + f.sizes.length + (this.gender() !== 'all' ? 1 : 0) + price;
  });

  toggleCategory(c: string) { const list = this.filter().categories; this.filter.update(f => ({ ...f, categories: list.includes(c) ? list.filter(x => x !== c) : [...list, c] })); }
  toggleBrand(b: number) { const list = this.filter().brands; this.filter.update(f => ({ ...f, brands: list.includes(b) ? list.filter(x => x !== b) : [...list, b] })); }
  toggleSize(s: string) { const list = this.filter().sizes; this.filter.update(f => ({ ...f, sizes: list.includes(s) ? list.filter(x => x !== s) : [...list, s] })); }
  setPriceMin(v: string) { const n = v === '' ? null : (Number(v) || 0); this.filter.update(f => ({ ...f, priceMin: n })); }
  setPriceMax(v: string) { const n = v === '' ? null : (Number(v) || 0); this.filter.update(f => ({ ...f, priceMax: n })); }
  setGender(g: string) { this.gender.set(g); }
  setSort(s: any) { this.sortBy.set(s); }
  resetFilters() {
    this.filter.set({ categories: [], brands: [], sizes: [], priceMin: null, priceMax: null });
    this.gender.set('all');
  }
}
