import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-brands-marquee',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative py-20
                    border-y border-ink-200 dark:border-white/10
                    bg-ink-50 dark:bg-ink-950 overflow-hidden">
      <div class="text-center mb-10">
        <p class="eyebrow justify-center">Las marcas que amas</p>
      </div>
      <div class="overflow-hidden">
        <div class="flex gap-24 w-max animate-marquee">
          @for (b of doubled; track $index) {
            <span class="font-display font-bold text-4xl md:text-6xl
                         text-ink-300 dark:text-white/20
                         hover:text-ink-950 dark:hover:text-white
                         transition-all duration-500 tracking-tightest whitespace-nowrap select-none">
              {{ b }}
            </span>
          }
        </div>
      </div>
    </section>
  `,
})
export class BrandsMarqueeComponent {
  readonly brands = ['NIKE', 'ADIDAS', 'PUMA', 'NEW BALANCE', 'VANS', 'CONVERSE', 'JORDAN', 'REEBOK', 'ASICS', 'UNDER ARMOUR'];
  readonly doubled = [...this.brands, ...this.brands];
}
