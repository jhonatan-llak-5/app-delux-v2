import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReviewsComponent } from '@shared/components/reviews/reviews.component';

interface ColorOption { name: string; hex: string; image: string; }

@Component({
  selector: 'dlx-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReviewsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pt-28 pb-24">

      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs text-ink-500 dark:text-white/50 mb-8">
        <a routerLink="/" class="hover:text-base">Inicio</a>
        <i class="fa-solid fa-chevron-right text-[8px]"></i>
        <a routerLink="/shop" class="hover:text-base">Shop</a>
        <i class="fa-solid fa-chevron-right text-[8px]"></i>
        <span>{{ product.category }}</span>
        <i class="fa-solid fa-chevron-right text-[8px]"></i>
        <span class="text-base">{{ product.name }}</span>
      </nav>

      <!-- Galería + info -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">

        <!-- Galería estilo Nike: thumbs verticales + main image -->
        <div class="lg:col-span-7 grid grid-cols-[80px_1fr] gap-4">
          <!-- Thumbnails verticales -->
          <div class="space-y-2 max-h-[600px] overflow-y-auto">
            @for (img of product.gallery; track img; let i = $index) {
              <button (click)="activeImg.set(i)"
                      class="w-full aspect-square rounded-xl overflow-hidden border-2 transition-all"
                      [class.border-accent-400]="i === activeImg()"
                      [class.opacity-50]="i !== activeImg()"
                      [style.border-color]="i !== activeImg() ? 'rgba(var(--text), 0.08)' : ''">
                <img [src]="img" [alt]="product.name + ' ' + (i+1)"
                     class="w-full h-full object-cover" loading="lazy" crossorigin="anonymous" />
              </button>
            }
          </div>

          <!-- Imagen principal con zoom on hover -->
          <div class="relative aspect-square rounded-3xl overflow-hidden bg-ink-100 dark:bg-ink-800 cursor-zoom-in"
               (mouseenter)="zoomed.set(true)" (mouseleave)="zoomed.set(false)"
               (mousemove)="onMouseMove($event)">
            <img [src]="product.gallery[activeImg()]" [alt]="product.name"
                 class="w-full h-full object-cover transition-transform duration-300"
                 [class.scale-150]="zoomed()"
                 [style.transform-origin]="zoomOrigin()"
                 loading="eager" crossorigin="anonymous" />

            <!-- Tag -->
            @if (product.tag) {
              <span class="absolute top-4 left-4 text-[9px] font-bold tracking-[0.2em] uppercase
                           px-3 py-1.5 rounded-full bg-accent-400 text-ink-950">
                {{ product.tag }}
              </span>
            }

            <!-- Arrows -->
            <button (click)="prevImg()" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10
                                                 rounded-full glass-strong grid place-items-center
                                                 hover:scale-110 transition">
              <i class="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button (click)="nextImg()" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10
                                                 rounded-full glass-strong grid place-items-center
                                                 hover:scale-110 transition">
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="lg:col-span-5 space-y-6">
          <div>
            <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500 dark:text-white/50">{{ product.brand }}</p>
            <h1 class="display-xl text-3xl md:text-4xl mt-2">{{ product.name }}</h1>
            <p class="text-ink-700 dark:text-white/70 mt-2">{{ product.subtitle }}</p>

            <div class="flex items-center gap-4 mt-4">
              <div class="flex gap-0.5 text-accent-400">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="fa-solid fa-star text-xs"
                     [class.opacity-30]="s > Math.round(product.rating)"></i>
                }
              </div>
              <span class="text-sm text-ink-700 dark:text-white/70">{{ product.rating }} ({{ product.reviewsCount }} reseñas)</span>
            </div>

            <div class="mt-6 flex items-baseline gap-3">
              <span class="font-display text-4xl font-bold">\${{ product.price }}</span>
              @if (product.oldPrice) {
                <span class="text-lg text-ink-500 dark:text-white/50 line-through">\${{ product.oldPrice }}</span>
                <span class="bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded">
                  -{{ discount() }}%
                </span>
              }
            </div>
            <p class="text-xs text-ink-500 dark:text-white/50 mt-1">o 3 pagos sin interés de \${{ (product.price/3).toFixed(2) }}</p>
          </div>

          <hr style="border-color: rgba(var(--text), 0.1);" />

          <!-- Colores -->
          <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-3">
              Color: <span class="text-ink-700 dark:text-white/70">{{ activeColor().name }}</span>
            </h3>
            <div class="flex gap-2">
              @for (c of product.colors; track c.name; let i = $index) {
                <button (click)="selectColor(i)"
                        class="w-16 h-16 rounded-xl overflow-hidden border-2 transition-all"
                        [class.border-accent-400]="i === activeColorIdx()"
                        [style.border-color]="i !== activeColorIdx() ? 'rgba(var(--text), 0.1)' : ''">
                  <img [src]="c.image" [alt]="c.name"
                       class="w-full h-full object-cover" loading="lazy" crossorigin="anonymous" />
                </button>
              }
            </div>
          </div>

          <!-- Tallas -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold uppercase tracking-widest">Selecciona talla</h3>
              <button class="text-xs underline text-ink-700 dark:text-white/70">Guía de tallas</button>
            </div>
            <div class="grid grid-cols-4 gap-2">
              @for (s of product.sizes; track s) {
                <button (click)="activeSize.set(s)"
                        class="aspect-square rounded-lg border text-sm font-semibold transition"
                        [class.bg-white dark:bg-ink-950]="activeSize() === s"
                        [class.text-base]="activeSize() === s"
                        [class.border-accent-400]="activeSize() === s"
                        [style.background]="activeSize() === s ? 'rgb(var(--text))' : ''"
                        [style.color]="activeSize() === s ? 'rgb(var(--bg-white dark:bg-ink-950))' : ''"
                        [style.border-color]="activeSize() === s ? '' : 'rgba(var(--text), 0.15)'">
                  {{ s }}
                </button>
              }
            </div>
            @if (!activeSize()) {
              <p class="text-xs text-brand-orange mt-2">Selecciona una talla para continuar</p>
            }
          </div>

          <!-- CTAs -->
          <div class="space-y-3 pt-2">
            <button [disabled]="!activeSize()"
                    class="w-full btn-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <i class="fa-solid fa-bag-shopping"></i> Agregar al carrito
            </button>
            <button class="w-full btn-outline">
              <i class="fa-regular fa-heart"></i> Agregar a wishlist
            </button>
          </div>

          <!-- Features -->
          <div class="grid grid-cols-2 gap-3 pt-4 text-xs">
            <div class="flex items-center gap-2 text-ink-700 dark:text-white/70">
              <i class="fa-solid fa-truck-fast text-accent-400"></i>
              Envío 24-72h
            </div>
            <div class="flex items-center gap-2 text-ink-700 dark:text-white/70">
              <i class="fa-solid fa-rotate-left text-accent-400"></i>
              Cambios en 14 días
            </div>
            <div class="flex items-center gap-2 text-ink-700 dark:text-white/70">
              <i class="fa-solid fa-shield-halved text-accent-400"></i>
              100% original
            </div>
            <div class="flex items-center gap-2 text-ink-700 dark:text-white/70">
              <i class="fa-solid fa-store text-accent-400"></i>
              Retiro en tienda
            </div>
          </div>

          <!-- Accordion descripción -->
          <div class="space-y-2 pt-4">
            @for (acc of accordions; track acc.id) {
              <details class="border-t pt-4" style="border-color: rgba(var(--text), 0.08);">
                <summary class="cursor-pointer font-semibold text-sm flex items-center justify-between list-none">
                  {{ acc.title }}
                  <i class="fa-solid fa-plus text-xs transition-transform"></i>
                </summary>
                <p class="text-sm text-ink-700 dark:text-white/70 mt-3 leading-relaxed">{{ acc.body }}</p>
              </details>
            }
          </div>
        </div>
      </div>

      <!-- Reseñas -->
      <div class="mt-24 pt-12 border-t" style="border-color: rgba(var(--text), 0.08);">
        <p class="eyebrow mb-4">/ Opiniones de clientes</p>
        <dlx-reviews [productId]="product.id" />
      </div>

    </section>
  `,
})
export class ProductDetailComponent {
  Math = Math;

  activeImg = signal(0);
  activeColorIdx = signal(0);
  activeSize = signal<string | null>(null);
  zoomed = signal(false);
  zoomOrigin = signal('center');

  readonly product = {
    id: '1',
    name: 'Air Force Stealth',
    subtitle: 'Sneakers de performance · Unisex',
    brand: 'Nike',
    category: 'Zapatillas',
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

  activeColor = computed(() => this.product.colors[this.activeColorIdx()]);
  discount = computed(() => {
    if (!this.product.oldPrice) return 0;
    return Math.round(((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100);
  });

  readonly accordions = [
    { id: 'desc', title: 'Descripción',
      body: 'Diseñadas para la cultura urbana, las Air Force Stealth combinan herencia y tecnología. Materiales premium con cuero genuino, suela de espuma de alta respuesta y cordones planos clásicos.' },
    { id: 'mat', title: 'Materiales',
      body: 'Capellada de cuero genuino curtido al cromo. Suela exterior de caucho con patrón de pivot. Plantilla acolchada con espuma de memoria.' },
    { id: 'env', title: 'Envío y devoluciones',
      body: 'Envío gratis a todo el país en pedidos sobre $50. Recibe en 24-72 horas. Cambios sin costo durante los primeros 14 días.' },
  ];

  selectColor(i: number) {
    this.activeColorIdx.set(i);
    this.activeImg.set(0);
  }
  prevImg() {
    this.activeImg.update(i => (i - 1 + this.product.gallery.length) % this.product.gallery.length);
  }
  nextImg() {
    this.activeImg.update(i => (i + 1) % this.product.gallery.length);
  }
  onMouseMove(ev: MouseEvent) {
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    this.zoomOrigin.set(`${x}% ${y}%`);
  }
}
