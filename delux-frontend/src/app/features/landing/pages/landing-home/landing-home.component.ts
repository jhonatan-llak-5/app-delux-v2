import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';

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
    <section class="bg-white dark:bg-[#0a0a0a] py-24 md:py-32">
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
                      bg-white dark:bg-[#111111]
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
    <section class="bg-ink-50 dark:bg-[#050505] py-24 md:py-32">
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
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
          @for (d of drops; track d.id) {
            <a [routerLink]="['/shop', d.id]"
               class="group block rounded-2xl overflow-hidden
                      bg-white dark:bg-[#111111]
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
                     loading="lazy" crossorigin="anonymous" />
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
      </div>
    </section>

    <!-- 4. BENEFICIOS / TRUST STRIP -->
    <section class="bg-white dark:bg-[#0a0a0a] py-20 md:py-24">
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
    <section class="bg-ink-50 dark:bg-[#050505] py-24 md:py-32">
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
          @for (br of branches; track br.code) {
            <div class="bg-white dark:bg-[#111111]
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
                  <span>Retiro gratis</span>
                </div>
              </div>
              <button class="w-full mt-5 inline-flex items-center justify-center gap-2 h-10 rounded-full
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

    <!-- 6. CTA FINAL -->
    <section class="bg-white dark:bg-[#0a0a0a] py-28 md:py-40">
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
export class LandingHomeComponent {
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

  readonly drops = [
    { id: '01', name: 'Court Vintage', brand: 'Nike', price: 180, tag: 'Drop',
      image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=85&auto=format&fit=crop' },
    { id: '02', name: 'Heritage OG', brand: 'Converse', price: 95, tag: 'Nuevo',
      image: 'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=600&q=85&auto=format&fit=crop' },
    { id: '03', name: 'Pulse Runner', brand: 'Puma', price: 220, tag: 'Nuevo',
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=85&auto=format&fit=crop' },
    { id: '04', name: 'Forum Low', brand: 'Adidas', price: 140, tag: 'Exclusivo',
      image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&q=85&auto=format&fit=crop' },
  ];

  readonly benefits = [
    { icon: 'fa-bolt', title: 'Envío 24h', description: 'Recibe tu pedido al día siguiente en Quito y Guayaquil. Gratis sobre $50.' },
    { icon: 'fa-shield-halved', title: 'Pago 100% seguro', description: 'Procesado con PayPhone. Aceptamos todas las tarjetas y cuotas sin intereses.' },
    { icon: 'fa-rotate-left', title: 'Cambios sin estrés', description: 'Tienes 14 días para cambios y devoluciones. Sin preguntas, sin letra chica.' },
  ];

  readonly branches = [
    { code: 'CENTRO', name: 'Delux Centro', city: 'Quito', address: 'Av. Amazonas N24-03 y Colón',
      hours: 'Lun-Sáb · 10:00 a 20:00' },
    { code: 'NORTE', name: 'Delux Norte', city: 'Quito', address: 'C.C. Quicentro Shopping',
      hours: 'Lun-Dom · 10:00 a 21:00' },
    { code: 'CUENCA', name: 'Delux Cuenca', city: 'Cuenca', address: 'Av. Solano 5-23',
      hours: 'Lun-Sáb · 10:00 a 19:00' },
  ];
}
