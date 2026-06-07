import { ChangeDetectionStrategy, Component, computed, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastHostComponent } from '@shared/components/toast-host/toast-host.component';
import { WebSocketService } from '@core/services/websocket.service';

interface NavItem { label: string; icon: string; route: string; badge?: string; }
interface NavGroup { title: string; items: NavItem[]; roles?: string[]; }

const COLLAPSED_KEY = 'dlx_sidebar_collapsed';

@Component({
  selector: 'dlx-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlx-dashboard min-h-screen flex bg-slate-50 dark:bg-[#0f1320] transition-colors">

      <!-- ═══════════ SIDEBAR (fijo, paleta MedicGet) ═══════════ -->
      <aside class="hidden lg:flex shrink-0 flex-col transition-all duration-300
                    bg-white dark:bg-[#0a0d14] backdrop-blur-xl
                    border-r border-slate-200 dark:border-white/[0.07]
                    h-screen sticky top-0"
             [class.w-64]="!collapsed()"
             [class.w-20]="collapsed()">

        <div class="h-16 flex items-center gap-2.5 px-4 border-b border-slate-200 dark:border-white/[0.07] shrink-0">
          <div class="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-accent-400 to-brand-violet
                      grid place-items-center font-display font-bold text-ink-950
                      shadow-md shadow-brand-violet/30">D</div>
          @if (!collapsed()) {
            <div class="flex-1 min-w-0">
              <p class="font-display font-bold text-lg leading-none text-ink-950 dark:text-white truncate">Delux</p>
              <p class="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mt-0.5 truncate">{{ roleLabel() }}</p>
            </div>
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
                       routerLinkActive="!bg-gradient-to-r !from-accent-500 !to-brand-violet !text-white font-semibold shadow-md shadow-brand-violet/30"
                       [routerLinkActiveOptions]="{ exact: false }"
                       [title]="collapsed() ? item.label : ''"
                       class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                              text-slate-600 dark:text-white/70
                              hover:bg-slate-100 dark:hover:bg-white/5 hover:text-ink-950 dark:hover:text-white
                              transition">
                      <i class="fa-solid {{ item.icon }} w-4 text-center shrink-0"></i>
                      @if (!collapsed()) {
                        <span class="flex-1 truncate">{{ item.label }}</span>
                        @if (item.badge) {
                          <span class="text-[10px] bg-accent-400 text-ink-950 font-bold px-1.5 py-0.5 rounded-md">
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

        <!-- Header -->
        <header class="h-16 sticky top-0 z-30 flex items-center px-4 md:px-6 gap-3
                       bg-white dark:bg-[#0a0d14] backdrop-blur-xl
                       border-b border-slate-200 dark:border-white/[0.07]">

          <button (click)="toggleCollapse()"
                  class="w-10 h-10 grid place-items-center rounded-lg
                         text-slate-600 dark:text-white/70
                         hover:bg-slate-100 dark:hover:bg-white/10 hover:text-ink-950 dark:hover:text-white
                         transition" aria-label="Toggle sidebar" title="Colapsar/expandir">
            <i class="fa-solid" [class.fa-bars]="collapsed()" [class.fa-bars-staggered]="!collapsed()"></i>
          </button>

          <div class="flex-1 max-w-md relative">
            <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2
                      text-slate-400 dark:text-white/40"></i>
            <input placeholder="Buscar productos, pedidos, clientes..."
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
          <button (click)="theme.toggle()"
                  class="w-10 h-10 grid place-items-center rounded-lg
                         text-slate-600 dark:text-white/70
                         hover:bg-slate-100 dark:hover:bg-white/10 hover:text-ink-950 dark:hover:text-white transition"
                  [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
            <i class="fa-solid" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
          </button>

          <!-- Notifications -->
          <button (click)="ws.markAllRead()"
                  class="relative w-10 h-10 grid place-items-center rounded-lg
                         text-slate-600 dark:text-white/70
                         hover:bg-slate-100 dark:hover:bg-white/10 hover:text-ink-950 dark:hover:text-white transition" aria-label="Notificaciones">
            <i class="fa-solid fa-bell text-sm"></i>
            @if (ws.connected()) {
              <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500
                           ring-2 ring-white dark:ring-[#0a0d14]" title="Conectado"></span>
            } @else {
              <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-slate-400
                           ring-2 ring-white dark:ring-[#0a0d14]" title="Desconectado"></span>
            }
            @if (ws.unreadCount() > 0) {
              <span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white
                           text-[9px] font-bold grid place-items-center">
                {{ ws.unreadCount() }}
              </span>
            }
          </button>

          <!-- Avatar perfil + popup -->
          <div class="relative" #profileDropdown>
            <button (click)="profileOpen.set(!profileOpen())"
                    class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full
                           hover:bg-slate-100 dark:hover:bg-white/10 transition">
              <div class="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-brand-violet to-accent-400
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
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand-violet to-accent-400
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
  `,
})
export class DashboardLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject(ElementRef);
  theme = inject(ThemeService);
  ws = inject(WebSocketService);

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
  ];

  visibleGroups = computed(() => {
    const role = this.auth.user()?.role;
    return this.allGroups.filter(g => !g.roles || (role && g.roles.includes(role)));
  });

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
    if (!this.host.nativeElement.contains(target) || !target.closest('[\\#profileDropdown]')) {
      // Cerrar si click fuera del dropdown
      const dd = this.host.nativeElement.querySelector('[ng-reflect-name]')
              || this.host.nativeElement.querySelector('.relative');
      // Simple: cerrar si no se hizo click dentro del botón del avatar
      const avatar = (this.host.nativeElement as HTMLElement).querySelector('header .relative');
      if (avatar && !avatar.contains(target)) {
        this.profileOpen.set(false);
      }
    }
  }
}
