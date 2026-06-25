import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '@core/services/branding.service';

const STORAGE_KEY = 'dlx_splash_seen';

@Component({
  selector: 'dlx-splash-intro',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-[100] grid place-items-center animate-splash-out overflow-hidden
                  bg-white dark:bg-ink-950"
           aria-hidden="true">
        <div class="absolute inset-0 bg-fluid-hero opacity-20 dark:opacity-25 blur-3xl animate-fluid-drift"></div>
        <div class="absolute inset-0 noise"></div>
        <div class="absolute inset-0 grid-pattern opacity-20"></div>

        <div class="absolute top-8 left-8 font-mono text-[10px] tracking-widest
                    text-ink-500 dark:text-white/40 animate-fade-in">
          {{ siteName().toUpperCase() }} / 2026
        </div>
        <div class="absolute top-8 right-8 font-mono text-[10px] tracking-widest
                    text-ink-500 dark:text-white/40 animate-fade-in">
          EC · 01
        </div>
        <div class="absolute bottom-8 left-8 font-mono text-[10px] tracking-widest
                    text-ink-500 dark:text-white/40 animate-fade-in">
          STREETWEAR PREMIUM
        </div>
        <div class="absolute bottom-8 right-8 font-mono text-[10px] tracking-widest
                    text-ink-500 dark:text-white/40 animate-fade-in">
          LOADING<span class="animate-pulse">...</span>
        </div>

        <div class="relative flex flex-col items-center gap-8">
          <div class="relative grid place-items-center animate-splash-logo">
            <div class="absolute inset-0 rounded-[40px] bg-gradient-to-br from-[#2E6FE6] to-[#D6001C]
                        blur-3xl opacity-40 dark:opacity-50 scale-125 animate-halo-pulse"></div>
            <img [src]="branding.logoUrl()" [alt]="siteName()"
                 class="relative h-24 md:h-28 w-auto max-w-[78vw] object-contain block dark:hidden" />
            <img [src]="branding.logoUrlDark()" [alt]="siteName()"
                 class="relative h-24 md:h-28 w-auto max-w-[78vw] object-contain hidden dark:block" />
          </div>
          <div class="w-24 h-px bg-ink-300 dark:bg-white/30 animate-fade-in-slow"></div>
          <p class="text-[10px] md:text-xs uppercase tracking-[0.5em] font-semibold
                    text-ink-600 dark:text-white/60 animate-fade-in-slow">
            {{ branding.tagline() || 'Sneakers · Ropa · Mochilas' }}
          </p>
        </div>
      </div>
    }
  `,
})
export class SplashIntroComponent implements OnInit {
  protected readonly branding = inject(BrandingService);
  protected readonly siteName = this.branding.siteName;
  visible = signal(false);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    // Solo mostrar la PRIMERA vez por sesión del navegador
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (seen) return;
    sessionStorage.setItem(STORAGE_KEY, '1');
    this.visible.set(true);
    setTimeout(() => this.visible.set(false), 3200);
  }
}
