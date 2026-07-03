import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

interface Branch { id: string; name: string; city: string; address: string;
  hours: string; phone: string; image: string; tag: string; }

@Component({
  selector: 'dlx-branches-section',
  standalone: true,
  imports: [CommonModule, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="branches" class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-32
                                   bg-ink-25 dark:bg-ink-900">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 reveal" dlxReveal>
        <div class="lg:col-span-7">
          <p class="eyebrow">/ 04 — Sucursales</p>
          <h2 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
            Encuéntranos<br/>
            <span class="text-ink-400 dark:text-white/30">en tu ciudad.</span>
          </h2>
        </div>
        <div class="lg:col-span-5 lg:flex lg:items-end">
          <p class="text-ink-700 dark:text-white/60 leading-relaxed max-w-md">
            6 puntos de venta físicos en las principales ciudades del país.
            Retira sin costo, prueba antes de comprar, y vive la experiencia Delux en persona.
          </p>
        </div>
      </div>

      <div class="divide-y border-y border-ink-200 dark:border-white/10 reveal-stagger" dlxReveal>
        @for (b of branches; track b.id) {
          <article (mouseenter)="hovered.set(b.id)" (mouseleave)="hovered.set(null)"
                   class="group relative grid grid-cols-1 md:grid-cols-12 gap-6 py-8 md:py-12 transition-colors duration-300
                          border-ink-200 dark:border-white/10"
                   [class.bg-ink-50]="hovered() === b.id && !themeIsDark()"
                   [class.dark:bg-white/5]="hovered() === b.id">

            <div class="md:col-span-1">
              <span class="font-mono text-xs text-ink-500 dark:text-white/40 tracking-widest">/ {{ b.id }}</span>
            </div>

            <div class="md:col-span-5 space-y-3">
              <div class="flex items-center gap-3 flex-wrap">
                <h3 class="font-display font-bold text-3xl md:text-4xl uppercase tracking-tight
                           text-ink-950 dark:text-white">{{ b.name }}</h3>
                <span class="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold
                             bg-emerald-100 text-emerald-700
                             dark:bg-emerald-500/10 dark:text-emerald-400
                             flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                  Abierto
                </span>
              </div>
              <p class="text-ink-600 dark:text-white/60 text-sm">{{ b.city }} · {{ b.tag }}</p>
              <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-700 dark:text-white/70 pt-3">
                <span class="flex items-center gap-2">
                  <i class="fa-solid fa-location-dot text-accent-500 dark:text-accent-400 text-xs"></i>{{ b.address }}
                </span>
                <span class="flex items-center gap-2">
                  <i class="fa-solid fa-clock text-accent-500 dark:text-accent-400 text-xs"></i>{{ b.hours }}
                </span>
                <span class="flex items-center gap-2">
                  <i class="fa-solid fa-phone text-accent-500 dark:text-accent-400 text-xs"></i>{{ b.phone }}
                </span>
              </div>
            </div>

            <div class="md:col-span-4 relative aspect-[16/10] overflow-hidden rounded-2xl order-first md:order-none">
              <img [src]="b.image" [alt]="b.name"
                   class="absolute inset-0 w-full h-full object-cover
                          group-hover:scale-105 transition-transform duration-700"
                   loading="lazy" crossorigin="anonymous" (error)="onImgError($event)" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>

            <div class="md:col-span-2 flex md:justify-end md:items-center">
              <button class="btn-outline text-xs whitespace-nowrap">
                Cómo llegar <i class="fa-solid fa-arrow-up-right text-[10px]"></i>
              </button>
            </div>
          </article>
        }
      </div>
    </section>
  `,
})
export class BranchesSectionComponent {
  hovered = signal<string | null>(null);
  themeIsDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  readonly branches: Branch[] = [
    { id: '01', name: 'Delux Centro', city: 'Quito', tag: 'Flagship store',
      address: 'Av. Amazonas N24-03 y Colón',
      hours: 'Lun – Sáb · 10:00 a 20:00', phone: '+593 2 256 7890',
      image: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=900&q=85&auto=format&fit=crop' },
    { id: '02', name: 'Delux Norte', city: 'Quito', tag: 'Concept store',
      address: 'C.C. Quicentro Shopping · L 2-14',
      hours: 'Lun – Dom · 10:00 a 21:00', phone: '+593 2 290 4455',
      image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=900&q=85&auto=format&fit=crop' },
    { id: '03', name: 'Delux Mall', city: 'Guayaquil', tag: 'Sneaker bar',
      address: 'C.C. San Marino Shopping · L-128',
      hours: 'Lun – Dom · 10:00 a 22:00', phone: '+593 4 208 3344',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&q=85&auto=format&fit=crop' },
    { id: '04', name: 'Delux Cuenca', city: 'Cuenca', tag: 'Boutique store',
      address: 'Av. Solano 5-23 y Remigio Crespo',
      hours: 'Lun – Sáb · 10:00 a 19:00', phone: '+593 7 280 1122',
      image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=900&q=85&auto=format&fit=crop' },
    { id: '05', name: 'Delux Outlet', city: 'Quito', tag: 'Outlet · Hasta 60% off',
      address: 'C.C. Condado Shopping · Local 56',
      hours: 'Lun – Dom · 10:00 a 21:00', phone: '+593 2 380 5566',
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=85&auto=format&fit=crop' },
    { id: '06', name: 'Delux Manta', city: 'Manta', tag: 'Beach concept',
      address: 'C.C. Mall del Pacífico · L-78',
      hours: 'Lun – Dom · 10:00 a 21:00', phone: '+593 5 262 9988',
      image: 'https://images.unsplash.com/photo-1582539588230-a6c69a7c6f54?w=900&q=85&auto=format&fit=crop' },
  ];

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><rect width="400" height="250" fill="%23cbd5e1"/></svg>';
  }
}
