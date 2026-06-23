import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ProductReviewsComponent } from '@shared/components/product-reviews/product-reviews.component';
import { MeService } from '@features/account/services/me.service';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/checkout/services/cart.service';
import { NotifyService } from '@shared/services/notify.service';
import { PublicCatalogService } from '@shared/services/public-catalog.service';

interface ColorOption { name: string; hex: string; image: string; }

interface ProductVM {
  id: number; name: string; subtitle: string; brand: string; category: string;
  slug: string; price: number; oldPrice?: number; rating: number; reviewsCount: number;
  tag: string; gallery: string[]; colors: ColorOption[]; sizes: string[]; description: string;
}

const EMPTY_PRODUCT: ProductVM = {
  id: 0, name: '', subtitle: '', brand: '', category: '', slug: '',
  price: 0, oldPrice: undefined, rating: 0, reviewsCount: 0, tag: '',
  gallery: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85'],
  colors: [], sizes: [], description: '',
};

const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
  + '<g fill="none" stroke="#9aa0ab" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">'
  + '<rect x="32" y="44" width="56" height="40" rx="6"/><circle cx="60" cy="64" r="11"/>'
  + '<path d="M44 44l5-9h22l5 9"/></g></svg>');

@Component({
  selector: 'dlx-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductReviewsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-slate-950">
      <section class="max-w-[1300px] mx-auto px-6 md:px-10 pt-28 pb-20">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-[12px] text-ink-500 dark:text-white/45 mb-10
                    font-medium">
          <a routerLink="/" class="hover:text-[#0095f6] transition">Inicio</a>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <a routerLink="/shop" class="hover:text-[#0095f6] transition">Shop</a>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <span>{{ product().category }}</span>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <span class="text-ink-950 dark:text-white">{{ product().name }}</span>
        </nav>

        <!-- Grid principal -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">

          <!-- ═══════════ GALERÍA ═══════════ -->
          <div class="lg:col-span-7">
            <div class="grid grid-cols-[88px_1fr] gap-4">

              <!-- Thumbnails verticales -->
              <div class="space-y-2 max-h-[640px] overflow-y-auto scrollbar-hide">
                @for (img of activeGallery(); track img; let i = $index) {
                  <button (click)="activeImg.set(i)" type="button"
                          class="w-full aspect-square rounded-2xl overflow-hidden
                                 border-2 transition-all duration-200"
                          [ngClass]="i === activeImg()
                            ? 'border-[#0095f6] scale-[1.02]'
                            : 'border-transparent opacity-60 hover:opacity-100'">
                    <img [src]="img" [alt]="product().name + ' ' + (i+1)"
                         class="w-full h-full object-cover bg-ink-100 dark:bg-white/[0.04]"
                         loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
                  </button>
                }
              </div>

              <!-- Imagen principal -->
              <div class="relative aspect-square rounded-3xl overflow-hidden
                          bg-ink-50 dark:bg-white/[0.03] cursor-zoom-in
                          border border-ink-100 dark:border-white/[0.06]"
                   (mouseenter)="zoomed.set(true)" (mouseleave)="zoomed.set(false)"
                   (mousemove)="onMouseMove($event)">
                <img [src]="activeGallery()[activeImg()]" [alt]="product().name"
                     class="w-full h-full object-cover transition-transform duration-300"
                     [class.scale-150]="zoomed()"
                     [style.transform-origin]="zoomOrigin()"
                     loading="eager" crossorigin="anonymous" (error)="onImgError($event)" />

                @if (product().tag) {
                  <span class="absolute top-5 left-5 px-3 py-1.5 rounded-full
                               bg-[#0095f6] text-white text-[11px] font-bold uppercase tracking-wider">
                    {{ product().tag }}
                  </span>
                }

                <!-- Arrows nav -->
                <button type="button" (click)="prevImg()"
                        class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11
                               rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-md
                               grid place-items-center text-ink-950 dark:text-white
                               hover:bg-[#0095f6] hover:text-white transition"
                        aria-label="Anterior">
                  <i class="fa-solid fa-chevron-left text-[13px]"></i>
                </button>
                <button type="button" (click)="nextImg()"
                        class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11
                               rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-md
                               grid place-items-center text-ink-950 dark:text-white
                               hover:bg-[#0095f6] hover:text-white transition"
                        aria-label="Siguiente">
                  <i class="fa-solid fa-chevron-right text-[13px]"></i>
                </button>

                <!-- Counter -->
                <div class="absolute bottom-5 right-5 px-3 py-1.5 rounded-full
                            bg-white/95 dark:bg-black/70 backdrop-blur-md
                            text-[11px] font-mono font-semibold text-ink-950 dark:text-white">
                  {{ activeImg() + 1 }} / {{ activeGallery().length }}
                </div>
              </div>
            </div>
          </div>

          <!-- ═══════════ INFO ═══════════ -->
          <div class="lg:col-span-5 lg:pl-4">

            <!-- Brand + nombre -->
            <p class="text-[12px] uppercase tracking-[0.25em] text-[#0095f6] font-bold mb-3">
              {{ product().brand }}
            </p>
            <h1 class="font-bold text-[32px] md:text-[40px] tracking-[-0.02em] leading-[1.05]
                       text-ink-950 dark:text-white">
              {{ product().name }}
            </h1>
            <p class="text-ink-600 dark:text-white/55 text-[15px] mt-3">{{ product().subtitle }}</p>

            <!-- Rating -->
            <div class="flex items-center gap-3 mt-5">
              <div class="flex gap-0.5">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="fa-solid fa-star text-[13px]"
                     [class.text-amber-400]="s <= Math.round(product().rating)"
                     [class.text-ink-300]="s > Math.round(product().rating)"
                     [class.dark:text-white/15]="s > Math.round(product().rating)"></i>
                }
              </div>
              <span class="text-[13px] text-ink-600 dark:text-white/55">
                <span class="font-semibold text-ink-950 dark:text-white">{{ product().rating }}</span>
                · {{ product().reviewsCount }} reseñas
              </span>
            </div>

            <!-- Precio -->
            <div class="mt-7 pb-7 border-b border-ink-100 dark:border-white/[0.06]">
              <div class="flex items-baseline gap-3 flex-wrap">
                <span class="font-bold text-[36px] tracking-tight text-ink-950 dark:text-white">
                  \${{ product().price }}
                </span>
                @if (product().oldPrice) {
                  <span class="text-[18px] text-ink-400 dark:text-white/35 line-through">
                    \${{ product().oldPrice }}
                  </span>
                  <span class="px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                    -{{ discount() }}%
                  </span>
                }
              </div>
              <p class="text-[13px] text-ink-500 dark:text-white/45 mt-2">
                o 3 pagos sin interés de
                <span class="font-semibold text-ink-950 dark:text-white">\${{ (product().price/3).toFixed(2) }}</span>
              </p>
            </div>

            <!-- COLORES -->
            @if (product().colors.length) {
              <div class="mt-7">
                <div class="flex items-center justify-between mb-3.5">
                  <h3 class="text-[13px] font-bold text-ink-950 dark:text-white">
                    Color: <span class="font-normal text-ink-600 dark:text-white/55">{{ activeColor()?.name }}</span>
                  </h3>
                </div>
                <div class="flex gap-3 flex-wrap">
                  @for (c of product().colors; track c.name; let i = $index) {
                    <button type="button" (click)="selectColor(i)" [title]="c.name"
                            [attr.aria-label]="'Color ' + c.name"
                            class="relative w-10 h-10 rounded-full transition-all duration-200
                                   ring-1 ring-ink-200 dark:ring-white/20"
                            [class.ring-2]="i === activeColorIdx()"
                            [class.ring-offset-2]="i === activeColorIdx()"
                            [class.ring-offset-white]="i === activeColorIdx()"
                            [class.dark:ring-offset-slate-950]="i === activeColorIdx()"
                            [style.background-color]="c.hex"
                            [style.--tw-ring-color]="i === activeColorIdx() ? '#0095f6' : ''">
                      @if (i === activeColorIdx()) {
                        <i class="fa-solid fa-check absolute inset-0 m-auto w-4 h-4 text-[12px]"
                           [class.text-white]="isDarkColor(c.hex)"
                           [class.text-ink-950]="!isDarkColor(c.hex)"></i>
                      }
                    </button>
                  }
                </div>
              </div>
            }

            <!-- TALLAS -->
            <div class="mt-7">
              <div class="flex items-center justify-between mb-3.5">
                <h3 class="text-[13px] font-bold text-ink-950 dark:text-white">
                  Talla:
                  @if (activeSize()) {
                    <span class="font-normal text-ink-600 dark:text-white/55 ml-1">{{ activeSize() }}</span>
                  }
                </h3>
                <button type="button" class="text-[12px] font-semibold text-[#0095f6] hover:underline">
                  Guía de tallas
                </button>
              </div>
              <div class="grid grid-cols-4 sm:grid-cols-5 gap-2">
                @for (s of product().sizes; track s) {
                  <button type="button" (click)="selectSize(s)"
                          [attr.aria-label]="'Talla ' + s"
                          class="h-12 rounded-xl text-[14px] font-semibold transition-all duration-150"
                          [ngClass]="activeSize() === s
                            ? 'bg-ink-950 text-white dark:bg-white dark:text-ink-950 border-2 border-ink-950 dark:border-white'
                            : 'bg-white dark:bg-white/[0.03] border-2 border-ink-200 dark:border-white/15 text-ink-950 dark:text-white hover:border-ink-950 dark:hover:border-white'">
                    {{ s }}
                  </button>
                }
              </div>
              @if (sizeError()) {
                <p class="text-[12px] text-rose-600 dark:text-rose-400 mt-2 font-medium">
                  <i class="fa-solid fa-circle-exclamation"></i> Selecciona una talla antes de continuar
                </p>
              }
            </div>

            <!-- CTAs -->
            <div class="space-y-3 mt-8">
              <button type="button" (click)="addToCart()"
                      class="w-full h-14 rounded-full
                             bg-[#0095f6] hover:bg-[#1877f2]
                             text-white font-semibold text-[15px]
                             inline-flex items-center justify-center gap-2
                             transition-colors">
                <i class="fa-solid fa-bag-shopping"></i>
                Agregar al carrito
              </button>
              <button type="button" (click)="toggleWishlistWithToast()"
                      class="w-full h-14 rounded-full
                             bg-transparent
                             border border-ink-200 dark:border-white/15
                             text-ink-950 dark:text-white font-semibold text-[15px]
                             inline-flex items-center justify-center gap-2
                             hover:border-[#0095f6] hover:text-[#0095f6] transition">
                <i class="fa-{{ inWishlist() ? 'solid' : 'regular' }} fa-heart"
                   [class.text-rose-500]="inWishlist()"></i>
                {{ inWishlist() ? 'En tu wishlist' : 'Agregar a wishlist' }}
              </button>

            </div>

            <!-- Features grid -->
            <div class="grid grid-cols-2 gap-3 mt-8 pt-8 border-t border-ink-100 dark:border-white/[0.06]">
              @for (f of features; track f.label) {
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-[#0095f6]/10 grid place-items-center shrink-0">
                    <i class="fa-solid {{ f.icon }} text-[#0095f6] text-[12px]"></i>
                  </div>
                  <p class="text-[13px] text-ink-700 dark:text-white/70 leading-tight font-medium">
                    {{ f.label }}
                  </p>
                </div>
              }
            </div>

            <!-- Acordeón descripción -->
            <div class="mt-8 space-y-2">
              @for (acc of accordions(); track acc.id) {
                <details class="group rounded-2xl
                                border border-ink-100 dark:border-white/[0.06]
                                hover:border-[#0095f6] dark:hover:border-[#0095f6] transition
                                overflow-hidden">
                  <summary class="flex items-center justify-between cursor-pointer list-none p-5">
                    <span class="font-semibold text-[14px] text-ink-950 dark:text-white">
                      {{ acc.title }}
                    </span>
                    <i class="fa-solid fa-plus text-[12px] text-ink-500 dark:text-white/55
                              group-open:rotate-45 transition-transform"></i>
                  </summary>
                  <p class="text-[13px] text-ink-600 dark:text-white/65 leading-relaxed px-5 pb-5">
                    {{ acc.body }}
                  </p>
                </details>
              }
            </div>
          </div>
        </div>

        <!-- Reseñas -->
        <div class="mt-24 pt-12 border-t border-ink-100 dark:border-white/[0.06]">
          <p class="text-[12px] uppercase tracking-[0.25em] text-[#0095f6] font-bold mb-3">
            Opiniones de clientes
          </p>
          <h2 class="font-bold text-[28px] md:text-[36px] tracking-[-0.02em] leading-tight
                     text-ink-950 dark:text-white mb-8">
            Lo que dicen quienes ya lo compraron.
          </h2>
          <dlx-product-reviews [productId]="product().id" />
        </div>

      </section>
    </div>
  `,
})
export class ProductDetailComponent implements OnInit {
  Math = Math;
  private cart = inject(CartService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private catalog = inject(PublicCatalogService);
  private me = inject(MeService);
  private auth = inject(AuthService);
  loading = signal(true);

  activeImg = signal(0);
  activeColorIdx = signal(0);
  activeSize = signal<string | null>(null);
  sizeError = signal(false);
  zoomed = signal(false);
  zoomOrigin = signal('center');
  inWishlist = computed(() => this.me.wishlistIds().has(this.product().id));
  addedFeedback = signal(false);

  product = signal<ProductVM>(EMPTY_PRODUCT);

  ngOnInit(): void {
    if (this.auth.isLogged()) this.me.wishlist().subscribe({ error: () => {} });
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.catalog.getProduct(id).subscribe({
      next: d => {
        this.product.set({
          id: d.id,
          name: d.name,
          subtitle: d.short_description || `${d.category_name} · ${this.genderLabel(d.gender)}`,
          brand: d.brand_name,
          category: d.category_name,
          slug: d.slug,
          price: Number(d.base_price),
          oldPrice: d.compare_at_price ? Number(d.compare_at_price) : undefined,
          rating: d.rating || 0,
          reviewsCount: d.reviews_count || 0,
          tag: this.tagLabel(d.tag),
          gallery: d.images?.length ? d.images : EMPTY_PRODUCT.gallery,
          colors: d.colors || [],
          sizes: d.sizes || [],
          description: d.description || '',
        });
        this.activeColorIdx.set(0);
        this.activeImg.set(0);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('No se pudo cargar el producto.'); },
    });
  }

  private genderLabel(g: string): string {
    return ({ MEN: 'Hombre', WOMEN: 'Mujer', KIDS: 'Niños', UNISEX: 'Unisex' } as any)[g] || 'Unisex';
  }
  private tagLabel(t: string): string {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as any)[t] || '';
  }

  // Galería activa según color (en este demo es la misma, pero soporta variantes)
  activeGallery = computed(() => this.product().gallery);
  activeColor = computed(() => this.product().colors[this.activeColorIdx()]);
  discount = computed(() => {
    const p = this.product();
    if (!p.oldPrice) return 0;
    return Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
  });

  readonly features = [
    { icon: 'fa-truck-fast', label: 'Envío 24-72h' },
    { icon: 'fa-rotate-left', label: 'Cambios en 14 días' },
    { icon: 'fa-shield-halved', label: '100% original' },
    { icon: 'fa-store', label: 'Retiro en tienda' },
  ];

  accordions = computed(() => [
    { id: 'desc', title: 'Descripción',
      body: this.product().description
            || `${this.product().name} de ${this.product().brand}. Producto original disponible en Delux.` },
    { id: 'mat', title: 'Materiales y cuidado',
      body: 'Capellada de cuero genuino curtido al cromo. Suela exterior de caucho con patrón de pivot. Plantilla acolchada con espuma de memoria. Limpia con paño húmedo, evita la lavadora.' },
    { id: 'env', title: 'Envío y devoluciones',
      body: 'Envío gratis a todo el país en pedidos sobre $50. Recibe en 24-72 horas en Quito y Guayaquil. Cambios sin costo durante los primeros 14 días, sin preguntas.' },
  ]);

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img.dataset['ph'] === '1') return;
    img.dataset['ph'] = '1';
    img.src = IMG_PLACEHOLDER;
    img.classList.add('object-contain', 'p-6', 'opacity-70');
    img.classList.remove('object-cover');
  }

  isDarkColor(hex: string): boolean {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return true;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // luminancia relativa
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
  }

  selectColor(i: number) {
    this.activeColorIdx.set(i);
    this.activeImg.set(0);
  }

  selectSize(s: string) {
    this.activeSize.set(s);
    this.sizeError.set(false);
  }

  toggleWishlist() {
    this.me.toggleWishlist(this.product().id).subscribe({ error: () => {} });
  }

  addToCart() {
    if (!this.activeSize()) {
      this.sizeError.set(true);
      this.notify.warning('Selecciona una talla', {
        description: 'Elige una talla antes de añadir al carrito.',
      });
      return;
    }

    const color = this.activeColor();
    const colorImage = color?.image || this.product().gallery[0];
    const colorName = color?.name || 'default';
    const size = this.activeSize()!;
    const variantId = Number(`${this.product().id}${this.activeColorIdx()}${size}`.replace(/\D/g, '')) || Date.now();

    this.cart.add({
      variant_id: variantId,
      product_id: this.product().id,
      product_name: this.product().name,
      product_image: colorImage,
      product_slug: this.product().slug,
      sku: `${this.product().id}-${colorName.toLowerCase().replace(/\s+/g, '-')}-${size}`,
      size,
      color: color.name,
      unit_price: this.product().price,
      max_stock: 99,
      brand_name: this.product().brand,
    }, 1);

    this.notify.success('Agregado al carrito', {
      description: `${this.product().name} · Talla ${size} · ${color.name}`,
      action: {
        label: 'Ver carrito',
        onClick: () => this.router.navigate(['/cart']),
      },
    });
  }

  toggleWishlistWithToast() {
    if (!this.auth.isLogged()) {
      this.notify.warning('Inicia sesión', { description: 'Crea una cuenta para guardar favoritos.' });
      this.router.navigate(['/auth/login']);
      return;
    }
    const wasIn = this.inWishlist();
    this.me.toggleWishlist(this.product().id).subscribe({
      next: () => {
        if (!wasIn) this.notify.success('Añadido a tu wishlist', { description: this.product().name });
        else this.notify.message('Eliminado de tu wishlist');
      },
      error: () => this.notify.error('No se pudo actualizar tu wishlist.'),
    });
  }

  prevImg() {
    const len = this.activeGallery().length;
    this.activeImg.update(i => (i - 1 + len) % len);
  }
  nextImg() {
    const len = this.activeGallery().length;
    this.activeImg.update(i => (i + 1) % len);
  }
  onMouseMove(ev: MouseEvent) {
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    this.zoomOrigin.set(`${x}% ${y}%`);
  }
}
