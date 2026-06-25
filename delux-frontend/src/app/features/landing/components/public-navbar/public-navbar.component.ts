import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { BrandingService } from '@core/services/branding.service';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/checkout/services/cart.service';
import { SearchOverlayComponent } from '@shared/components/search-overlay/search-overlay.component';
import { ZoneService } from '@shared/services/zone.service';

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
          @if (branding.logoUrl()) {
            <img [src]="branding.logoUrl()" [alt]="branding.siteName()"
                 class="h-9 w-auto max-w-[170px] object-contain rounded-xl block dark:hidden" />
            <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()"
                 class="h-9 w-auto max-w-[170px] object-contain rounded-xl hidden dark:block" />
          } @else {
            <div class="w-9 h-9 rounded-xl bg-ink-950 dark:bg-white grid place-items-center
                        font-display font-extrabold text-white dark:text-ink-950 text-base">
              {{ branding.siteName().charAt(0) }}
            </div>
            <span class="hidden sm:inline font-display font-bold text-lg tracking-tight text-ink-950 dark:text-white">{{ branding.siteName() }}</span>
          }
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
          <button (click)="zone.openPicker()" title="Cambiar ciudad"
                  class="mr-1 h-10 px-3 rounded-full hidden md:inline-flex items-center gap-2
                         text-ink-700 dark:text-white/80 text-sm font-semibold
                         bg-ink-100 dark:bg-white/10
                         hover:bg-ink-200 dark:hover:bg-white/15 transition">
            <i class="fa-solid fa-location-dot text-[#0095f6]"></i>
            <span class="hidden sm:inline max-w-[120px] truncate">{{ zone.city() || 'Elige ciudad' }}</span>
            <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i>
          </button>
          <button (click)="theme.toggle()"
                  class="w-10 h-10 hidden md:grid place-items-center rounded-full
                         text-ink-600 dark:text-white/70
                         hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition"
                  [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
            <i class="fa-solid text-sm" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
          </button>
          <button (click)="searchOpen.set(true)"
                  class="w-10 h-10 hidden md:grid place-items-center rounded-full
                         text-ink-600 dark:text-white/70
                         hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-900 dark:hover:text-white transition" aria-label="Buscar">
            <i class="fa-solid fa-magnifying-glass text-sm"></i>
          </button>
          @if (hasToken) {
            <div class="hidden sm:block relative" #accountDropdown>
              <button (click)="accountOpen.set(!accountOpen())"
                      class="w-10 h-10 grid place-items-center rounded-full
                             bg-gradient-to-br from-[#0095f6] to-[#1877f2]
                             text-white text-xs font-bold
                             hover:scale-105 transition"
                      aria-label="Mi cuenta">
                {{ initials() }}
              </button>
              @if (accountOpen()) {
                <div class="absolute right-0 top-full mt-2 w-60 rounded-xl overflow-hidden
                            bg-white dark:bg-[#161a26]
                            border border-ink-200 dark:border-white/[0.08]
                            shadow-xl animate-slide-down z-50">
                  <div class="p-3 border-b border-ink-100 dark:border-white/[0.08]">
                    <p class="font-bold text-sm text-ink-950 dark:text-white truncate">{{ userName() }}</p>
                    <p class="text-xs text-ink-500 dark:text-white/55 truncate">{{ userEmail() }}</p>
                    @if (isStaff()) {
                      <span class="inline-block mt-2 px-2 py-0.5 rounded-md bg-[#0095f6]/10 text-[#0095f6] text-[10px] font-bold uppercase tracking-wider">
                        {{ roleLabel() }}
                      </span>
                    }
                  </div>
                  <div class="p-1">
                    @if (isStaff()) {
                      <a routerLink="/app/admin/overview" (click)="accountOpen.set(false)"
                         class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#0095f6] font-semibold
                                hover:bg-[#0095f6]/10 transition">
                        <i class="fa-solid fa-shield-halved w-4 text-center"></i>
                        Panel admin
                      </a>
                    }
                    <a routerLink="/account" (click)="accountOpen.set(false)"
                       class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                              text-ink-700 dark:text-white/80
                              hover:bg-ink-100 dark:hover:bg-white/[0.06] transition">
                      <i class="fa-regular fa-user w-4 text-center"></i>
                      Mi cuenta
                    </a>
                    <a routerLink="/account/orders" (click)="accountOpen.set(false)"
                       class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                              text-ink-700 dark:text-white/80
                              hover:bg-ink-100 dark:hover:bg-white/[0.06] transition">
                      <i class="fa-solid fa-receipt w-4 text-center"></i>
                      Mis compras
                    </a>
                  </div>
                  <div class="p-1 border-t border-ink-100 dark:border-white/[0.08]">
                    <button (click)="logout()"
                            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold
                                   text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition">
                      <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              }
            </div>
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
            <i class="fa-solid fa-bag-shopping text-[15px]"></i>
            @if (cart.itemCount() > 0) {
              <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
                           bg-[#0095f6] text-white text-[11px] font-bold leading-none
                           grid place-items-center ring-2 ring-white dark:ring-slate-950
                           animate-pulse">
                {{ cart.itemCount() > 99 ? '99+' : cart.itemCount() }}
              </span>
            }
          </a>
          <button (click)="toggle()" class="md:hidden w-10 h-10 grid place-items-center rounded-full
                                              text-ink-600 dark:text-white/70 hover:bg-ink-100 dark:hover:bg-white/10" aria-label="Menú">
            <i class="fa-solid" [class.fa-bars]="!open()" [class.fa-xmark]="open()"></i>
          </button>
        </div>
      </div>

    </header>

      @if (open()) {
        <div class="md:hidden fixed inset-0 z-[60]">
          <div class="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" (click)="close()"></div>
          <aside class="absolute right-0 top-0 h-full w-72 max-w-[84vw] flex flex-col
                        bg-white dark:bg-[#0f172a] border-l border-ink-200 dark:border-white/10
                        shadow-2xl animate-slide-in-right">
            <div class="h-16 flex items-center justify-between px-4 border-b border-ink-100 dark:border-white/10 shrink-0">
              <span class="font-display font-bold text-lg text-ink-950 dark:text-white truncate">{{ branding.siteName() }}</span>
              <button (click)="close()" aria-label="Cerrar"
                      class="w-9 h-9 grid place-items-center rounded-lg text-ink-500 dark:text-white/60 hover:bg-ink-100 dark:hover:bg-white/10">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              <button (click)="zone.openPicker(); close()"
                      class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-ink-800 dark:text-white/85 hover:bg-ink-100 dark:hover:bg-white/10">
                <i class="fa-solid fa-location-dot text-[#0095f6] w-4 text-center"></i>
                <span class="flex-1 text-left truncate">{{ zone.city() || 'Elige tu ciudad' }}</span>
                <i class="fa-solid fa-chevron-right text-[10px] opacity-40"></i>
              </button>
              <button (click)="searchOpen.set(true); close()"
                      class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-ink-800 dark:text-white/85 hover:bg-ink-100 dark:hover:bg-white/10">
                <i class="fa-solid fa-magnifying-glass w-4 text-center"></i>
                <span class="flex-1 text-left">Buscar</span>
              </button>
              <button (click)="theme.toggle()"
                      class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-ink-800 dark:text-white/85 hover:bg-ink-100 dark:hover:bg-white/10">
                <i class="fa-solid w-4 text-center" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
                <span class="flex-1 text-left">{{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}</span>
              </button>
              <div class="my-2 h-px bg-ink-100 dark:bg-white/10"></div>
              <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold" (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm text-ink-800 dark:text-white/85">Inicio</a>
              <a routerLink="/shop" routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold" (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm text-ink-800 dark:text-white/85">Shop</a>
              <a routerLink="/contact" routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold" (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm text-ink-800 dark:text-white/85">Contacto</a>
              <a routerLink="/tracking" routerLinkActive="!bg-ink-950 dark:!bg-white !text-white dark:!text-ink-950 font-semibold" (click)="close()" class="px-4 py-3 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-sm text-ink-800 dark:text-white/85">Rastrear</a>
            </div>
            <div class="p-4 border-t border-ink-100 dark:border-white/10 shrink-0">
              @if (hasToken) {
                @if (isStaff()) {
                  <a routerLink="/app/admin/overview" (click)="close()" class="btn-accent w-full text-sm mb-2">
                    <i class="fa-solid fa-shield-halved"></i> Panel admin
                  </a>
                }
                <a routerLink="/account" (click)="close()" class="btn-outline w-full text-sm">
                  <i class="fa-regular fa-user"></i> Mi cuenta
                </a>
              } @else {
                <a routerLink="/auth/login" (click)="close()" class="btn-accent w-full text-sm mb-2">
                  <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión
                </a>
                <a routerLink="/auth/register" (click)="close()" class="btn-outline w-full text-sm">
                  Crear cuenta
                </a>
              }
            </div>
          </aside>
        </div>
      }

    @if (searchOpen()) {
      <dlx-search-overlay (close)="searchOpen.set(false)" />
    }
  `,
})
export class PublicNavbarComponent {
  private readonly STAFF_ROLES = ['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'SALESPERSON'];

  theme = inject(ThemeService);
  cart = inject(CartService);
  zone = inject(ZoneService);
  branding = inject(BrandingService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject(ElementRef);

  searchOpen = signal(false);
  open = signal(false);
  accountOpen = signal(false);
  scrolled = signal(false);

  userName  = computed(() => this.auth.user()?.full_name ?? 'Usuario');
  userEmail = computed(() => this.auth.user()?.email ?? '');
  initials  = computed(() => {
    const n = this.userName();
    return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'U';
  });
  isStaff = computed(() => {
    const r = this.auth.user()?.role;
    return !!r && this.STAFF_ROLES.includes(r);
  });
  roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return ({
      SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin tienda',
      BRANCH_MANAGER: 'Gerente sucursal', SALESPERSON: 'Vendedor',
    } as Record<string, string>)[r ?? ''] ?? 'Cliente';
  });

  get hasToken(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('dlx_access_token');
  }

  toggle() { this.open.update(v => !v); this.lockScroll(this.open()); }
  close() { this.open.set(false); this.lockScroll(false); }
  private lockScroll(on: boolean) {
    if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : '';
  }

  logout() {
    this.accountOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/']);
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(typeof window !== 'undefined' && window.scrollY > 30);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.accountOpen()) return;
    const el = this.host.nativeElement as HTMLElement;
    if (!el.contains(ev.target as Node)) this.accountOpen.set(false);
  }
}
