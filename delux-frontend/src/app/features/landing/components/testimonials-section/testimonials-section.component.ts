import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'dlx-testimonials-section',
  standalone: true,
  imports: [CommonModule, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-32
                    border-y border-ink-200 dark:border-white/10
                    bg-ink-25 dark:bg-ink-900">
      <div class="text-center max-w-3xl mx-auto mb-20 reveal" dlxReveal>
        <p class="eyebrow justify-center">/ 05 — Comunidad</p>
        <h2 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
          Voces<br/>
          <span class="italic font-normal text-ink-400 dark:text-white/60">de la comunidad.</span>
        </h2>
      </div>

      <div class="grid md:grid-cols-3 gap-px bg-ink-200 dark:bg-white/10 reveal-stagger" dlxReveal>
        @for (t of testimonials; track t.name; let i = $index) {
          <figure class="bg-white dark:bg-ink-950 p-10 md:p-12 hover:bg-ink-50 dark:hover:bg-ink-900 transition group">
            <div class="flex items-center justify-between mb-8">
              <span class="font-mono text-[10px] tracking-widest text-ink-400 dark:text-white/30">/{{ i + 1 }}</span>
              <div class="flex gap-0.5 text-accent-500 dark:text-accent-400">
                @for (s of stars; track s) { <i class="fa-solid fa-star text-[10px]"></i> }
              </div>
            </div>
            <blockquote class="text-ink-800 dark:text-white/90 leading-relaxed text-lg md:text-xl
                                font-display font-light italic">
              "{{ t.quote }}"
            </blockquote>
            <figcaption class="mt-8 flex items-center gap-4 pt-6 border-t border-ink-200 dark:border-white/10">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand-violet to-accent-400
                          grid place-items-center font-bold text-white">{{ t.initials }}</div>
              <div>
                <p class="font-semibold text-sm text-ink-950 dark:text-white">{{ t.name }}</p>
                <p class="text-xs text-ink-500 dark:text-white/40 tracking-wide uppercase mt-0.5">{{ t.role }}</p>
              </div>
            </figcaption>
          </figure>
        }
      </div>
    </section>
  `,
})
export class TestimonialsSectionComponent {
  readonly stars = [0, 1, 2, 3, 4];
  readonly testimonials = [
    { name: 'María Solís',  initials: 'MS', role: 'Cliente · Quito',
      quote: 'Pedí mis zapatillas un viernes y las tenía el sábado. Envío impecable y producto 100% original.' },
    { name: 'Andrés Vera',  initials: 'AV', role: 'Cliente · Guayaquil',
      quote: 'La sucursal Norte tiene una atención increíble. Los drops aquí son los mejores de la ciudad.' },
    { name: 'Lucía Pérez',  initials: 'LP', role: 'Cliente · Cuenca',
      quote: 'Hice un cambio de talla en 5 minutos en tienda. Definitivamente mi nueva tienda favorita.' },
  ];
}
