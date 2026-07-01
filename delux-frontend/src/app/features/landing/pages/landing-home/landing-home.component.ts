import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';
import { PublicCatalogService, PublicProduct } from '@shared/services/public-catalog.service';
import { PublicBranchesService } from '@shared/services/public-branches.service';
import { ZoneService } from '@shared/services/zone.service';
import { BrandingService } from '@core/services/branding.service';

interface DropCard {
  id: number; name: string; brand: string; price: string; tag: string; image: string;
}

interface BranchCard {
  code: string; name: string; city: string; address: string;
  hours: string; products: number;
}


const FALLBACK_BRANCHES: BranchCard[] = [
  { code: 'CENTRO', name: 'Delux Centro', city: 'Quito', address: 'Av. Amazonas N24-03 y Colón',
    hours: 'Lun-Sáb · 10:00 a 20:00', products: 0 },
  { code: 'GYE', name: 'Delux Mall del Sol', city: 'Guayaquil', address: 'C.C. Mall del Sol, Local 128',
    hours: 'Lun-Dom · 10:00 a 22:00', products: 0 },
  { code: 'CUENCA', name: 'Delux Cuenca', city: 'Cuenca', address: 'Av. Solano 5-23',
    hours: 'Lun-Sáb · 10:00 a 19:00', products: 0 },
];

/**
 * Landing — Diseño consistente con auth (Instagram-like clean).
 * Secciones: Hero + Categorías + Drops + Sucursales + Beneficios + CTA
 */
