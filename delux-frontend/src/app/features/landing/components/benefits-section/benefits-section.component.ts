import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

interface Benefit { icon: string; title: string; desc: string; number: string; }

@Component({
  selector: 'dlx-benefits-section',
  standalone: true,
  imports: [CommonModule, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-32
                    border-y border-ink-200 dark:border-white/10
                    bg-white dark:bg-ink-950">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div class="lg:col-span-4 reveal" dlxReveal>
          <p class="eyebrow">/ 03 — Beneficios</p>
          <h2 class="display-xl text-5xl md:text-6xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
            Diseñado<br/>para ti.
          </h2>
          <p class="text-ink-700 dark:text-white/60 leading-relaxed mt-6 max-w-sm">
            Más que una tienda. Una experiencia construida en torno a la confianza,
            la velocidad y los detalles que hacen la diferencia.
          </p>
        </div>

        <div class="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px
                    bg-ink-200 dark:bg-white/10 reveal-stagger" dlxReveal>
          @for (b of benefits; track b.title) {
            <div class="bg-white dark:bg-ink-950 p-8 md:p-10
                        hover:bg-ink-50 dark:hover:bg-ink-900 transition group">
              <div class="flex items-start justify-between mb-6">
                <div class="w-14 h-14 rounded-full
                            bg-accent-500/10 dark:bg-accent-400/10
                            text-accent-600 dark:text-accent-400
                            grid place-items-center
                            group-hover:bg-accent-500 dark:group-hover:bg-accent-400
                            group-hover:text-white dark:group-hover:text-ink-950 transition-all duration-500">
                  <i class="fa-solid {{ b.icon }} text-lg"></i>
                </div>
                <span class="font-mono text-[10px] tracking-widest text-ink-400 dark:text-white/30">{{ b.number }}</span>
              </div>
              <h3 class="font-display font-bold text-2xl text-ink-950 dark:text-white">{{ b.title }}</h3>
              <p class="text-ink-600 dark:text-white/50 text-sm mt-3 leading-relaxed">{{ b.desc }}</p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class BenefitsSectionComponent {
  readonly benefits: Benefit[] = [
    { number: '01', icon: 'fa-truck-fast',  title: 'Envío express',     desc: 'Recibe tu pedido en 24 a 72 horas en todo Ecuador con seguimiento en tiempo real.' },
    { number: '02', icon: 'fa-store',       title: 'Retiro en tienda',  desc: 'Recoge gratis en cualquiera de nuestras 6 sucursales y obtén tu drop el mismo día.' },
    { number: '03', icon: 'fa-rotate-left', title: 'Cambios fáciles',   desc: 'Tienes 14 días para cambiar tu producto sin preguntas ni costos adicionales.' },
    { number: '04', icon: 'fa-shield-halved', title: '100% originales', desc: 'Solo productos auténticos con garantía oficial de marca y certificado de autenticidad.' },
  ];
}
