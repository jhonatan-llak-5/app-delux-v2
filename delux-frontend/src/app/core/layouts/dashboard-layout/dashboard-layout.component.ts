import { ChangeDetectionStrategy, Component, computed, inject, signal, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastHostComponent } from '@shared/components/toast-host/toast-host.component';
import { WebSocketService } from '@core/services/websocket.service';
import { DlxNotificationsBellComponent } from '@shared/ui';
import { AppTourComponent } from '@shared/components/app-tour/app-tour.component';
import { TourService } from '@shared/components/app-tour/tour.service';
import { BrandingService } from '@core/services/branding.service';

interface NavItem { label: string; icon: string; route: string; badge?: string; }
interface NavGroup { title: string; items: NavItem[]; roles?: string[]; }

const COLLAPSED_KEY = 'dlx_sidebar_collapsed';

@Component({
  selector: 'dlx-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent, DlxNotificationsBellComponent, AppTourComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlx-dashboard min-h-screen flex bg-[#f8fafc] dark:bg-[#020617] transition-colors">

      <!-- ═══════════ SIDEBAR (fijo, paleta MedicGet) ═══════════ -->
      <aside data-tour="sidebar"
             class="hidden lg:flex shrink-0 flex-col transition-all duration-300
                    bg-white dark:bg-[#0f172a] backdrop-blur-xl
                    border-r border-slate-200 dark:border-[#1e293b]
                    h-screen sticky top-0"
             [class.w-64]="!collapsed()"
             [class.w-20]="collapsed()">

        <div class="h-16 flex items-center gap-2.5 px-4 border-b border-slate-200 dark:border-[#1e293b] shrink-0">
          @if (branding.logoUrl()) {
            <img [src]="branding.logoUrl()" [alt]="branding.siteName()"
                 class="h-11 w-auto max-w-[230px] object-contain rounded-xl shrink-0 block dark:hidden" />
            <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()"
                 class="h-11 w-auto max-w-[230px] object-contain rounded-xl shrink-0 hidden dark:block" />
          } @else {
            <div class="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#1e3a8a]
                        grid place-items-center font-display font-bold text-white
                        shadow-md shadow-[#1e40af]/20">{{ branding.siteName().charAt(0) }}</div>
            @if (!collapsed()) {
              <div class="flex-1 min-w-0">
                <p class="font-display font-bold text-lg leading-none text-ink-950 dark:text-white truncate">{{ branding.siteName() }}</p>
                <p class="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mt-0.5 truncate">{{ roleLabel() }}</p>
              </div>
            }
          }
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          @for (group of visibleGroups(); track group.title) {
            <div>
              @if (!collapsed()) {
                <p class="px-3 text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/40 font-semibold mb-2">
                  {{ group.title }}
                </p>
              }
              <ul class="space-y-0.5">
                @for (item of group.items; track item.label) {
                  <li>
                    <a [routerLink]="item.route"
                       [attr.data-tour]="tourKey(item.route)"
                       routerLinkActive="!bg-[#1e40af]/8 !text-[#1e40af] dark:!bg-[#2563eb]/15 dark:!text-[#60a5fa] font-semibold !border-l-[3px] !border-[#1e40af] dark:!border-[#3b82f6]"
                       [routerLinkActiveOptions]="{ exact: false }"
                       [title]="collapsed() ? item.label : ''"
                       class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                              border-l-[3px] border-transparent
                              text-slate-600 dark:text-white/70
                              hover:bg-slate-50 dark:hover:bg-white/5 hover:text-ink-950 dark:hover:text-white
                              transition-colors">
                      <i class="fa-solid {{ item.icon }} w-4 text-center shrink-0"></i>
                      @if (!collapsed()) {
                        <span class="flex-1 truncate">{{ item.label }}</span>
                        @if (item.badge) {
                          <span class="eg-badge eg-badge-brand">
                            {{ item.badge }}
                          </span>
                        }
                      }
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </nav>
      </aside>

      <!-- ═══════════ MAIN ═══════════ -->
      <div class="flex-1 flex flex-col min-w-0">

        <!-- Banner de impersonación -->
        @if (isImpersonating()) {
          <div class="h-11 shrink-0 sticky top-0 z-40 flex items-center justify-center gap-3 px-4
                      bg-amber-500 text-amber-950 text-sm font-medium">
            <i class="fa-solid fa-user-secret"></i>
            <span>Estás viendo como <b>{{ userName() }}</b> ({{ roleLabel() }})</span>
            <button (click)="exitImpersonation()"
                    class="ml-2 px-3 py-1 rounded-lg bg-amber-950 text-amber-50 text-xs font-semibold
                           hover:bg-amber-900 transition inline-flex items-center gap-1.5">
              <i class="fa-solid fa-arrow-left"></i> Volver a {{ impersonatorName() }}
            </button>
          </div>
        }

        <!-- Header -->
        <header class="h-16 sticky top-0 z-30 flex items-center px-4 md:px-6 gap-3
                       bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md
                       border-b border-slate-200 dark:border-[#1e293b]">

          <button (click)="toggleCollapse()"
                  class="w-10 h-10 grid place-items-center rounded-lg
                         text-slate-600 dark:text-white/70
                         hover:bg-slate-100 dark:hover:bg-white/10 hover:text-ink-950 dark:hover:text-white
                         transition" aria-label="Toggle sidebar" title="Colapsar/expandir">
            <i class="fa-solid" [class.fa-bars]="collapsed()" [class.fa-bars-staggered]="!collapsed()"></i>
          </button>

          <div data-tour="search" class="flex-1 max-w-md relative">
            <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2
                      text-slate-400 dark:text-white/40"></i>
            <input #searchBox placeholder="Buscar productos... (Enter)"
                   (keydown.enter)="runSearch(searchBox.value); searchBox.value=''"
                   class="w-full pl-9 pr-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-white/5
                          border border-transparent
                          text-sm text-ink-950 dark:text-white
                          placeholder:text-slate-400 dark:placeholder:text-white/40
                          focus:bg-white dark:focus:bg-ink-950
                          focus:border-slate-300 dark:focus:border-white/20
                          focus:outline-none transition" />
          </div>

          <div class="flex-1"></div>

          <!-- Theme toggle -->
          <button (click)="theme.toggle()" data-tour="theme"
                  class="w-10 h-10 grid place-items-center rounded-lg
                         text-slate-600 dark:text-white/70
                         hover:bg-slate-100 dark:hover:bg-white/10 hover:text-ink-950 dark:hover:text-white transition"
                  [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
            <i class="fa-solid" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
          </button>

          <!-- Notifications (componente reutilizable con dropdown) -->
          <span data-tour="notifications"><dlx-notifications-bell /></span>

          <!-- Avatar perfil + popup -->
          <div class="relative" data-tour="account" #profileDropdown>
            <button (click)="profileOpen.set(!profileOpen())"
                    class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full
                           hover:bg-slate-100 dark:hover:bg-white/10 transition">
              <div class="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-[#1e40af] to-[#3b82f6]
                          grid place-items-center text-white font-bold text-sm">
                {{ initials() }}
              </div>
              <div class="hidden sm:flex flex-col leading-none text-left">
                <span class="text-sm font-semibold text-ink-950 dark:text-white">{{ firstName() }}</span>
                <span class="text-[10px] text-slate-500 dark:text-white/50">{{ roleLabel() }}</span>
              </div>
              <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 dark:text-white/50 ml-1
                        transition-transform" [class.rotate-180]="profileOpen()"></i>
            </button>

            @if (profileOpen()) {
              <div class="absolute right-0 top-full mt-2 w-64
                          bg-white dark:bg-[#161a26]
                          border border-slate-200 dark:border-white/[0.07]
                          rounded-xl shadow-xl dark:shadow-2xl shadow-ink-950/10
                          overflow-hidden animate-slide-down z-40">

                <!-- Perfil header -->
                <div class="p-4 border-b border-slate-100 dark:border-white/10
                            bg-gradient-to-br from-slate-50 to-white dark:from-white/5 dark:to-transparent">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#1e40af] to-[#3b82f6]
                                grid place-items-center text-white font-bold">
                      {{ initials() }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-ink-950 dark:text-white truncate">{{ userName() }}</p>
                      <p class="text-xs text-slate-500 dark:text-white/50 truncate">{{ userEmail() }}</p>
                    </div>
                  </div>
                  <span class="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full
                               bg-accent-100 dark:bg-accent-500/20
                               text-accent-700 dark:text-accent-300 text-[10px] font-bold uppercase tracking-widest">
                    <i class="fa-solid fa-shield-halved"></i> {{ roleLabel() }}
                  </span>
                </div>

                <!-- Acciones -->
                <div class="p-2">
                  <a routerLink="/account" (click)="profileOpen.set(false)"
                     class="flex items-center gap-3 px-3 py-2.5 rounded-lg
                            text-sm text-slate-700 dark:text-white/80
                            hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <i class="fa-solid fa-user w-4 text-center text-slate-400 dark:text-white/40"></i>
                    Mi cuenta
                  </a>
                  <a routerLink="/app/admin/settings" (click)="profileOpen.set(false)"
                     class="flex items-center gap-3 px-3 py-2.5 rounded-lg
                            text-sm text-slate-700 dark:text-white/80
                            hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <i class="fa-solid fa-gear w-4 text-center text-slate-400 dark:text-white/40"></i>
                    Configuración
                  </a>
                  <button (click)="startTour()"
                     class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                            text-sm text-slate-700 dark:text-white/80
                            hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <i class="fa-solid fa-route w-4 text-center text-[#1e40af] dark:text-[#60a5fa]"></i>
                    Hacer tour del app
                  </button>
                  <a routerLink="/" (click)="profileOpen.set(false)"
                     class="flex items-center gap-3 px-3 py-2.5 rounded-lg
                            text-sm text-slate-700 dark:text-white/80
                            hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <i class="fa-solid fa-arrow-up-right-from-square w-4 text-center text-slate-400 dark:text-white/40"></i>
                    Ver sitio público
                  </a>
                </div>

                <div class="border-t border-slate-100 dark:border-white/10 p-2">
                  <button (click)="logout()"
                          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                 text-sm text-rose-600 dark:text-rose-400
                                 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition">
                    <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            }
          </div>
        </header>

        <main class="flex-1 overflow-y-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>

    <dlx-toast-host />
    <dlx-app-tour />
  `,
})
export class DashboardLayoutComponent implements AfterViewInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject(ElementRef);
  private tour = inject(TourService);
  branding = inject(BrandingService);
  theme = inject(ThemeService);
  ws = inject(WebSocketService);

  ngAfterViewInit(): void {
    // Auto-inicia el tour la primera vez (se guarda en localStorage).
    this.tour.maybeAutoStart();
  }

  /** Lanza el tour manualmente desde el menu de cuenta. */
  startTour(): void {
    this.profileOpen.set(false);
    setTimeout(() => this.tour.start(), 120);
  }

  /** Clave de tour derivada de la ruta: /app/admin/products -> nav-products. */
  tourKey(route: string): string {
    const seg = route.split('/').filter(Boolean).pop() || 'item';
    return 'nav-' + seg;
  }

  collapsed = signal<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(COLLAPSED_KEY) === '1'
  );
  profileOpen = signal(false);

  userName = computed(() => this.auth.user()?.full_name ?? 'Usuario');
  userEmail = computed(() => this.auth.user()?.email ?? '');
  firstName = computed(() => this.userName().split(' ')[0]);
  roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return ({
      SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin Delux',
      BRANCH_MANAGER: 'Gerente Sucursal', SALESPERSON: 'Vendedor', CUSTOMER: 'Cliente',
    } as Record<string, string>)[r ?? ''] ?? 'Admin';
  });
  initials = computed(() =>
    this.userName().split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  );

  readonly allGroups: NavGroup[] = [
    {
      title: 'Plataforma',
      roles: ['SUPERADMIN'],
      items: [
        { label: 'Panel global',  icon: 'fa-shield-halved', route: '/app/admin/overview' },
        { label: 'Tiendas',       icon: 'fa-store',          route: '/app/admin/tenants' },
        { label: 'Marcas',        icon: 'fa-tags',           route: '/app/admin/brands' },
        { label: 'Categorías',    icon: 'fa-folder-tree',    route: '/app/admin/categories' },
        { label: 'Productos',     icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',    icon: 'fa-boxes-stacked',  route: '/app/admin/inventory' },
        { label: 'POS',           icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Ventas',        icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Equipo',        icon: 'fa-user-tie',       route: '/app/admin/staff' },
        { label: 'Horarios',      icon: 'fa-clock',          route: '/app/admin/schedules' },
        { label: 'Clientes',      icon: 'fa-user-group',     route: '/app/admin/customers' },
        { label: 'Cupones',       icon: 'fa-ticket',         route: '/app/admin/coupons' },
        { label: 'Reportes',      icon: 'fa-chart-line',     route: '/app/admin/reports' },
        { label: 'Reseñas',       icon: 'fa-comment-dots',   route: '/app/admin/reviews' },
        { label: 'Envíos',        icon: 'fa-truck',          route: '/app/admin/shipments' },
        { label: 'Devoluciones',  icon: 'fa-rotate-left',    route: '/app/admin/returns' },
        { label: 'Usuarios',      icon: 'fa-users',          route: '/app/admin/users' },
        { label: 'Configuración', icon: 'fa-gear',           route: '/app/admin/settings' },
      ],
    },
    {
      title: 'Mi local',
      roles: ['TENANT_ADMIN', 'BRANCH_MANAGER'],
      items: [
        { label: 'Panel',        icon: 'fa-gauge-high',     route: '/app/admin/overview' },
        { label: 'Productos',    icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',   icon: 'fa-boxes-stacked',  route: '/app/admin/inventory' },
        { label: 'POS',          icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Ventas',       icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Equipo',       icon: 'fa-user-tie',       route: '/app/admin/staff' },
        { label: 'Horarios',     icon: 'fa-clock',          route: '/app/admin/schedules' },
        { label: 'Clientes',     icon: 'fa-user-group',     route: '/app/admin/customers' },
        { label: 'Reportes',     icon: 'fa-chart-line',     route: '/app/admin/reports' },
        { label: 'Reseñas',      icon: 'fa-comment-dots',   route: '/app/admin/reviews' },
        { label: 'Envíos',       icon: 'fa-truck',          route: '/app/admin/shipments' },
        { label: 'Devoluciones', icon: 'fa-rotate-left',    route: '/app/admin/returns' },
      ],
    },
    {
      title: 'Mi punto de venta',
      roles: ['SALESPERSON'],
      items: [
        { label: 'POS',         icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Mis ventas',  icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Productos',   icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',  icon: 'fa-boxes-stacked',  route: '/app/admin/inventory' },
      ],
    },
  ];

  visibleGroups = computed(() => {
    const role = this.auth.user()?.role;
    return this.allGroups.filter(g => !g.roles || (role && g.roles.includes(role)));
  });

  // ── Impersonación
  isImpersonating = computed(() => this.auth.impersonating());
  impersonatorName = computed(() => this.auth.impersonator()?.name ?? 'mi cuenta');

  exitImpersonation(): void {
    this.auth.stopImpersonation();
    this.router.navigate(['/app/admin/users']);
  }

  runSearch(term: string): void {
    const q = (term || '').trim();
    if (!q) return;
    this.router.navigate(['/app/admin/products'], { queryParams: { search: q } });
  }

  toggleCollapse() {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    }
  }

  logout() {
    this.profileOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.profileOpen()) return;
    const target = ev.target as HTMLElement;
    // Cierra el dropdown solo si el click ocurrio fuera del contenedor del avatar.
    const account = (this.host.nativeElement as HTMLElement)
      .querySelector('[data-tour="account"]');
    if (account && !account.contains(target)) {
      this.profileOpen.set(false);
    }
  }
}