@Component({
  selector: 'dlx-landing-home',
  standalone: true,
  imports: [CommonModule, RouterLink, HeroSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- 1. HERO (banner principal, intacto) -->
    <dlx-hero-section />

    <!-- 2. CATEGORÍAS -->
    <section class="bg-white dark:bg-slate-950 py-24 md:py-32">
      <div class="max-w-[1200px] mx-auto px-6 md:px-10">

        <!-- Header centrado -->
        <div class="text-center max-w-2xl mx-auto mb-16">
          <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-4">
            Catálogo
          </p>
          <h2 class="font-bold text-[36px] md:text-[48px] tracking-[-0.025em] leading-[1.1]
                     text-ink-950 dark:text-white">
            Todo el streetwear,<br/>
            <span class="text-ink-500 dark:text-white/45">en un solo lugar.</span>
          </h2>
          <p class="text-ink-600 dark:text-white/55 text-[16px] mt-5 leading-relaxed max-w-md mx-auto">
            Calzado, ropa y accesorios curados de las marcas que definen la cultura urbana.
          </p>
        </div>

        <!-- 3 cards de categorías -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          @for (cat of categories; track cat.slug) {
            <a [routerLink]="['/shop']" [queryParams]="{ category: cat.slug }"
               class="group block rounded-3xl overflow-hidden
                      bg-white dark:bg-slate-800
                      border border-ink-200 dark:border-white/[0.08]
                      hover:border-[#0095f6] dark:hover:border-[#0095f6]
                      hover:shadow-xl hover:-translate-y-1
                      transition-all duration-300">
              <div class="aspect-[4/3] overflow-hidden bg-ink-100 dark:bg-white/[0.04]">
                <img [src]="cat.image" [alt]="cat.title"
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     loading="lazy" crossorigin="anonymous" />
              </div>
              <div class="p-7">
                <h3 class="font-bold text-[20px] tracking-tight text-ink-950 dark:text-white mb-2">
                  {{ cat.title }}
                </h3>
                <p class="text-ink-600 dark:text-white/55 text-[14px] leading-relaxed mb-4">
                  {{ cat.description }}
                </p>
                <span class="inline-flex items-center gap-2 text-[14px] font-semibold text-[#0095f6]
                             group-hover:gap-3 transition-all">
                  Explorar
                  <i class="fa-solid fa-arrow-right text-xs"></i>
                </span>
              </div>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- 3. DROPS DESTACADOS -->
    <section class="bg-ink-50 dark:bg-slate-900 py-24 md:py-32">
      <div class="max-w-[1200px] mx-auto px-6 md:px-10">

        <div class="flex items-end justify-between mb-12 flex-wrap gap-6">
          <div>
            <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-3">
              Drops
            </p>
            <h2 class="font-bold text-[36px] md:text-[48px] tracking-[-0.025em] leading-[1.1]
                       text-ink-950 dark:text-white">
              Lo más codiciado.
            </h2>
          </div>
          <a routerLink="/shop"
             class="inline-flex items-center gap-2 text-[14px] font-semibold text-[#0095f6] hover:underline">
            Ver todos los drops
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </a>
        </div>

        <!-- Grid de 4 productos -->
        @if (loadingDrops()) {
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
            @for (i of [1,2,3,4]; track i) {
              <div class="aspect-[3/4] rounded-2xl bg-ink-100 dark:bg-white/[0.04] animate-pulse"></div>
            }
          </div>
        } @else if (drops().length === 0) {
          <div class="text-center py-12 text-ink-500 dark:text-white/55">
            <i class="fa-solid fa-box-open text-3xl mb-3"></i>
            <p>No hay productos disponibles aún.</p>
          </div>
        } @else {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
          @for (d of drops(); track d.id) {
            <a [routerLink]="['/shop', d.id]"
               class="group block rounded-2xl overflow-hidden
                      bg-white dark:bg-slate-800
                      border border-ink-200 dark:border-white/[0.08]
                      hover:shadow-xl hover:-translate-y-1
                      transition-all duration-300">
              <div class="relative aspect-square overflow-hidden bg-ink-100 dark:bg-white/[0.04]">
                <span class="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full
                             bg-[#0095f6] text-white text-[10px] font-bold uppercase tracking-wider">
                  {{ d.tag }}
                </span>
                <img [src]="d.image" [alt]="d.name"
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
              </div>
              <div class="p-5">
                <p class="text-[11px] uppercase tracking-wider text-ink-500 dark:text-white/45 mb-1.5">
                  {{ d.brand }}
                </p>
                <h3 class="font-semibold text-[15px] text-ink-950 dark:text-white truncate">
                  {{ d.name }}
                </h3>
                <p class="font-bold text-[18px] text-ink-950 dark:text-white mt-2">
                  \${{ d.price }}
                </p>
              </div>
            </a>
          }
        </div>
        }
      </div>
    </section>

    <!-- 4. BENEFICIOS / TRUST STRIP -->
    <section class="bg-white dark:bg-slate-950 py-20 md:py-24">
      <div class="max-w-[1200px] mx-auto px-6 md:px-10">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (b of benefits; track b.title) {
            <div class="text-center md:text-left p-2">
              <div class="w-12 h-12 rounded-full bg-[#0095f6]/10 dark:bg-[#0095f6]/15
                          grid place-items-center mb-4 mx-auto md:mx-0">
                <i class="fa-solid {{ b.icon }} text-[#0095f6] text-[18px]"></i>
              </div>
              <h3 class="font-bold text-[18px] text-ink-950 dark:text-white mb-2">
                {{ b.title }}
              </h3>
              <p class="text-ink-600 dark:text-white/55 text-[14px] leading-relaxed">
                {{ b.description }}
              </p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- 5. SUCURSALES -->
    <section class="bg-ink-50 dark:bg-slate-900 py-24 md:py-32">
      <div class="max-w-[1200px] mx-auto px-6 md:px-10">

        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-4">
            Sucursales
          </p>
          <h2 class="font-bold text-[36px] md:text-[48px] tracking-[-0.025em] leading-[1.1]
                     text-ink-950 dark:text-white">
            Encuéntranos cerca.
          </h2>
          <p class="text-ink-600 dark:text-white/55 text-[16px] mt-5 leading-relaxed">
            Retira tu pedido sin costo o compra en persona en cualquiera de nuestras tiendas.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          @for (br of branches(); track br.code) {
            <div class="bg-white dark:bg-slate-800
                        border border-ink-200 dark:border-white/[0.08]
                        rounded-2xl p-7
                        hover:shadow-lg hover:-translate-y-1
                        transition-all duration-300">
              <div class="flex items-center justify-between mb-4">
                <span class="font-mono text-[11px] tracking-widest uppercase text-[#0095f6] font-bold">
                  {{ br.code }}
                </span>
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <h3 class="font-bold text-[20px] tracking-tight text-ink-950 dark:text-white mb-1">
                {{ br.name }}
              </h3>
              <div class="flex items-start gap-2 mb-5">
                <i class="fa-solid fa-location-dot text-[#0095f6] text-[12px] mt-1.5"></i>
                <p class="text-ink-600 dark:text-white/55 text-[14px] leading-relaxed flex-1">
                  {{ br.address }}<br/>
                  <span class="text-ink-400 dark:text-white/40">{{ br.city }}</span>
                </p>
              </div>
              <div class="grid grid-cols-2 gap-2 pt-4 border-t border-ink-100 dark:border-white/[0.06] text-[12px]">
                <div class="flex items-center gap-2 text-ink-600 dark:text-white/55">
                  <i class="fa-regular fa-clock text-[#0095f6] text-[11px]"></i>
                  <span class="truncate">{{ br.hours }}</span>
                </div>
                <div class="flex items-center gap-2 text-ink-600 dark:text-white/55 justify-end">
                  <i class="fa-solid fa-bag-shopping text-[#0095f6] text-[11px]"></i>
                  <span>{{ br.products > 0 ? br.products + ' productos' : 'Retiro gratis' }}</span>
                </div>
              </div>
              <button type="button" (click)="openMap(br)"
                      class="w-full mt-5 inline-flex items-center justify-center gap-2 h-10 rounded-full
                             bg-ink-50 dark:bg-white/[0.06]
                             hover:bg-[#0095f6] hover:text-white
                             dark:hover:bg-[#0095f6] dark:hover:text-white
                             text-ink-950 dark:text-white text-[13px] font-semibold
                             transition-colors">
                Cómo llegar
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              </button>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- 5.5 PROGRAMA DE AFILIADOS -->
    <section class="relative overflow-hidden py-24 md:py-32 bg-[#070b12]">
      <!-- glow de marca -->
      <div class="pointer-events-none absolute -top-32 right-0 w-[520px] h-[520px] rounded-full bg-[#0095f6]/25 blur-[120px]"></div>
      <div class="pointer-events-none absolute -bottom-40 -left-24 w-[460px] h-[460px] rounded-full bg-[#1877f2]/15 blur-[120px]"></div>
      <div class="pointer-events-none absolute top-1/2 left-1/3 w-2 h-2 rounded-full bg-[#e11d2a]/70 blur-[2px]"></div>

      <div class="relative max-w-[1150px] mx-auto px-6 md:px-10">
        <div class="grid lg:grid-cols-2 gap-14 items-center">

          <!-- Copy -->
          <div class="text-white">
            <span class="inline-flex items-center gap-2 rounded-full border border-[#0095f6]/30 bg-[#0095f6]/10
                         px-4 py-1.5 text-[12px] font-semibold tracking-[0.18em] uppercase text-[#4db5ff] mb-6">
              <i class="fa-solid fa-hand-holding-dollar"></i> Gana dinero con Delux
            </span>
            <h2 class="font-bold text-[38px] md:text-[54px] tracking-[-0.03em] leading-[1.03]">
              Conviértete en<br/>
              <span class="text-[#0095f6]">Vendedor Afiliado</span>.
            </h2>
            <p class="text-white/65 text-[17px] mt-6 leading-relaxed max-w-md">
              Comparte tus enlaces de productos y gana una comisión del
              <strong class="text-white">{{ branding.affiliateCommissionRate() }}%</strong>
              por cada venta. Sin inventario, sin inversión, desde tu celular.
            </p>

            <div class="mt-9 grid sm:grid-cols-3 gap-3">
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-[#0095f6]/15 text-[#4db5ff] mb-3"><i class="fa-solid fa-link"></i></span>
                <p class="text-[13px] text-white/75 leading-snug">Enlace único para compartir</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-[#0095f6]/15 text-[#4db5ff] mb-3"><i class="fa-solid fa-bolt"></i></span>
                <p class="text-[13px] text-white/75 leading-snug">Comisiones automáticas</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-[#0095f6]/15 text-[#4db5ff] mb-3"><i class="fa-solid fa-wallet"></i></span>
                <p class="text-[13px] text-white/75 leading-snug">Cobra en efectivo o transferencia</p>
              </div>
            </div>

            <div class="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <a [routerLink]="['/auth/register']" [queryParams]="{ type: 'affiliate' }"
                 class="group inline-flex items-center justify-center gap-2 px-8 h-14 rounded-full
                        bg-[#0095f6] text-white font-bold text-[16px]
                        shadow-[0_18px_40px_-12px_rgba(0,149,246,0.7)]
                        hover:bg-[#1877f2] hover:-translate-y-0.5 transition-all">
                Quiero ser afiliado
                <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </a>
              <span class="text-white/45 text-[13px]">
                Registro gratis · activación por correo ·
                <a routerLink="/afiliados/terminos" class="text-white/70 underline hover:text-white">Ver términos</a>
              </span>
            </div>
          </div>

          <!-- Tarjeta ilustrativa -->
          <div class="relative lg:pl-6">
            <div class="absolute -inset-1 rounded-[28px] bg-gradient-to-tr from-[#0095f6]/40 to-transparent blur-2xl opacity-60"></div>
            <div class="relative rounded-[26px] bg-gradient-to-b from-white/[0.08] to-white/[0.02]
                        backdrop-blur border border-white/12 p-8 shadow-2xl">
              <div class="flex items-center justify-between mb-7">
                <span class="text-white/45 text-[11px] uppercase tracking-[0.22em] font-semibold">Tu comisión</span>
                <span class="flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> en vivo
                </span>
              </div>
              <div class="text-white flex items-end gap-1">
                <span class="text-[76px] leading-none font-black tracking-tight
                             bg-gradient-to-br from-white to-[#4db5ff] bg-clip-text text-transparent">{{ branding.affiliateCommissionRate() }}</span>
                <span class="text-[36px] font-black text-[#4db5ff] mb-2">%</span>
              </div>
              <p class="text-white/55 mt-1 text-[15px]">por cada venta atribuida a ti</p>

              <div class="mt-8 space-y-3">
                <div class="flex items-center justify-between rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3">
                  <span class="text-white/80 text-[14px] font-mono tracking-wider">VEND0001</span>
                  <span class="text-[#4db5ff] text-[13px] font-semibold"><i class="fa-solid fa-copy"></i> tu código</span>
                </div>
                <div class="flex items-center justify-between rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3">
                  <span class="text-white/80 text-[14px]">Venta de $120.00</span>
                  <span class="text-emerald-300 text-[15px] font-bold">+ {{ exampleCommission() }}</span>
                </div>
              </div>

              <div class="mt-6 flex items-center gap-2 text-white/40 text-[12px]">
                <i class="fa-solid fa-shield-halved text-[#4db5ff]"></i>
                Pagos registrados y con historial en tu panel.
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- 6. CTA FINAL -->
    <section class="bg-white dark:bg-slate-950 py-28 md:py-40">
      <div class="max-w-[700px] mx-auto px-6 md:px-10 text-center">
        <h2 class="font-bold text-[40px] md:text-[56px] tracking-[-0.03em] leading-[1.05]
                   text-ink-950 dark:text-white">
          Únete a Delux.
        </h2>
        <p class="text-ink-600 dark:text-white/55 text-[17px] mt-6 leading-relaxed max-w-md mx-auto">
          Crea tu cuenta gratis y accede a drops exclusivos antes que nadie.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a routerLink="/auth/register"
             class="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full
                    bg-[#0095f6] text-white font-semibold text-[15px]
                    hover:bg-[#1877f2] transition">
            Crear cuenta
          </a>
          <a routerLink="/shop"
             class="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full
                    bg-transparent text-ink-950 dark:text-white
                    border border-ink-300 dark:border-white/20
                    font-semibold text-[15px]
                    hover:border-ink-950 dark:hover:border-white transition">
            Ver catálogo
          </a>
        </div>
      </div>
    </section>
  `,
})
export class LandingHomeComponent implements OnInit {
  private catalog = inject(PublicCatalogService);
  private branchSvc = inject(PublicBranchesService);
  private zone = inject(ZoneService);
  branding = inject(BrandingService);

  constructor() {
    // Recarga los drops cuando el cliente cambia de ciudad.
    effect(() => { const c = this.zone.city(); this.loadDrops(c); });
  }

  drops = signal<DropCard[]>([]);
  loadingDrops = signal(true);

  // Sucursales: arranca con un fallback y se reemplaza con las registradas en superadmin.
  branches = signal<BranchCard[]>(FALLBACK_BRANCHES);

  ngOnInit(): void {
    this.loadBranches();
  }

  /** Comision de ejemplo sobre una venta de $120 (para la tarjeta ilustrativa). */
  exampleCommission(): string {
    const rate = +this.branding.affiliateCommissionRate() || 0;
    return '$' + (120 * rate / 100).toFixed(2);
  }

  private loadDrops(city: string | null): void {
    this.loadingDrops.set(true);
    this.catalog.listProducts({ sort: 'featured', city: city || undefined }).subscribe({
      next: r => {
        this.drops.set((r.results || []).slice(0, 4).map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand_name,
          price: p.base_price,
          tag: this.tagLabel(p.tag),
          image: p.thumb_url || p.main_image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85',
        })));
        this.loadingDrops.set(false);
      },
      error: () => this.loadingDrops.set(false),
    });
  }

  private tagLabel(t: string): string {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as any)[t] || 'Drop';
  }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img.dataset['ph'] === '1') return;
    img.dataset['ph'] = '1';
    img.src = IMG_PLACEHOLDER;
    img.classList.add('object-contain', 'p-6', 'opacity-70');
    img.classList.remove('object-cover');
  }

  openMap(br: BranchCard): void {
    const q = encodeURIComponent(`Delux ${br.name}, ${br.address}, ${br.city}, Ecuador`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  private loadBranches(): void {
    this.branchSvc.list().subscribe({
      next: r => {
        const items = (r.results || []).map(b => ({
          code: b.code,
          name: b.name,
          city: b.city,
          address: b.address,
          hours: b.opening_hours || 'Lun-Sab - 10:00 a 20:00',
          products: b.products_count,
        }));
        if (items.length) this.branches.set(items);
      },
      error: () => {},
    });
  }

  readonly categories = [
    {
      slug: 'zapatillas',
      title: 'Zapatillas',
      description: 'Nike, Adidas, Jordan, New Balance y más. Drops semanales.',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=85&auto=format&fit=crop',
    },
    {
      slug: 'ropa',
      title: 'Ropa',
      description: 'Hoodies, camisetas, pantalones y outerwear con carácter urbano.',
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=85&auto=format&fit=crop',
    },
    {
      slug: 'accesorios',
      title: 'Accesorios',
      description: 'Mochilas, gorras y complementos para completar tu fit.',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=85&auto=format&fit=crop',
    },
  ];

  readonly benefits = [
    { icon: 'fa-bolt', title: 'Envío 24h', description: 'Recibe tu pedido al día siguiente en Quito y Guayaquil. Gratis sobre $50.' },
    { icon: 'fa-shield-halved', title: 'Pago 100% seguro', description: 'Procesado con PayPhone. Aceptamos todas las tarjetas y cuotas sin intereses.' },
    { icon: 'fa-rotate-left', title: 'Cambios sin estrés', description: 'Tienes 14 días para cambios y devoluciones. Sin preguntas, sin letra chica.' },
  ];

}
