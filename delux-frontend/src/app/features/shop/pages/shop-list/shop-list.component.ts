import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';
import { PublicCatalogService } from '@shared/services/public-catalog.service';
import { ZoneService } from '@shared/services/zone.service';
import { BrandingService } from '@core/services/branding.service';


interface Product {
  id: string; name: string; brand: string;
  category: 'zapatillas' | 'ropa' | 'mochilas' | 'accesorios';
  price: number; oldPrice?: number; colors: string[]; sizes: string[];
  image: string; tag?: 'Nuevo' | 'Drop' | 'Oferta' | 'Exclusivo';
  gender: 'men' | 'women' | 'unisex'; available: boolean; soldOut?: boolean;
}
interface Filter { categories: string[]; brands: string[]; sizes: string[]; priceMin: number; priceMax: number; }

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
  gender = signal<'all' | 'men' | 'women' | 'unisex'>('all');
  sortBy = signal<'relevance' | 'price-asc' | 'price-desc' | 'new'>('relevance');
  filter = signal<Filter>({ categories: [], brands: [], sizes: [], priceMin: 0, priceMax: 500 });

  readonly categories = [
    { slug: 'zapatillas', label: 'Zapatillas', count: 8 },
    { slug: 'ropa', label: 'Ropa', count: 6 },
    { slug: 'mochilas', label: 'Mochilas', count: 4 },
    { slug: 'accesorios', label: 'Accesorios', count: 5 },
  ];
  readonly brands = ['Nike', 'Adidas', 'Puma', 'New Balance', 'Vans', 'Converse', 'Jordan'];
  readonly sizes = ['38', '39', '40', '41', '42', '43', 'S', 'M', 'L', 'XL'];
  readonly genders = [
    { value: 'all' as const, label: 'Todos' },
    { value: 'men' as const, label: 'Hombre' },
    { value: 'women' as const, label: 'Mujer' },
    { value: 'unisex' as const, label: 'Unisex' },
  ];

products = signal<Product[]>([]);
  loadingProducts = signal(true);
  loadingMore = signal(false);
  total = signal(0);
  private page = 1;
  private readonly pageSize = 40;
  private currentCity: string | null = null;
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
    // Recarga el catálogo segun la ciudad elegida por el cliente.
    effect(() => { const c = this.zone.city(); this.loadProducts(c); });
  }

  private mapProduct = (pp: any): Product => ({
    id: String(pp.id),
    name: pp.name,
    brand: pp.brand_name,
    category: (pp.category_name || '').toLowerCase() as Product['category'],
    price: Number(pp.base_price),
    oldPrice: pp.compare_at_price ? Number(pp.compare_at_price) : undefined,
    colors: [],
    sizes: [],
    image: pp.thumb_url || pp.main_image_url || IMG_PLACEHOLDER,
    tag: this.mapTag(pp.tag),
    gender: this.mapGender(pp.gender),
    available: pp.available_in_city !== false,
    soldOut: pp.in_stock === false,
  });

  private loadProducts(city: string | null): void {
    this.currentCity = city;
    this.page = 1;
    this.loadingProducts.set(true);
    this.catalog.listProducts({ city: city || undefined, sort: 'new', page: 1, page_size: this.pageSize }).subscribe({
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
    this.catalog.listProducts({ city: this.currentCity || undefined, sort: 'new', page: this.page, page_size: this.pageSize }).subscribe({
      next: r => {
        this.products.set([...this.products(), ...(r.results || []).map(this.mapProduct)]);
        this.total.set(r.count || 0);
        this.loadingMore.set(false);
      },
      error: () => { this.page -= 1; this.loadingMore.set(false); },
    });
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

    filtered = computed(() => {
    const f = this.filter(); const g = this.gender(); const sort = this.sortBy();
    let list = this.products().filter(p => {
      if (f.categories.length && !f.categories.includes(p.category)) return false;
      if (f.brands.length && !f.brands.includes(p.brand)) return false;
      if (f.sizes.length && p.sizes.length && !p.sizes.some(s => f.sizes.includes(s))) return false;
      if (p.price < f.priceMin || p.price > f.priceMax) return false;
      if (g !== 'all' && p.gender !== g && p.gender !== 'unisex') return false;
      return true;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    // Disponibles en la ciudad primero (orden estable dentro de cada grupo).
    list = [...list].sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1));
    return list;
  });

  availableCount = computed(() => this.filtered().filter(p => p.available).length);
  unavailableCount = computed(() => this.filtered().filter(p => !p.available).length);
  firstUnavailableId = computed(() => this.filtered().find(p => !p.available)?.id ?? null);

  activeFiltersCount = computed(() => {
    const f = this.filter();
    return f.categories.length + f.brands.length + f.sizes.length + (this.gender() !== 'all' ? 1 : 0);
  });

  toggleCategory(c: string) { const list = this.filter().categories; this.filter.update(f => ({ ...f, categories: list.includes(c) ? list.filter(x => x !== c) : [...list, c] })); }
  toggleBrand(b: string) { const list = this.filter().brands; this.filter.update(f => ({ ...f, brands: list.includes(b) ? list.filter(x => x !== b) : [...list, b] })); }
  toggleSize(s: string) { const list = this.filter().sizes; this.filter.update(f => ({ ...f, sizes: list.includes(s) ? list.filter(x => x !== s) : [...list, s] })); }
  setPriceMin(v: string) { this.filter.update(f => ({ ...f, priceMin: +v || 0 })); }
  setPriceMax(v: string) { this.filter.update(f => ({ ...f, priceMax: +v || 500 })); }
  setGender(g: 'all' | 'men' | 'women' | 'unisex') { this.gender.set(g); }
  setSort(s: any) { this.sortBy.set(s); }
  resetFilters() {
    this.filter.set({ categories: [], brands: [], sizes: [], priceMin: 0, priceMax: 500 });
    this.gender.set('all');
  }
}
