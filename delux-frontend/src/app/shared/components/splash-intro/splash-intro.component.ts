import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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
          DELUX / 2026
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
          <div class="relative">
            <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent-400 to-brand-violet
                        blur-3xl opacity-70 animate-halo-pulse scale-150"></div>
            <div class="relative w-32 h-32 md:w-36 md:h-36 rounded-3xl
                        bg-gradient-to-br from-accent-400 via-brand-violet to-brand-magenta
                        grid place-items-center font-display font-extrabold
                        text-ink-950 text-7xl md:text-8xl animate-splash-logo">D</div>
          </div>
          <div class="font-display font-bold text-4xl md:text-5xl tracking-tight
                      text-ink-950 dark:text-white animate-splash-text">Delux</div>
          <div class="w-24 h-px bg-ink-300 dark:bg-white/30 animate-fade-in-slow"></div>
          <p class="text-[10px] md:text-xs uppercase tracking-[0.5em] font-semibold
                    text-ink-600 dark:text-white/60 animate-fade-in-slow">
            Sneakers · Ropa · Mochilas
          </p>
        </div>
      </div>
    }
  `,
})
export class SplashIntroComponent implements OnInit {
  visible = signal(false);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    // Mostrar SIEMPRE — cada vez que se carga la app
    this.visible.set(true);
    setTimeout(() => this.visible.set(false), 3200);
  }
}
