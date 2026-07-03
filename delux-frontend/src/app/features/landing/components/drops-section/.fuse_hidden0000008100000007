import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

interface Drop {
  id: string; name: string; brand: string; price: number; oldPrice?: number;
  image: string; tag: 'Nuevo' | 'Drop' | 'Oferta' | 'Exclusivo';
}

@Component({
  selector: 'dlx-drops-section',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="drops" class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-32
                                bg-white dark:bg-ink-950">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 reveal" dlxReveal>
        <div class="lg:col-span-7">
          <p class="eyebrow text-brand-orange">
            <i class="fa-solid fa-fire text-xs"></i> / 02 — Drops
          </p>
          <h2 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
            Lo más<br/>
            <span class="italic font-normal text-ink-400 dark:text-white/60">codiciado.</span>
          </h2>
        </div>
        <div class="lg:col-span-5 lg:flex lg:items-end lg:justify-end">
          <a routerLink="/shop" class="btn-outline">
            Ver todos los drops <i class="fa-solid fa-arrow-up-right text-xs"></i>
          </a>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 reveal-stagger" dlxReveal>
        @for (d of drops; track d.id) {
          <article class="group relative editorial-card overflow-hidden hover:-translate-y-2
                          hover:shadow-xl dark:hover:shadow-editorial transition-all duration-500">
            <div class="relative aspect-[4/5] overflow-hidden
                        bg-ink-100 dark:bg-gradient-to-br dark:from-ink-800 dark:to-ink-900">
              <span class="absolute top-3 left-3 z-10 text-[9px] font-bold tracking-[0.2em]
                           uppercase px-2.5 py-1 rounded-full backdrop-blur-md"
                    [ngClass]="{
                      'bg-accent-400 text-ink-950': d.tag === 'Drop',
                      'bg-brand-magenta text-white': d.tag === 'Nuevo',
                      'bg-brand-orange text-white': d.tag === 'Oferta',
                      'bg-ink-950 text-white dark:bg-white dark:text-ink-950': d.tag === 'Exclusivo'
                    }">
                {{ d.tag }}
              </span>
              <button class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full
                             bg-white/80 dark:bg-white/10 backdrop-blur grid place-items-center
                             hover:bg-white dark:hover:bg-white/20 transition" aria-label="Wishlist">
                <i class="fa-regular fa-heart text-xs text-ink-700 dark:text-white"></i>
              </button>
              <img [src]="d.image" [alt]="d.name"
                   class="absolute inset-0 w-full h-full object-cover
                          group-hover:scale-110 transition-transform duration-700"
                   loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
              <div class="absolute inset-x-0 bottom-0 h-32
                          bg-gradient-to-t from-black/40 dark:from-ink-950/80 to-transparent"></div>
              <div class="absolute inset-x-0 bottom-0 p-3 translate-y-full
                          group-hover:translate-y-0 transition-transform duration-500 z-10">
                <button class="w-full bg-white text-ink-950 py-2.5 rounded-full font-semibold text-[10px]
                               uppercase tracking-widest hover:bg-accent-400 transition">
                  Quick add
                </button>
              </div>
            </div>
            <div class="p-4">
              <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500 dark:text-white/40">{{ d.brand }}</p>
              <h3 class="font-display font-bold text-base mt-1 truncate text-ink-950 dark:text-white">{{ d.name }}</h3>
              <div class="mt-2 flex items-end justify-between">
                <div class="flex items-baseline gap-2">
                  <span class="font-display text-lg font-bold text-ink-950 dark:text-white">\${{ d.price }}</span>
                  @if (d.oldPrice) {
                    <span class="text-xs text-ink-400 dark:text-white/40 line-through">\${{ d.oldPrice }}</span>
                  }
                </div>
                <button class="w-8 h-8 rounded-full bg-ink-100 dark:bg-white/10 grid place-items-center
                               hover:bg-accent-400 hover:text-ink-950 transition" aria-label="Agregar">
                  <i class="fa-solid fa-plus text-xs"></i>
                </button>
              </div>
            </div>
          </article>
        }
      </div>
    </section>
  `,
})
export class DropsSectionComponent {
  readonly drops: Drop[] = [
    { id: '1', name: 'Ultra Boost Light', brand: 'Adidas', price: 200, tag: 'Drop',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85&auto=format&fit=crop' },
    { id: '2', name: 'Air Max Plus', brand: 'Nike', price: 220, oldPrice: 260, tag: 'Oferta',
      image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&q=85&auto=format&fit=crop' },
    { id: '3', name: 'Samba OG', brand: 'Adidas', price: 160, tag: 'Nuevo',
      image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=85&auto=format&fit=crop' },
    { id: '4', name: 'Forum Low', brand: 'Adidas', price: 140, tag: 'Exclusivo',
      image: 'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=600&q=85&auto=format&fit=crop' },
    { id: '5', name: 'Hoodie Tech Fleece', brand: 'Nike', price: 95, tag: 'Nuevo',
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=85&auto=format&fit=crop' },
    { id: '6', name: 'Mochila Tech Pack', brand: 'Puma', price: 75, tag: 'Drop',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=85&auto=format&fit=crop' },
    { id: '7', name: '550 White', brand: 'New Balance', price: 130, tag: 'Nuevo',
      image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&q=85&auto=format&fit=crop' },
    { id: '8', name: 'Old Skool', brand: 'Vans', price: 85, oldPrice: 110, tag: 'Oferta',
      image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=85&auto=format&fit=crop' },
  ];
  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><rect width="200" height="250" fill="%23cbd5e1"/></svg>';
  }
}
