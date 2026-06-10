import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { MeService, MeProfile } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-account-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1400px] mx-auto px-6 md:px-10 pt-32 pb-16 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Mi cuenta</p>
      <h1 class="display-xl text-4xl md:text-5xl mt-4 mb-12 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Hola, <span class="text-ink-500 dark:text-white/40">{{ profile()?.full_name?.split(' ')?.[0] || 'cliente' }}</span>
      </h1>

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside class="lg:sticky lg:top-24 self-start">
          <div class="editorial-card p-5">
            <div class="flex items-center gap-3 pb-4 border-b border-ink-200 dark:border-white/10">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#0095f6] to-[#1877f2] grid place-items-center text-white font-bold">
                {{ initials() }}
              </div>
              <div class="min-w-0">
                <p class="font-semibold truncate text-ink-950 dark:text-white">{{ profile()?.full_name || '—' }}</p>
                <p class="text-xs text-ink-500 dark:text-white/50 truncate">{{ profile()?.email }}</p>
              </div>
            </div>

            @if (profile()) {
              <div class="py-4 border-b border-ink-200 dark:border-white/10 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50 font-semibold">Órdenes</p>
                  <p class="font-bold text-ink-950 dark:text-white">{{ profile()!.total_orders }}</p>
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50 font-semibold">Gastado</p>
                  <p class="font-bold text-ink-950 dark:text-white">\${{ profile()!.total_spent }}</p>
                </div>
              </div>
            }

            <nav class="pt-4 space-y-1">
              @for (l of links; track l.path) {
                <a [routerLink]="l.path"
                   routerLinkActive="!bg-[#0095f6] !text-white !shadow-md !shadow-[#0095f6]/25"
                   [routerLinkActiveOptions]="{ exact: l.exact }"
                   class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold
                          text-ink-700 dark:text-white/70 hover:bg-ink-100 dark:hover:bg-white/5 transition">
                  <i class="fa-solid {{ l.icon }} w-4 text-center"></i>
                  <span class="flex-1">{{ l.label }}</span>
                </a>
              }
              <button (click)="logout()"
                      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold
                             text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition mt-3">
                <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
                <span>Salir</span>
              </button>
            </nav>
          </div>
        </aside>

        <main>
          <router-outlet />
        </main>
      </div>
    </section>
  `,
})
export class AccountShellComponent implements OnInit {
  private me = inject(MeService);
  private auth = inject(AuthService);
  private router = inject(Router);

  profile = signal<MeProfile | null>(null);

  readonly links = [
    { path: '/account/profile',   label: 'Perfil',      icon: 'fa-user',    exact: true },
    { path: '/account/addresses', label: 'Direcciones', icon: 'fa-location-dot', exact: true },
    { path: '/account/orders',    label: 'Mis compras', icon: 'fa-receipt', exact: true },
    { path: '/account/wishlist',  label: 'Favoritos',   icon: 'fa-heart',   exact: true },
  ];

  ngOnInit() {
    this.me.profile().subscribe(p => this.profile.set(p));
    // Cargar wishlist global para que el corazón aparezca pintado en otras páginas
    this.me.wishlist().subscribe();
  }

  initials() {
    const n = this.profile()?.full_name || '';
    return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
