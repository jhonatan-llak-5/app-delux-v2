import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PublicCatalogService } from '@shared/services/public-catalog.service';
import { ZoneService } from '@shared/services/zone.service';


interface Product {
  id: string; name: string; brand: string;
  category: 'zapatillas' | 'ropa' | 'mochilas' | 'accesorios';
  price: number; oldPrice?: number; colors: string[]; sizes: string[];
  image: string; tag?: 'Nuevo' | 'Drop' | 'Oferta' | 'Exclusivo';
  gender: 'men' | 'women' | 'unisex'; available: boolean;
}
interface Filter { categories: string[]; brands: string[]; sizes: string[]; priceMin: number; priceMax: number; }

@Component({
  selector: 'dlx-shop-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- HEADER del shop — limpio centrado -->
    <section class="bg-white dark:bg-slate-950 pt-32 pb-12 border-b border-ink-100 dark:border-white/[0.06]">
      <div class="max-w-[1400px] mx-auto px-6 md:px-10">
        <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-3">
          Catálogo
        </p>
        <div class="flex items-end justify-between flex-wrap gap-6">
          <h1 class="font-bold text-[44px] md:text-[64px] tracking-[-0.03em] leading-[1.05]
                     text-ink-950 dark:text-white">
            Shop la colección
          </h1>
          <p class="text-ink-600 dark:text-white/55 text-[15px] max-w-md leading-relaxed">
            {{ filtered().length }} productos curados de Nike, Adidas, Jordan y más.
            Stock en vivo por sucursal.
          </p>
        </div>
      </div>
    </section>

    <!-- BARRA DE FILTROS HORIZONTAL (sticky) -->
    <section class="sticky top-0 z-30 bg-white dark:bg-slate-950
                    border-b border-ink-100 dark:border-white/[0.06]
                    backdrop-blur-md">
      <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-4
                  flex items-center justify-between gap-4 flex-wrap">

        <!-- Pills de género -->
        <div class="flex items-center gap-2">
          @for (g of genders; track g.value) {
            <button (click)="setGender(g.value)"
                    class="px-5 h-10 rounded-full text-[13px] font-semibold transition-colors"
                    [class.bg-ink-950]="gender() === g.value"
                    [class.text-white]="gender() === g.value"
                    [class.dark:bg-white]="gender() === g.value"
                    [class.dark:text-ink-950]="gender() === g.value"
                    [class.text-ink-600]="gender() !== g.value"
                    [class.dark:text-white/65]="gender() !== g.value"
                    [class.hover:bg-ink-100]="gender() !== g.value"
                    [class.dark:hover:bg-white/[0.06]]="gender() !== g.value">
              {{ g.label }}
            </button>
          }
        </div>

        <div class="flex items-center gap-2">
          <!-- Filtro botón -->
          <button (click)="showFilters.set(!showFilters())"
                  class="inline-flex items-center gap-2 px-5 h-10 rounded-full
                         border border-ink-200 dark:border-white/[0.15]
                         text-[13px] font-semibold text-ink-950 dark:text-white
                         hover:border-[#0095f6] hover:text-[#0095f6] transition">
            <i class="fa-solid fa-sliders text-[12px]"></i>
            Filtros
            @if (activeFiltersCount() > 0) {
              <span class="w-5 h-5 rounded-full bg-[#0095f6] text-white text-[10px] font-bold grid place-items-center">
                {{ activeFiltersCount() }}
              </span>
            }
          </button>

          <!-- Sort -->
          <div class="relative">
            <select [value]="sortBy()" (change)="setSort($any($event.target).value)"
                    class="appearance-none pl-5 pr-10 h-10 rounded-full
                           border border-ink-200 dark:border-white/[0.15]
                           bg-transparent text-[13px] font-semibold text-ink-950 dark:text-white
                           hover:border-[#0095f6] transition cursor-pointer">
              <option value="relevance">Relevancia</option>
              <option value="new">Más nuevos</option>
              <option value="price-asc">Precio: menor</option>
              <option value="price-desc">Precio: mayor</option>
            </select>
            <i class="fa-solid fa-chevron-down text-[10px] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none
                      text-ink-500 dark:text-white/45"></i>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTENIDO -->
    <section class="bg-white dark:bg-slate-950 py-10">
      <div class="max-w-[1400px] mx-auto px-6 md:px-10
                  grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">

        <!-- SIDEBAR FILTROS (collapsible mobile) -->
        @if (showFilters() || isDesktop) {
          <aside class="space-y-7 lg:sticky lg:top-24 self-start">

            <!-- Categorías -->
            <div>
              <h3 class="text-[12px] uppercase tracking-[0.2em] font-bold
                         text-ink-500 dark:text-white/45 mb-4">
                Categoría
              </h3>
              <ul class="space-y-1">
                @for (c of categories; track c.slug) {
                  <li>
                    <label class="flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg cursor-pointer
                                  hover:bg-ink-50 dark:hover:bg-white/[0.04] transition">
                      <input type="checkbox" [checked]="filter().categories.includes(c.slug)"
                             (change)="toggleCategory(c.slug)"
                             class="w-4 h-4 rounded accent-[#0095f6]" />
                      <span class="text-[14px] text-ink-700 dark:text-white/75 flex-1">{{ c.label }}</span>
                      <span class="text-[12px] text-ink-400 dark:text-white/35">{{ c.count }}</span>
                    </label>
                  </li>
                }
              </ul>
            </div>

            <!-- Marcas -->
            <div>
              <h3 class="text-[12px] uppercase tracking-[0.2em] font-bold
                         text-ink-500 dark:text-white/45 mb-4">
                Marca
              </h3>
              <ul class="space-y-1">
                @for (b of brands; track b) {
                  <li>
                    <label class="flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg cursor-pointer
                                  hover:bg-ink-50 dark:hover:bg-white/[0.04] transition">
                      <input type="checkbox" [checked]="filter().brands.includes(b)"
                             (change)="toggleBrand(b)"
                             class="w-4 h-4 rounded accent-[#0095f6]" />
                      <span class="text-[14px] text-ink-700 dark:text-white/75">{{ b }}</span>
                    </label>
                  </li>
                }
              </ul>
            </div>

            <!-- Tallas -->
            <div>
              <h3 class="text-[12px] uppercase tracking-[0.2em] font-bold
                         text-ink-500 dark:text-white/45 mb-4">
                Talla
              </h3>
              <div class="grid grid-cols-4 gap-2">
                @for (s of sizes; track s) {
                  <button (click)="toggleSize(s)"
                          class="h-10 rounded-lg text-[12px] font-semibold transition"
                          [class.bg-[#0095f6]]="filter().sizes.includes(s)"
                          [class.text-white]="filter().sizes.includes(s)"
                          [class.border-transparent]="filter().sizes.includes(s)"
                          [class.border]="!filter().sizes.includes(s)"
                          [class.border-ink-200]="!filter().sizes.includes(s)"
                          [class.dark:border-white/15]="!filter().sizes.includes(s)"
                          [class.text-ink-700]="!filter().sizes.includes(s)"
                          [class.dark:text-white/75]="!filter().sizes.includes(s)"
                          [class.hover:border-[#0095f6]]="!filter().sizes.includes(s)">
                    {{ s }}
                  </button>
                }
              </div>
            </div>

            <!-- Precio -->
            <div>
              <h3 class="text-[12px] uppercase tracking-[0.2em] font-bold
                         text-ink-500 dark:text-white/45 mb-4">
                Precio (\$)
              </h3>
              <div class="grid grid-cols-2 gap-2">
                <input type="number" [value]="filter().priceMin" (input)="setPriceMin($any($event.target).value)"
                       placeholder="Mín"
                       class="h-10 px-3 rounded-lg border border-ink-200 dark:border-white/15
                              bg-transparent text-[14px] text-ink-950 dark:text-white
                              focus:outline-none focus:border-[#0095f6]" />
                <input type="number" [value]="filter().priceMax" (input)="setPriceMax($any($event.target).value)"
                       placeholder="Máx"
                       class="h-10 px-3 rounded-lg border border-ink-200 dark:border-white/15
                              bg-transparent text-[14px] text-ink-950 dark:text-white
                              focus:outline-none focus:border-[#0095f6]" />
              </div>
            </div>

            @if (activeFiltersCount() > 0) {
              <button (click)="resetFilters()"
                      class="w-full h-10 rounded-full text-[13px] font-semibold
                             text-[#0095f6] hover:bg-[#0095f6]/8 transition">
                Limpiar filtros
              </button>
            }
          </aside>
        }

        <!-- GRID DE PRODUCTOS -->
        <div>
          @if (filtered().length === 0) {
            <div class="text-center py-24">
              <div class="w-16 h-16 mx-auto rounded-full bg-ink-100 dark:bg-white/[0.05] grid place-items-center mb-5">
                <i class="fa-solid fa-magnifying-glass text-ink-400 dark:text-white/30 text-[20px]"></i>
              </div>
              <h3 class="font-bold text-[20px] text-ink-950 dark:text-white mb-2">Sin resultados</h3>
              <p class="text-ink-600 dark:text-white/55 text-[14px] mb-6">
                Prueba con otros filtros o limpia la selección actual.
              </p>
              <button (click)="resetFilters()"
                      class="inline-flex items-center gap-2 px-6 h-11 rounded-full
                             bg-[#0095f6] text-white text-[14px] font-semibold
                             hover:bg-[#1877f2] transition">
                Limpiar filtros
              </button>
            </div>
          } @else {
            @if (zone.city()) {
              <div class="flex items-center gap-2 mb-5 text-[13px]">
                <i class="fa-solid fa-location-dot text-[#0095f6]"></i>
                <span class="font-semibold text-emerald-600">{{ availableCount() }} disponibles en {{ zone.city() }}</span>
                @if (unavailableCount() > 0) {
                  <span class="text-ink-500 dark:text-white/45">· {{ unavailableCount() }} solo por envío</span>
                }
              </div>
            }
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              @for (p of filtered(); track p.id) {
                @if (zone.city() && p.id === firstUnavailableId()) {
                  <div class="col-span-full flex items-center gap-3 mt-6 mb-1">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-ink-500 dark:text-white/50">
                      Solo por envío a {{ zone.city() }}
                    </span>
                    <div class="flex-1 h-px bg-ink-200 dark:bg-white/10"></div>
                  </div>
                }
                <a [routerLink]="['/shop', p.id]"
                   class="group block rounded-2xl overflow-hidden
                          bg-white dark:bg-slate-800
                          border border-ink-100 dark:border-white/[0.06]
                          hover:border-[#0095f6] dark:hover:border-[#0095f6]
                          hover:shadow-lg hover:-translate-y-1
                          transition-all duration-300">

                  <div class="relative aspect-square overflow-hidden bg-ink-100 dark:bg-white/[0.04]"
                       [class.opacity-60]="!p.available">
                    @if (!p.available) {
                      <span class="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full
                                   text-[10px] font-bold uppercase tracking-wider bg-ink-950/80 text-white backdrop-blur">
                        Solo envío
                      </span>
                    }
                    @if (p.tag) {
                      <span class="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full
                                   text-[10px] font-bold uppercase tracking-wider"
                            [class.bg-[#0095f6]]="p.tag === 'Drop' || p.tag === 'Nuevo'"
                            [class.text-white]="p.tag === 'Drop' || p.tag === 'Nuevo' || p.tag === 'Exclusivo'"
                            [class.bg-rose-500]="p.tag === 'Oferta'"
                            [class.bg-ink-950]="p.tag === 'Exclusivo'">
                        {{ p.tag }}
                      </span>
                    }
                    <img [src]="p.image" [alt]="p.name"
                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                         loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
                  </div>

                  <div class="p-5">
                    <p class="text-[11px] uppercase tracking-wider text-ink-500 dark:text-white/45 mb-1.5 font-semibold">
                      {{ p.brand }}
                    </p>
                    <h3 class="font-semibold text-[15px] text-ink-950 dark:text-white truncate">
                      {{ p.name }}
                    </h3>

                    <!-- Colores -->
                    @if (p.colors.length) {
                      <div class="flex items-center gap-1.5 mt-3">
                        @for (c of p.colors; track c) {
                          <span class="w-3 h-3 rounded-full border border-ink-200 dark:border-white/15"
                                [style.background]="c"></span>
                        }
                      </div>
                    }

                    <div class="flex items-baseline gap-2 mt-3">
                      <span class="font-bold text-[17px] text-ink-950 dark:text-white">\${{ p.price }}</span>
                      @if (p.oldPrice) {
                        <span class="text-[13px] text-ink-400 dark:text-white/35 line-through">\${{ p.oldPrice }}</span>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class ShopListComponent {
  private catalog = inject(PublicCatalogService);
  zone = inject(ZoneService);
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

  constructor() {
    // Recarga el catálogo segun la ciudad elegida por el cliente.
    effect(() => { const c = this.zone.city(); this.loadProducts(c); });
  }

  private loadProducts(city: string | null): void {
    this.loadingProducts.set(true);
    this.catalog.listProducts({ city: city || undefined, sort: 'new' }).subscribe({
      next: r => {
        this.products.set((r.results || []).map(pp => ({
          id: String(pp.id),
          name: pp.name,
          brand: pp.brand_name,
          category: (pp.category_name || '').toLowerCase() as Product['category'],
          price: Number(pp.base_price),
          oldPrice: pp.compare_at_price ? Number(pp.compare_at_price) : undefined,
          colors: [],
          sizes: [],
          image: pp.thumb_url || pp.main_image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85',
          tag: this.mapTag(pp.tag),
          gender: this.mapGender(pp.gender),
          available: pp.available_in_city !== false,
        })));
        this.loadingProducts.set(false);
      },
      error: () => { this.products.set([]); this.loadingProducts.set(false); },
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
  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img.dataset['ph'] === '1') return;
    img.dataset['ph'] = '1';
    img.src = IMG_PLACEHOLDER;
    img.classList.add('object-contain', 'p-8', 'opacity-70');
    img.classList.remove('object-cover');
  }
}
