import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReviewsComponent } from '@shared/components/reviews/reviews.component';
import { CartService } from '@features/checkout/services/cart.service';
import { NotifyService } from '@shared/services/notify.service';

interface ColorOption { name: string; hex: string; image: string; }

@Component({
  selector: 'dlx-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReviewsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-[#0a0a0a]">
      <section class="max-w-[1300px] mx-auto px-6 md:px-10 pt-28 pb-20">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-[12px] text-ink-500 dark:text-white/45 mb-10
                    font-medium">
          <a routerLink="/" class="hover:text-[#0095f6] transition">Inicio</a>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <a routerLink="/shop" class="hover:text-[#0095f6] transition">Shop</a>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <span>{{ product.category }}</span>
          <i class="fa-solid fa-chevron-right text-[8px] text-ink-300 dark:text-white/25"></i>
          <span class="text-ink-950 dark:text-white">{{ product.name }}</span>
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
                    <img [src]="img" [alt]="product.name + ' ' + (i+1)"
                         class="w-full h-full object-cover bg-ink-100 dark:bg-white/[0.04]"
                         loading="lazy" crossorigin="anonymous" />
                  </button>
                }
              </div>

              <!-- Imagen principal -->
              <div class="relative aspect-square rounded-3xl overflow-hidden
                          bg-ink-50 dark:bg-white/[0.03] cursor-zoom-in
                          border border-ink-100 dark:border-white/[0.06]"
                   (mouseenter)="zoomed.set(true)" (mouseleave)="zoomed.set(false)"
                   (mousemove)="onMouseMove($event)">
                <img [src]="activeGallery()[activeImg()]" [alt]="product.name"
                     class="w-full h-full object-cover transition-transform duration-300"
                     [class.scale-150]="zoomed()"
                     [style.transform-origin]="zoomOrigin()"
                     loading="eager" crossorigin="anonymous" />

                @if (product.tag) {
                  <span class="absolute top-5 left-5 px-3 py-1.5 rounded-full
                               bg-[#0095f6] text-white text-[11px] font-bold uppercase tracking-wider">
                    {{ product.tag }}
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
              {{ product.brand }}
            </p>
            <h1 class="font-bold text-[32px] md:text-[40px] tracking-[-0.02em] leading-[1.05]
                       text-ink-950 dark:text-white">
              {{ product.name }}
            </h1>
            <p class="text-ink-600 dark:text-white/55 text-[15px] mt-3">{{ product.subtitle }}</p>

            <!-- Rating -->
            <div class="flex items-center gap-3 mt-5">
              <div class="flex gap-0.5 text-amber-400">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="fa-solid fa-star text-[13px]"
                     [class.opacity-25]="s > Math.round(product.rating)"></i>
                }
              </div>
              <span class="text-[13px] text-ink-600 dark:text-white/55">
                <span class="font-semibold text-ink-950 dark:text-white">{{ product.rating }}</span>
                · {{ product.reviewsCount }} reseñas
              </span>
            </div>

            <!-- Precio -->
            <div class="mt-7 pb-7 border-b border-ink-100 dark:border-white/[0.06]">
              <div class="flex items-baseline gap-3 flex-wrap">
                <span class="font-bold text-[36px] tracking-tight text-ink-950 dark:text-white">
                  \${{ product.price }}
                </span>
                @if (product.oldPrice) {
                  <span class="text-[18px] text-ink-400 dark:text-white/35 line-through">
                    \${{ product.oldPrice }}
                  </span>
                  <span class="px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                    -{{ discount() }}%
                  </span>
                }
              </div>
              <p class="text-[13px] text-ink-500 dark:text-white/45 mt-2">
                o 3 pagos sin interés de
                <span class="font-semibold text-ink-950 dark:text-white">\${{ (product.price/3).toFixed(2) }}</span>
              </p>
            </div>

            <!-- COLORES -->
            <div class="mt-7">
              <div class="flex items-center justify-between mb-3.5">
                <h3 class="text-[13px] font-bold text-ink-950 dark:text-white">
                  Color: <span class="font-normal text-ink-600 dark:text-white/55">{{ activeColor().name }}</span>
                </h3>
              </div>
              <div class="flex gap-2 flex-wrap">
                @for (c of product.colors; track c.name; let i = $index) {
                  <button type="button" (click)="selectColor(i)"
                          [attr.aria-label]="'Color ' + c.name"
                          class="relative w-16 h-16 rounded-2xl overflow-hidden
                                 transition-all duration-200"
                          [ngClass]="i === activeColorIdx()
                            ? 'ring-2 ring-[#0095f6] ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]'
                            : 'ring-1 ring-ink-200 dark:ring-white/15 hover:ring-ink-400 dark:hover:ring-white/30'">
                    <img [src]="c.image" [alt]="c.name"
                         class="w-full h-full object-cover" loading="lazy" crossorigin="anonymous" />
                  </button>
                }
              </div>
            </div>

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
                @for (s of product.sizes; track s) {
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
              @for (acc of accordions; track acc.id) {
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
          <dlx-reviews [productId]="product.id + ''" />
        </div>

      </section>
    </div>
  `,
})
export class ProductDetailComponent {
  Math = Math;
  private cart = inject(CartService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  activeImg = signal(0);
  activeColorIdx = signal(0);
  activeSize = signal<string | null>(null);
  sizeError = signal(false);
  zoomed = signal(false);
  zoomOrigin = signal('center');
  inWishlist = signal(false);
  addedFeedback = signal(false);

  readonly product = {
    id: 1,
    name: 'Air Force Stealth',
    subtitle: 'Sneakers de performance · Unisex',
    brand: 'Nike',
    category: 'Zapatillas',
    slug: 'air-force-stealth',
    price: 200,
    oldPrice: 240,
    rating: 4.7,
    reviewsCount: 124,
    tag: 'Drop',
    gallery: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=1200&q=85&auto=format&fit=crop',
    ],
    colors: [
      { name: 'Magenta Fire', hex: '#e0399a',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=85&auto=format&fit=crop' },
      { name: 'Black Edition', hex: '#0b0e16',
        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=200&q=85&auto=format&fit=crop' },
      { name: 'White Core', hex: '#f5f6f8',
        image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=200&q=85&auto=format&fit=crop' },
    ] as ColorOption[],
    sizes: ['38','39','40','41','42','43','44'],
  };

  // Galería activa según color (en este demo es la misma, pero soporta variantes)
  activeGallery = computed(() => this.product.gallery);
  activeColor = computed(() => this.product.colors[this.activeColorIdx()]);
  discount = computed(() => {
    if (!this.product.oldPrice) return 0;
    return Math.round(((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100);
  });

  readonly features = [
    { icon: 'fa-truck-fast', label: 'Envío 24-72h' },
    { icon: 'fa-rotate-left', label: 'Cambios en 14 días' },
    { icon: 'fa-shield-halved', label: '100% original' },
    { icon: 'fa-store', label: 'Retiro en tienda' },
  ];

  readonly accordions = [
    { id: 'desc', title: 'Descripción',
      body: 'Diseñadas para la cultura urbana, las Air Force Stealth combinan herencia y tecnología. Materiales premium con cuero genuino, suela de espuma de alta respuesta y cordones planos clásicos.' },
    { id: 'mat', title: 'Materiales y cuidado',
      body: 'Capellada de cuero genuino curtido al cromo. Suela exterior de caucho con patrón de pivot. Plantilla acolchada con espuma de memoria. Limpia con paño húmedo, evita la lavadora.' },
    { id: 'env', title: 'Envío y devoluciones',
      body: 'Envío gratis a todo el país en pedidos sobre $50. Recibe en 24-72 horas en Quito y Guayaquil. Cambios sin costo durante los primeros 14 días, sin preguntas.' },
  ];

  selectColor(i: number) {
    this.activeColorIdx.set(i);
    this.activeImg.set(0);
  }

  selectSize(s: string) {
    this.activeSize.set(s);
    this.sizeError.set(false);
  }

  toggleWishlist() {
    this.inWishlist.update(v => !v);
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
    const size = this.activeSize()!;
    const variantId = Number(`${this.product.id}${this.activeColorIdx()}${size}`.replace(/\D/g, '')) || Date.now();

    this.cart.add({
      variant_id: variantId,
      product_id: this.product.id,
      product_name: this.product.name,
      product_image: color.image,
      product_slug: this.product.slug,
      sku: `${this.product.id}-${color.name.toLowerCase().replace(/\s+/g, '-')}-${size}`,
      size,
      color: color.name,
      unit_price: this.product.price,
      max_stock: 99,
      brand_name: this.product.brand,
    }, 1);

    this.notify.success('Agregado al carrito', {
      description: `${this.product.name} · Talla ${size} · ${color.name}`,
      action: {
        label: 'Ver carrito',
        onClick: () => this.router.navigate(['/cart']),
      },
    });
  }

  toggleWishlistWithToast() {
    const wasIn = this.inWishlist();
    this.toggleWishlist();
    if (!wasIn) {
      this.notify.success('Añadido a tu wishlist', { description: this.product.name });
    } else {
      this.notify.message('Eliminado de tu wishlist');
    }
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
