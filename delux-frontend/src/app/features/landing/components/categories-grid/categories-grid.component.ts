import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

interface Category { slug: string; name: string; caption: string; number: string; image: string; tint: string; }

@Component({
  selector: 'dlx-categories-grid',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-32
                    bg-white dark:bg-ink-950 transition-colors">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 reveal" dlxReveal>
        <div class="lg:col-span-7">
          <p class="eyebrow">/ 01 — Categorías</p>
          <h2 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
            Explora nuestras<br/>
            <span class="text-ink-400 dark:text-white/30">colecciones.</span>
          </h2>
        </div>
        <div class="lg:col-span-5 lg:flex lg:items-end">
          <p class="text-ink-700 dark:text-white/60 text-base md:text-lg leading-relaxed max-w-md">
            Desde sneakers de alta performance hasta accesorios de cultura urbana.
            Curamos cada pieza con un solo criterio: autenticidad.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 reveal-stagger" dlxReveal>
        @for (c of categories; track c.slug) {
          <a [routerLink]="['/shop']" [queryParams]="{ category: c.slug }"
             class="group relative overflow-hidden rounded-3xl aspect-[3/4]
                    border border-ink-200 dark:border-white/10
                    hover:border-ink-400 dark:hover:border-white/30 transition-all duration-700
                    shadow-sm dark:shadow-none hover:shadow-xl dark:hover:shadow-none">
            <img [src]="c.image" [alt]="c.name"
                 class="absolute inset-0 w-full h-full object-cover
                        group-hover:scale-110 transition-transform duration-1000"
                 loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
            <div class="absolute inset-0 mix-blend-multiply opacity-50 dark:opacity-60" [ngClass]="c.tint"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent
                        dark:from-ink-950 dark:via-ink-950/40"></div>

            <span class="absolute top-6 left-6 font-display font-bold text-7xl text-white/50
                         group-hover:text-white/80 transition-all duration-500">
              {{ c.number }}
            </span>

            <div class="absolute inset-x-0 bottom-0 p-6 flex items-end justify-between text-white">
              <div>
                <h3 class="display-xl font-bold text-2xl uppercase">{{ c.name }}</h3>
                <p class="text-xs text-white/70 mt-1.5 tracking-wide">{{ c.caption }}</p>
              </div>
              <span class="w-10 h-10 rounded-full border border-white/30 grid place-items-center
                           group-hover:bg-white group-hover:text-ink-950 group-hover:rotate-45
                           transition-all duration-500 shrink-0">
                <i class="fa-solid fa-arrow-up-right text-xs"></i>
              </span>
            </div>
          </a>
        }
      </div>
    </section>
  `,
})
export class CategoriesGridComponent {
  readonly categories: Category[] = [
    { slug: 'zapatillas', name: 'Zapatillas', caption: 'RUNNING · LIFESTYLE · SKATE', number: '01',
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=85&auto=format&fit=crop',
      tint: 'bg-gradient-to-br from-brand-magenta/30 to-brand-violet/30' },
    { slug: 'ropa', name: 'Ropa', caption: 'HOODIES · POLOS · PANTALONES', number: '02',
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=85&auto=format&fit=crop',
      tint: 'bg-gradient-to-br from-brand-orange/30 to-brand-magenta/30' },
    { slug: 'mochilas', name: 'Mochilas', caption: 'URBANA · DEPORTIVA · CASUAL', number: '03',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=85&auto=format&fit=crop',
      tint: 'bg-gradient-to-br from-accent-500/30 to-brand-violet/30' },
    { slug: 'accesorios', name: 'Accesorios', caption: 'MEDIAS · GORROS · CINTURONES', number: '04',
      image: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800&q=85&auto=format&fit=crop',
      tint: 'bg-gradient-to-br from-brand-teal/30 to-accent-500/30' },
  ];
  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23cbd5e1"/></svg>';
  }
}
