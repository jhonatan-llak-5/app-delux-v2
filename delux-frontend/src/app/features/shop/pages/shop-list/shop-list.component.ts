import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Product {
  id: string; name: string; brand: string;
  category: 'zapatillas' | 'ropa' | 'mochilas' | 'accesorios';
  price: number; oldPrice?: number; colors: string[]; sizes: string[];
  image: string; tag?: 'Nuevo' | 'Drop' | 'Oferta' | 'Exclusivo';
  gender: 'men' | 'women' | 'unisex';
}
interface Filter { categories: string[]; brands: string[]; sizes: string[]; priceMin: number; priceMax: number; }

@Component({
  selector: 'dlx-shop-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative max-w-[1600px] mx-auto px-6 md:px-10 pt-32 pb-12
                    bg-white dark:bg-ink-950">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div class="lg:col-span-7">
          <p class="eyebrow">/ Catálogo</p>
          <h1 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
            Shop<br/><span class="text-ink-400 dark:text-white/30">la colección.</span>
          </h1>
        </div>
        <div class="lg:col-span-5 lg:flex lg:items-end">
          <p class="text-ink-700 dark:text-white/60 max-w-md leading-relaxed">
            Explora {{ products.length }} productos premium. Filtra por categoría,
            marca, talla o precio. Stock en vivo por sucursal.
          </p>
        </div>
      </div>
      <div class="reveal-line mt-12"></div>
    </section>

    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pb-32 bg-white dark:bg-ink-950">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside class="lg:col-span-3 space-y-8 lg:sticky lg:top-28 self-start">
          <button (click)="showFilters.set(!showFilters())" class="lg:hidden w-full btn-outline">
            <i class="fa-solid fa-sliders"></i>
            Filtros ({{ activeFiltersCount() }})
          </button>

          <div [class.hidden]="!showFilters()" class="lg:block space-y-8 editorial-card p-6">
            <div>
              <h3 class="font-display font-bold text-sm uppercase tracking-widest mb-4 text-ink-950 dark:text-white">Categoría</h3>
              <ul class="space-y-2">
                @for (c of categories; track c.slug) {
                  <li>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" [checked]="filter().categories.includes(c.slug)"
                             (change)="toggleCategory(c.slug)" class="w-4 h-4 accent-accent-400" />
                      <span class="text-sm text-ink-700 dark:text-white/70 group-hover:text-ink-950 dark:group-hover:text-white transition">{{ c.label }}</span>
                      <span class="ml-auto text-xs text-ink-400 dark:text-white/40">{{ c.count }}</span>
                    </label>
                  </li>
                }
              </ul>
            </div>

            <div>
              <h3 class="font-display font-bold text-sm uppercase tracking-widest mb-4 text-ink-950 dark:text-white">Género</h3>
              <div class="grid grid-cols-3 gap-2">
                @for (g of genders; track g.value) {
                  <button (click)="setGender(g.value)"
                          class="px-3 py-2 rounded-lg border text-xs uppercase tracking-wide transition"
                          [class.bg-accent-400]="gender() === g.value"
                          [class.text-ink-950]="gender() === g.value"
                          [class.border-accent-400]="gender() === g.value"
                          [class.border-ink-200]="gender() !== g.value"
                          [class.dark:border-white/20]="gender() !== g.value"
                          [class.text-ink-700]="gender() !== g.value"
                          [class.dark:text-white/70]="gender() !== g.value">
                    {{ g.label }}
                  </button>
                }
              </div>
            </div>

            <div>
              <h3 class="font-display font-bold text-sm uppercase tracking-widest mb-4 text-ink-950 dark:text-white">Marca</h3>
              <ul class="space-y-2">
                @for (b of brands; track b) {
                  <li>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" [checked]="filter().brands.includes(b)" (change)="toggleBrand(b)" class="w-4 h-4 accent-accent-400" />
                      <span class="text-sm text-ink-700 dark:text-white/70 group-hover:text-ink-950 dark:group-hover:text-white transition">{{ b }}</span>
                    </label>
                  </li>
                }
              </ul>
            </div>

            <div>
              <h3 class="font-display font-bold text-sm uppercase tracking-widest mb-4 text-ink-950 dark:text-white">Talla</h3>
              <div class="grid grid-cols-5 gap-2">
                @for (s of sizes; track s) {
                  <button (click)="toggleSize(s)"
                          class="aspect-square rounded-lg border text-xs font-semibold transition"
                          [class.bg-accent-400]="filter().sizes.includes(s)"
                          [class.text-ink-950]="filter().sizes.includes(s)"
                          [class.border-accent-400]="filter().sizes.includes(s)"
                          [class.border-ink-200]="!filter().sizes.includes(s)"
                          [class.dark:border-white/20]="!filter().sizes.includes(s)"
                          [class.text-ink-700]="!filter().sizes.includes(s)"
                          [class.dark:text-white/70]="!filter().sizes.includes(s)">
                    {{ s }}
                  </button>
                }
              </div>
            </div>

            <div>
              <h3 class="font-display font-bold text-sm uppercase tracking-widest mb-4 text-ink-950 dark:text-white">Precio</h3>
              <div class="flex items-center gap-3">
                <input type="number" [value]="filter().priceMin" (input)="setPriceMin($any($event.target).value)"
                       class="w-full px-3 py-2 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm" placeholder="Min" />
                <span class="text-ink-400 dark:text-white/40">—</span>
                <input type="number" [value]="filter().priceMax" (input)="setPriceMax($any($event.target).value)"
                       class="w-full px-3 py-2 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm" placeholder="Max" />
              </div>
            </div>

            <button (click)="resetFilters()" class="w-full btn-outline text-xs">Limpiar filtros</button>
          </div>
        </aside>

        <div class="lg:col-span-9">
          <div class="flex items-center justify-between mb-8 pb-6 border-b border-ink-200 dark:border-white/10">
            <p class="text-sm text-ink-700 dark:text-white/70">
              <span class="font-bold text-ink-950 dark:text-white">{{ filtered().length }}</span> producto(s)
            </p>
            <select [value]="sortBy()" (change)="setSort($any($event.target).value)"
                    class="px-4 py-2 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm cursor-pointer">
              <option value="relevance">Relevancia</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="new">Más recientes</option>
            </select>
          </div>

          @if (filtered().length === 0) {
            <div class="text-center py-24">
              <i class="fa-solid fa-magnifying-glass text-4xl text-ink-400 dark:text-white/40 mb-4"></i>
              <p class="text-ink-700 dark:text-white/70">No encontramos productos con esos filtros.</p>
              <button (click)="resetFilters()" class="btn-outline mt-4 text-xs">Limpiar filtros</button>
            </div>
          } @else {
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-5">
              @for (p of filtered(); track p.id) {
                <a [routerLink]="['/product', p.id]"
                   class="group editorial-card overflow-hidden hover:-translate-y-1 transition-all duration-500">
                  <div class="relative aspect-[4/5] overflow-hidden bg-ink-100 dark:bg-white/5">
                    @if (p.tag) {
                      <span class="absolute top-3 left-3 z-10 text-[9px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full backdrop-blur-md"
                            [ngClass]="{
                              'bg-accent-400 text-ink-950': p.tag === 'Drop',
                              'bg-brand-magenta text-white': p.tag === 'Nuevo',
                              'bg-brand-orange text-white': p.tag === 'Oferta',
                              'bg-ink-950 text-white dark:bg-white dark:text-ink-950': p.tag === 'Exclusivo'
                            }">{{ p.tag }}</span>
                    }
                    <button (click)="$event.preventDefault()"
                            class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur grid place-items-center hover:bg-white dark:hover:bg-white/20 transition" aria-label="Wishlist">
                      <i class="fa-regular fa-heart text-xs text-ink-700 dark:text-white"></i>
                    </button>
                    <img [src]="p.image" [alt]="p.name"
                         class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                         loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
                  </div>
                  <div class="p-4">
                    <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500 dark:text-white/40">{{ p.brand }}</p>
                    <h3 class="font-semibold mt-1 truncate text-sm text-ink-950 dark:text-white">{{ p.name }}</h3>
                    <div class="mt-2 flex items-center justify-between">
                      <div class="flex items-baseline gap-2">
                        <span class="font-display font-bold text-ink-950 dark:text-white">\${{ p.price }}</span>
                        @if (p.oldPrice) {
                          <span class="text-xs text-ink-400 dark:text-white/40 line-through">\${{ p.oldPrice }}</span>
                        }
                      </div>
                      <div class="flex gap-1">
                        @for (c of p.colors.slice(0, 3); track c) {
                          <span class="w-3 h-3 rounded-full border border-ink-300 dark:border-white/20" [style.background]="c"></span>
                        }
                      </div>
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
  showFilters = signal(false);
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
  ];

  readonly products: Product[] = [
    { id: '1', name: 'Air Force Stealth', brand: 'Nike', category: 'zapatillas', price: 200, tag: 'Drop',
      gender: 'unisex', colors: ['#e0399a', '#0b0e16'], sizes: ['40','41','42'],
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85&auto=format&fit=crop' },
    { id: '2', name: 'Air Max Plus', brand: 'Nike', category: 'zapatillas', price: 220, oldPrice: 260, tag: 'Oferta',
      gender: 'men', colors: ['#0b0e16','#ff7849'], sizes: ['41','42','43'],
      image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&q=85&auto=format&fit=crop' },
    { id: '3', name: 'Samba OG', brand: 'Adidas', category: 'zapatillas', price: 160, tag: 'Nuevo',
      gender: 'unisex', colors: ['#f5f6f8','#0b0e16'], sizes: ['38','39','40','41','42'],
      image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=85&auto=format&fit=crop' },
    { id: '4', name: 'Forum Low', brand: 'Adidas', category: 'zapatillas', price: 140, tag: 'Exclusivo',
      gender: 'men', colors: ['#7c3aed','#22d3ee'], sizes: ['40','41','42','43'],
      image: 'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=600&q=85&auto=format&fit=crop' },
    { id: '5', name: 'Hoodie Tech Fleece', brand: 'Nike', category: 'ropa', price: 95, tag: 'Nuevo',
      gender: 'unisex', colors: ['#363c4d'], sizes: ['S','M','L','XL'],
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=85&auto=format&fit=crop' },
    { id: '6', name: 'Mochila Tech Pack', brand: 'Puma', category: 'mochilas', price: 75, tag: 'Drop',
      gender: 'unisex', colors: ['#14b8a6'], sizes: [],
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=85&auto=format&fit=crop' },
    { id: '7', name: '550 White', brand: 'New Balance', category: 'zapatillas', price: 130, tag: 'Nuevo',
      gender: 'unisex', colors: ['#f5f6f8','#7c3aed'], sizes: ['38','39','40','41','42','43'],
      image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&q=85&auto=format&fit=crop' },
    { id: '8', name: 'Old Skool', brand: 'Vans', category: 'zapatillas', price: 85, oldPrice: 110, tag: 'Oferta',
      gender: 'unisex', colors: ['#0b0e16','#f5f6f8'], sizes: ['39','40','41','42'],
      image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=85&auto=format&fit=crop' },
    { id: '9', name: 'Court Vintage', brand: 'Nike', category: 'zapatillas', price: 180, tag: 'Drop',
      gender: 'men', colors: ['#fff','#000'], sizes: ['40','41','42','43'],
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=85&auto=format&fit=crop' },
  ];

  filtered = computed(() => {
    const f = this.filter(); const g = this.gender(); const sort = this.sortBy();
    let list = this.products.filter(p => {
      if (f.categories.length && !f.categories.includes(p.category)) return false;
      if (f.brands.length && !f.brands.includes(p.brand)) return false;
      if (f.sizes.length && !p.sizes.some(s => f.sizes.includes(s))) return false;
      if (p.price < f.priceMin || p.price > f.priceMax) return false;
      if (g !== 'all' && p.gender !== g && p.gender !== 'unisex') return false;
      return true;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  });

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
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><rect width="200" height="250" fill="%23cbd5e1"/></svg>';
  }
}
