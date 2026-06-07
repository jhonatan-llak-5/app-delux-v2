import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { CartService } from '@features/checkout/services/cart.service';
import { SearchOverlayComponent } from '@shared/components/search-overlay/search-overlay.component';

@Component({
  selector: 'dlx-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SearchOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="fixed top-0 inset-x-0 z-50 transition-all duration-500"
            [class.bg-white]="scrolled() && !theme.isDark()"
            [class.bg-ink-950]="scrolled() && theme.isDark()"
            [class.backdrop-blur-2xl]="scrolled()"
            [class.shadow-sm]="scrolled() && !theme.isDark()"
            [class.border-b]="scrolled()"
            [class.border-ink-200]="scrolled() && !theme.isDark()"
            [class.border-white/10]="scrolled() && theme.isDark()">
      <div class="max-w-[1600px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">

        <a routerLink="/" class="flex items-center gap-2.5 group">
          <div class="w-9 h-9 rounded-xl bg-ink-950 dark:bg-white grid place-items-center
                      font-display font-extrabold text-white dark:text-ink-950 text-base">D</div>
          <span class="hidden sm:inline font-display font-bold text-lg tracking-tight text-ink-950 dark:text-white">Delux</span>
        </a>

        <div class="hidden md:block">
          <div class="pill-nav">
            <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }"
               routerLinkActive="!bg-white dark:!bg-ink-950 !text-ink-950 dark:!text-white font-semibold shadow-md">Inicio</a>
            <a routerLink="/shop"
               routerLinkActive="!bg-white dark:!bg-ink-950 !text-ink-950 dark:!text-white font-semibold shadow-md">Shop</a>
            <a routerLink="/contact"
               routerLinkActive="!bg-white dark:!bg-ink-950 !text-ink-950 dark:!text-white font-semibold shadow-md">Contacto</a>
            <a routerLink="/tracking"
               routerLinkActive="!bg-white dark:!bg-ink-950 !text-ink-950 dark:!text-white font-semibold shadow-md">Rastrear</a>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button (click)="theme.toggle()"
                  class="w-10 h-10 grid place-items-center rounded-full
                         text-ink-600 dark:text-white/70
                         hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition"
                  [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
            <i class="fa-solid text-sm" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
          </button>
          <button (click)="searchOpen.set(true)"
                  class="w-10 h-10 grid place-items-center rounded-full
                         text-ink-600 dark:text-white/70
                         hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition" aria-label="Buscar">
            <i class="fa-solid fa-magnifying-glass text-sm"></i>
          </button>
          @if (hasToken) {
            <a routerLink="/account"
               class="hidden sm:grid w-10 h-10 place-items-center rounded-full
                      text-ink-600 dark:text-white/70
                      hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition" aria-label="Mi cuenta" title="Mi cuenta">
              <i class="fa-regular fa-user text-sm"></i>
            </a>
          } @else {
            <a routerLink="/auth/login"
               class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full
                      text-sm font-semibold
                      bg-ink-950 dark:bg-white text-white dark:text-ink-950
                      hover:bg-ink-800 dark:hover:bg-ink-100 transition" aria-label="Iniciar sesión">
              <i class="fa-solid fa-arrow-right-to-bracket text-xs"></i>
              <span>Iniciar sesión</span>
            </a>
          }
          <a routerLink="/cart" title="Carrito"
             class="relative w-10 h-10 grid place-items-center rounded-full
                    text-ink-600 dark:text-white/70
                    hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition" aria-label="Carrito">
            <i class="fa-solid fa-bag-shopping text-sm"></i>
            @if (cart.itemCount() > 0) {
              <span class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1.5 rounded-full bg-accent-400 text-ink-950
                           text-[10px] font-bold grid place-items-center ring-2 ring-white dark:ring-ink-950">{{ cart.itemCount() }}</span>
            }
          </a>
          <button (click)="toggle()" class="md:hidden w-10 h-10 grid place-items-center rounded-full
                                              text-ink-600 dark:text-white/70 hover:bg-ink-100 dark:hover:bg-white/10" aria-label="Menú">
            <i class="fa-solid" [class.fa-bars]="!open()" [class.fa-xmark]="open()"></i>
          </button>
        </div>
      </div>

      @if (open()) {
        <div class="md:hidden mx-6 mb-3 glass p-4 flex flex-col gap-1 animate-slide-down">
          <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }"
             routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold"
             (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm">Inicio</a>
          <a routerLink="/shop"
             routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold"
             (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm">Shop</a>
          <a routerLink="/contact"
             routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold"
             (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm">Contacto</a>
          <a routerLink="/tracking"
             routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold"
             (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm">Rastrear</a>
          @if (hasToken) {
            <a routerLink="/account" (click)="close()" class="btn-outline mt-2 w-full text-sm">
              <i class="fa-regular fa-user"></i> Mi cuenta
            </a>
          } @else {
            <a routerLink="/auth/login" (click)="close()" class="btn-accent mt-2 w-full text-sm">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión
            </a>
            <a routerLink="/auth/register" (click)="close()" class="btn-outline mt-1 w-full text-sm">
              Crear cuenta
            </a>
          }
        </div>
      }
    </header>

    @if (searchOpen()) {
      <dlx-search-overlay (close)="searchOpen.set(false)" />
    }
  `,
})
export class PublicNavbarComponent {
  theme = inject(ThemeService);
  cart = inject(CartService);
  searchOpen = signal(false);
  open = signal(false);
  scrolled = signal(false);

  get hasToken(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('dlx_access_token');
  }

  toggle() { this.open.update(v => !v); }
  close() { this.open.set(false); }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(typeof window !== 'undefined' && window.scrollY > 30);
  }
}
