import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface HeroProduct {
  id: string; name: string; collection: string; tagline: string; price: number;
  image: string; haloClass: string; gradient: string;
}
type HeroPhase = 'showcase';

@Component({
  selector: 'dlx-hero-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative min-h-[100svh] overflow-hidden pt-20">

      <!-- Gradiente fluido base (más sutil) -->
      <div class="pointer-events-none absolute inset-0 animate-fluid-drift opacity-25 dark:opacity-60 transition-all duration-1000"
           [style.background]="currentGradient()"></div>

      <!-- Shimmer (sutil) -->
      <div class="pointer-events-none absolute inset-0 opacity-20 dark:opacity-30 mix-blend-overlay animate-liquid-wave"
           style="background:
             radial-gradient(35% 50% at 25% 30%, rgba(255,255,255,0.3) 0%, transparent 60%),
             radial-gradient(35% 50% at 75% 70%, rgba(255,255,255,0.2) 0%, transparent 60%);"></div>

      <!-- Grid muy sutil -->
      <div class="pointer-events-none absolute inset-0 grid-pattern opacity-[0.15]"></div>

      <!-- Vignette inferior -->
      <div class="pointer-events-none absolute inset-0
                  bg-gradient-to-b from-transparent
                  via-white/30 to-white dark:via-ink-950/30 dark:to-ink-950"></div>

      <!-- ═══════════ SHOWCASE (única fase) ═══════════ -->
      <div class="relative max-w-[1600px] mx-auto px-6 md:px-10 pt-8 pb-24 animate-zoom-fade">

        <!-- Header: meta del drop + link al catálogo -->
        <div class="flex items-center justify-between mb-12 animate-fade-in">
          <div class="flex items-center gap-4 font-mono text-[10px] tracking-widest text-ink-500 dark:text-white/40">
            <span>DROP {{ currentProduct().id }}</span>
            <span class="w-px h-3 bg-ink-300 dark:bg-white/20"></span>
            <span>{{ currentProduct().collection }}</span>
            <span class="w-px h-3 bg-ink-300 dark:bg-white/20"></span>
            <span class="text-accent-500 dark:text-accent-400 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-accent-500 dark:bg-accent-400 animate-pulse"></span>
              DISPONIBLE
            </span>
          </div>

          <a routerLink="/shop"
             class="text-[10px] tracking-[0.3em] uppercase font-mono
                    text-ink-500 dark:text-white/50 hover:text-ink-900 dark:hover:text-white transition
                    flex items-center gap-2 group">
            <span>Ver todo</span>
            <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition"></i>
          </a>
        </div>

          <!-- Producto principal -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div class="lg:col-span-7 relative h-[420px] md:h-[560px] grid place-items-center">
              <span class="absolute wordmark text-[26vw] md:text-[18vw] leading-none select-none animate-liquid-wave pointer-events-none tracking-[-0.04em]">Delux</span>

              <div class="absolute w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full
                          blur-3xl animate-halo-pulse transition-colors duration-1000 opacity-50 dark:opacity-100"
                   [ngClass]="currentProduct().haloClass"></div>

              <div class="relative w-full max-w-3xl px-8 animate-tilt-float drop-shadow-editorial">
                <div class="animate-product-enter" [attr.data-key]="index()">
                  <img [src]="currentProduct().image" [alt]="currentProduct().name"
                       class="w-full h-auto object-contain max-h-[460px] md:max-h-[560px]"
                       loading="eager" crossorigin="anonymous" (error)="onImgError($event)" />
                </div>
              </div>

              <div class="absolute top-4 right-4 font-display font-extrabold
                          text-[120px] md:text-[200px]
                          text-ink-200 dark:text-white/5 leading-none select-none tracking-tighter">
                {{ currentProduct().id }}
              </div>
            </div>

            <div class="lg:col-span-5 lg:pl-8 space-y-7 animate-slide-up-late">
              <p class="eyebrow">Featured Drop</p>
              <h2 class="display-xl text-5xl md:text-6xl text-ink-950 dark:text-white tracking-[-0.03em] font-semibold leading-[0.95]">
                {{ currentProduct().name }}
              </h2>
              <div class="reveal-line max-w-[120px]"></div>
              <p class="text-ink-700 dark:text-white/60 leading-relaxed text-base md:text-lg max-w-md">
                {{ currentProduct().tagline }}
              </p>
              <div class="flex items-end justify-between gap-6 pt-2">
                <div>
                  <p class="text-[10px] tracking-widest uppercase text-ink-500 dark:text-white/40 mb-1.5">Precio</p>
                  <p class="font-display text-4xl font-bold tracking-tight">\${{ currentProduct().price }}</p>
                </div>
                <a routerLink="/shop" class="btn-accent text-sm font-semibold px-7 py-3.5 group">
                  Añadir a la bolsa
                  <i class="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition"></i>
                </a>
              </div>
            </div>
          </div>

          <!-- ═══════════ NUEVO CAROUSEL DE THUMBNAILS — Simétrico ═══════════ -->
          <div class="mt-20 animate-slide-up-later">

            <!-- Progreso superior centrado -->
            <div class="flex items-center justify-center gap-5 mb-8">
              <span class="font-mono text-sm font-bold text-ink-950 dark:text-white tracking-wide">{{ paddedIndex() }}</span>
              <div class="w-48 h-px bg-ink-200 dark:bg-white/10 relative overflow-hidden rounded-full">
                <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-500 to-brand-violet dark:from-accent-400 dark:to-brand-magenta transition-all duration-700 ease-out rounded-full"
                     [style.width.%]="progressPercent()"></div>
              </div>
              <span class="font-mono text-sm text-ink-400 dark:text-white/40 tracking-wide">{{ paddedTotal() }}</span>
            </div>

            <!-- Grid simétrico: arrow · carousel · arrow -->
            <div class="grid grid-cols-[auto_1fr_auto] items-center gap-6 md:gap-8">

              <!-- Prev -->
              <button (click)="prev()"
                      class="w-12 h-12 md:w-14 md:h-14 rounded-full
                             bg-white/80 dark:bg-white/5 backdrop-blur-md
                             border border-ink-200 dark:border-white/10
                             grid place-items-center
                             hover:bg-ink-950 hover:text-white hover:border-ink-950
                             dark:hover:bg-white dark:hover:text-ink-950 dark:hover:border-white
                             hover:scale-105 active:scale-95 transition-all duration-300
                             text-ink-700 dark:text-white" aria-label="Anterior">
                <i class="fa-solid fa-arrow-left text-sm"></i>
              </button>

              <!-- Thumbnails con info -->
              <div class="overflow-x-auto scrollbar-hide">
                <div class="flex gap-4 md:gap-5 justify-center min-w-fit px-1 py-1">
                  @for (p of products; track p.id; let i = $index) {
                    <button (click)="setIndex(i)"
                            class="group relative flex flex-col items-stretch gap-3 transition-all duration-500"
                            [class.scale-105]="i === index()"
                            [attr.aria-label]="p.name">

                      <!-- Card del thumbnail -->
                      <div class="relative w-[120px] md:w-[150px] h-[120px] md:h-[150px] rounded-2xl overflow-hidden
                                  transition-all duration-500"
                           [class.ring-2]="i === index()"
                           [class.ring-accent-500]="i === index()"
                           [class.dark:ring-accent-400]="i === index()"
                           [class.ring-offset-2]="i === index()"
                           [class.ring-offset-white]="i === index()"
                           [class.dark:ring-offset-ink-950]="i === index()"
                           [class.shadow-glow]="i === index()">

                        <!-- BG con tinte del producto -->
                        <div class="absolute inset-0 transition-opacity duration-500"
                             [class.opacity-100]="i === index()"
                             [class.opacity-60]="i !== index()"
                             [ngClass]="p.haloClass"></div>

                        <!-- Overlay para legibilidad -->
                        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40"></div>

                        <!-- Imagen -->
                        <img [src]="p.image" [alt]="p.name"
                             class="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-500
                                    group-hover:scale-110"
                             loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />

                        <!-- Número en esquina -->
                        <span class="absolute top-2 left-2 font-mono text-[10px] font-bold tracking-widest
                                     text-white/90 bg-black/30 backdrop-blur px-1.5 py-0.5 rounded-md">
                          {{ p.id }}
                        </span>

                        <!-- Indicador activo -->
                        @if (i === index()) {
                          <div class="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-accent-400 animate-pulse shadow-glow"></div>
                        }
                      </div>

                      <!-- Info debajo del thumbnail -->
                      <div class="text-left px-1">
                        <p class="font-mono text-[9px] tracking-[0.2em] uppercase
                                  text-ink-500 dark:text-white/40 mb-0.5 truncate">
                          {{ p.collection }}
                        </p>
                        <p class="text-xs font-semibold truncate transition-colors duration-300"
                           [class.text-ink-950]="i === index()"
                           [class.dark:text-white]="i === index()"
                           [class.text-ink-600]="i !== index()"
                           [class.dark:text-white/60]="i !== index()">
                          {{ p.name }}
                        </p>
                        <p class="text-[11px] font-bold mt-0.5 transition-colors duration-300"
                           [class.text-accent-600]="i === index()"
                           [class.dark:text-accent-400]="i === index()"
                           [class.text-ink-400]="i !== index()"
                           [class.dark:text-white/40]="i !== index()">
                          \${{ p.price }}
                        </p>
                      </div>
                    </button>
                  }
                </div>
              </div>

              <!-- Next -->
              <button (click)="next()"
                      class="w-12 h-12 md:w-14 md:h-14 rounded-full
                             bg-white/80 dark:bg-white/5 backdrop-blur-md
                             border border-ink-200 dark:border-white/10
                             grid place-items-center
                             hover:bg-ink-950 hover:text-white hover:border-ink-950
                             dark:hover:bg-white dark:hover:text-ink-950 dark:hover:border-white
                             hover:scale-105 active:scale-95 transition-all duration-300
                             text-ink-700 dark:text-white" aria-label="Siguiente">
                <i class="fa-solid fa-arrow-right text-sm"></i>
              </button>
            </div>

            <!-- Dots indicators (extra layer) -->
            <div class="flex items-center justify-center gap-2 mt-8">
              @for (p of products; track p.id; let i = $index) {
                <button (click)="setIndex(i)"
                        class="h-1.5 rounded-full transition-all duration-500"
                        [class.w-8]="i === index()"
                        [class.bg-ink-950]="i === index()"
                        [class.dark:bg-white]="i === index()"
                        [class.w-1.5]="i !== index()"
                        [class.bg-ink-300]="i !== index()"
                        [class.dark:bg-white/20]="i !== index()"
                        [attr.aria-label]="'Ir a ' + p.name"></button>
              }
            </div>
          </div>
        </div>
    </section>
  `,
})
export class HeroSectionComponent implements OnInit, OnDestroy {
  isDark = false;

  readonly products: HeroProduct[] = [
    { id: '01', name: 'Air Force Stealth', collection: 'Performance',
      tagline: 'Energía vibrante y confort premium. Diseñada para máximo rendimiento en cada pisada.',
      price: 200,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-magenta',
      gradient:
        'radial-gradient(60% 80% at 70% 30%, rgba(255,87,168,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 30% 60%, rgba(255,120,73,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(124,58,237,0.4) 0%, transparent 70%),' +
        'radial-gradient(40% 60% at 80% 80%, rgba(34,211,238,0.4) 0%, transparent 70%)' },
    { id: '02', name: 'Court Vintage', collection: 'Lifestyle',
      tagline: 'Un calzado con personalidad que evoca la nostalgia urbana de los noventas reinventada.',
      price: 180,
      image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-violet',
      gradient:
        'radial-gradient(60% 80% at 30% 30%, rgba(124,58,237,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 70% 60%, rgba(224,57,154,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.3) 0%, transparent 70%)' },
    { id: '03', name: 'Pulse Runner', collection: 'Innovation',
      tagline: 'Simplifica tu carrera. Tecnología de respuesta dinámica para máximo retorno de energía.',
      price: 220,
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-accent-500',
      gradient:
        'radial-gradient(60% 80% at 70% 30%, rgba(20,184,166,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 30% 60%, rgba(34,211,238,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(124,58,237,0.3) 0%, transparent 70%)' },
    { id: '04', name: 'Heritage OG', collection: 'Heritage',
      tagline: 'Nacido en el campo deportivo. Adoptado por la cultura urbana mundial.',
      price: 160,
      image: 'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-orange',
      gradient:
        'radial-gradient(60% 80% at 30% 30%, rgba(255,120,73,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 70% 60%, rgba(224,57,154,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.4) 0%, transparent 70%)' },
  ];

  private readonly defaultGradient =
    'radial-gradient(60% 80% at 70% 30%, rgba(224,57,154,0.45) 0%, transparent 60%),' +
    'radial-gradient(50% 70% at 30% 60%, rgba(124,58,237,0.4) 0%, transparent 65%),' +
    'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.35) 0%, transparent 70%),' +
    'radial-gradient(40% 60% at 80% 80%, rgba(255,120,73,0.35) 0%, transparent 70%)';

  phase = signal<HeroPhase>('showcase');
  index = signal(0);
  currentProduct = computed(() => this.products[this.index()]);
  currentGradient = computed(() => this.currentProduct().gradient);
  paddedIndex = computed(() => String(this.index() + 1).padStart(2, '0'));
  paddedTotal = computed(() => String(this.products.length).padStart(2, '0'));
  progressPercent = computed(() => ((this.index() + 1) / this.products.length) * 100);

  private rotationTimer?: ReturnType<typeof setInterval>;
  private userInteractedSinceShowcase = false;

  ngOnInit(): void {
    this.startAutoRotation();
  }
  ngOnDestroy(): void {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  }
  private startAutoRotation() {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    this.rotationTimer = setInterval(() => {
      if (!this.userInteractedSinceShowcase) this.next();
    }, 5500);
  }
  setIndex(i: number) { this.userInteractedSinceShowcase = true; this.index.set(i); }
  next() { this.index.update((i) => (i + 1) % this.products.length); }
  prev() { this.userInteractedSinceShowcase = true; this.index.update((i) => (i - 1 + this.products.length) % this.products.length); }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="%23cbd5e1"/><text x="100" y="65" font-family="sans-serif" font-size="14" fill="%2364748b" text-anchor="middle">' + (img.alt || 'sneaker') + '</text></svg>';
  }
}
