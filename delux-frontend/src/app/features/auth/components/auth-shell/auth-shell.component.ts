import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dlx-auth-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-white dark:bg-ink-950">
      <!-- Panel izquierdo: branding visual (oculto en mobile) -->
      <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden
                  bg-gradient-to-br from-ink-950 via-ink-900 to-brand-violet
                  text-white p-12 flex-col justify-between">

        <!-- Halos animados -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-accent-400/30 blur-3xl animate-halo-pulse"></div>
          <div class="absolute bottom-1/4 -right-20 w-[500px] h-[500px] rounded-full bg-brand-magenta/30 blur-3xl animate-halo-pulse" style="animation-delay:2s"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-brand-orange/10 blur-3xl"></div>
        </div>

        <!-- Grid pattern overlay -->
        <div class="absolute inset-0 grid-pattern opacity-20"></div>

        <!-- Top: logo + back to home -->
        <div class="relative z-10 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-3 group">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-400 to-brand-violet grid place-items-center font-display font-bold text-ink-950 text-xl">D</div>
            <div>
              <p class="font-display font-bold text-2xl tracking-tight leading-none">Delux</p>
              <p class="text-[10px] tracking-[0.4em] uppercase text-white/50 mt-1">streetwear · ec</p>
            </div>
          </a>
          <a routerLink="/" class="text-xs uppercase tracking-widest text-white/60 hover:text-white transition flex items-center gap-1.5">
            <i class="fa-solid fa-arrow-left text-[10px]"></i>
            Volver al sitio
          </a>
        </div>

        <!-- Center: editorial copy -->
        <div class="relative z-10 max-w-md">
          <p class="font-mono text-[10px] tracking-[0.5em] uppercase text-accent-300 mb-6">/ EC · 2026</p>
          <h2 class="font-display font-extrabold tracking-[-0.04em] leading-[0.95] text-5xl md:text-6xl mb-6">
            Tu armario,<br/>
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 via-brand-magenta to-brand-orange">
              reinventado.
            </span>
          </h2>
          <p class="text-white/70 leading-relaxed text-base mb-8 max-w-sm">
            Drops exclusivos. Stock en vivo en sucursales. Envíos a todo el país.
            Únete a la nueva generación del streetwear premium.
          </p>

          <!-- Stats -->
          <div class="grid grid-cols-3 gap-4 max-w-md">
            <div>
              <p class="font-display font-bold text-3xl">120+</p>
              <p class="text-[10px] uppercase tracking-widest text-white/50 mt-1">Drops</p>
            </div>
            <div>
              <p class="font-display font-bold text-3xl">6</p>
              <p class="text-[10px] uppercase tracking-widest text-white/50 mt-1">Sucursales</p>
            </div>
            <div>
              <p class="font-display font-bold text-3xl">10K+</p>
              <p class="text-[10px] uppercase tracking-widest text-white/50 mt-1">Clientes</p>
            </div>
          </div>
        </div>

        <!-- Bottom: corners -->
        <div class="relative z-10 flex items-end justify-between text-[10px] font-mono tracking-widest uppercase text-white/40">
          <span>secure · ssl</span>
          <span>vol. 01</span>
        </div>
      </div>

      <!-- Panel derecho: formulario -->
      <div class="w-full lg:w-1/2 flex flex-col min-h-screen">
        <!-- Mobile logo bar -->
        <div class="lg:hidden flex items-center justify-between px-6 py-5 border-b border-ink-200 dark:border-white/10">
          <a routerLink="/" class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-brand-violet grid place-items-center font-display font-bold text-ink-950">D</div>
            <span class="font-display font-bold text-xl tracking-tight text-ink-950 dark:text-white">Delux</span>
          </a>
          <a routerLink="/" class="text-xs uppercase tracking-widest text-ink-500 dark:text-white/50 hover:text-ink-950 dark:hover:text-white">
            <i class="fa-solid fa-xmark text-base"></i>
          </a>
        </div>

        <!-- Form content centered -->
        <div class="flex-1 grid place-items-center p-6 md:p-10">
          <div class="w-full max-w-md">
            <div class="mb-8">
              <p class="font-mono text-[10px] tracking-[0.5em] uppercase text-ink-500 dark:text-white/50 mb-3">/ Acceso</p>
              <h1 class="font-display font-extrabold text-4xl md:text-5xl tracking-[-0.04em] text-ink-950 dark:text-white leading-[0.95]">
                {{ title }}
              </h1>
              @if (subtitle) {
                <p class="text-ink-700 dark:text-white/60 mt-3 leading-relaxed">{{ subtitle }}</p>
              }
            </div>

            <ng-content />

            <div class="mt-8 pt-6 border-t border-ink-200 dark:border-white/10">
              <ng-content select="[footer]" />
            </div>
          </div>
        </div>

        <!-- Footer minimal -->
        <div class="px-6 py-4 text-center text-[10px] font-mono uppercase tracking-widest text-ink-400 dark:text-white/30">
          © 2026 Delux · ecuador
        </div>
      </div>
    </div>
  `,
})
export class AuthShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
