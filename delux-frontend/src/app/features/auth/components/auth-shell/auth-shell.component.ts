import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BrandingService } from '@core/services/branding.service';

/**
 * AuthShell — Hero visual izq + form clean derecho (estilo Instagram exacto).
 * Sin card, sin decoraciones. Solo back arrow + título + form.
 */
@Component({
  selector: 'dlx-auth-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-white dark:bg-slate-950 transition-colors">

      <!-- ───── PANEL IZQUIERDO (hero visual) ───── -->
      <aside class="hidden lg:block relative w-[55%] overflow-hidden bg-[#0a0d14]">

        <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1600&q=90&auto=format&fit=crop"
             alt="Delux streetwear"
             class="absolute inset-0 w-full h-full object-cover"
             crossorigin="anonymous" />

        <div class="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/55 to-black/25"></div>

        <div class="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full
                    bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]
                    blur-3xl opacity-40 pointer-events-none"></div>

        <div class="relative h-full flex flex-col justify-between p-12 xl:p-16 text-white">

          <a routerLink="/" class="flex items-center w-fit">
            <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()"
                 class="h-9 w-auto max-w-[200px] object-contain" />
          </a>

          <div class="max-w-xl">
            <h2 class="font-bold text-[44px] xl:text-[56px]
                       tracking-[-0.02em] leading-[1.05]">
              Vive el streetwear<br/>
              que define a tus<br/>
              <span class="ig-gradient-text">marcas favoritas.</span>
            </h2>
            <p class="text-white/70 text-[15px] mt-5 leading-relaxed max-w-md">
              Drops curados de Nike, Adidas, Jordan y más. Envío 24h en Ecuador.
            </p>
          </div>

          <div class="flex items-center justify-between text-[12px] text-white/50">
            <span>© 2026 {{ branding.siteName() }} · Quito, Ecuador</span>
            <div class="flex items-center gap-4">
              <a routerLink="/contact" class="hover:text-white transition">Ayuda</a>
              <a routerLink="/" class="hover:text-white transition">Privacidad</a>
            </div>
          </div>
        </div>
      </aside>

      <!-- ───── PANEL DERECHO (form clean) ───── -->
      <main class="flex-1 flex flex-col bg-white dark:bg-slate-950">

        <!-- Top bar mobile -->
        <header class="lg:hidden px-6 py-5 flex items-center justify-between
                       border-b border-ink-100 dark:border-white/[0.06]">
          <a routerLink="/" class="flex items-center">
            <img [src]="branding.logoUrl()" [alt]="branding.siteName()"
                 class="h-8 w-auto max-w-[170px] object-contain block dark:hidden" />
            <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()"
                 class="h-8 w-auto max-w-[170px] object-contain hidden dark:block" />
          </a>
        </header>

        <!-- Centro -->
        <div class="flex-1 flex items-center justify-center px-6 py-10">
          <div class="w-full max-w-[400px]">

            <!-- Título (Instagram — bold left-aligned) -->
            @if (title) {
              <h1 class="font-bold text-[22px] md:text-[24px]
                         tracking-[-0.015em] leading-tight
                         text-ink-950 dark:text-white mb-8">
                {{ title }}
              </h1>
            }

            <!-- Slot del form (inputs y botones sueltos, sin card) -->
            <ng-content />

            <!-- Slot del footer (otros botones, link aparte) -->
            <ng-content select="[footer]" />
          </div>
        </div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {
  protected readonly branding = inject(BrandingService);
  @Input() title = '';
  @Input() subtitle = '';
}
