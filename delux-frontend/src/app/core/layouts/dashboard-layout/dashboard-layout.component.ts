import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastHostComponent } from '@shared/components/toast-host/toast-host.component';
import { WebSocketService } from '@core/services/websocket.service';

interface NavItem { label: string; icon: string; route: string; badge?: string; }
interface NavGroup { title: string; items: NavItem[]; roles?: string[]; }

@Component({
  selector: 'dlx-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlx-dashboard min-h-screen flex">
      <aside class="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-slate-200">
        <div class="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-brand-violet
                      grid place-items-center font-display font-bold text-ink-950">D</div>
          <div>
            <p class="font-display font-bold text-lg leading-none">Delux</p>
            <p class="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{{ roleLabel() }}</p>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          @for (group of visibleGroups(); track group.title) {
            <div>
              <p class="px-3 text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
                {{ group.title }}
              </p>
              <ul class="space-y-0.5">
                @for (item of group.items; track item.label) {
                  <li>
                    <a [routerLink]="item.route"
                       routerLinkActive="bg-slate-900 text-white"
                       [routerLinkActiveOptions]="{ exact: false }"
                       class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                      <i class="fa-solid {{ item.icon }} w-4 text-center"></i>
                      <span class="flex-1">{{ item.label }}</span>
                      @if (item.badge) {
                        <span class="text-[10px] bg-accent-400 text-ink-950 font-bold px-1.5 py-0.5 rounded-md">
                          {{ item.badge }}
                        </span>
                      }
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </nav>

        <div class="border-t border-slate-200 p-3">
          <div class="w-full flex items-center gap-3 p-2 rounded-lg">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-brand-violet to-accent-400
                        grid place-items-center text-white font-bold text-sm">
              {{ initials() }}
            </div>
            <div class="text-left flex-1 overflow-hidden">
              <p class="text-sm font-semibold truncate">{{ userName() }}</p>
              <p class="text-[11px] text-slate-500 truncate">{{ roleLabel() }}</p>
            </div>
            <button (click)="logout()" class="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100" aria-label="Salir">
              <i class="fa-solid fa-right-from-bracket text-slate-500 text-sm"></i>
            </button>
          </div>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-3">
          <div class="flex-1 max-w-md relative">
            <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input placeholder="Buscar productos, pedidos, clientes..."
                   class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-transparent
                          focus:bg-white focus:border-slate-300 focus:outline-none text-sm" />
          </div>

          <button (click)="ws.markAllRead()"
                  class="relative w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100" aria-label="Notificaciones">
            <i class="fa-solid fa-bell text-slate-600 text-sm"></i>
            @if (ws.connected()) {
              <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" title="Conectado"></span>
            } @else {
              <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-slate-400 ring-2 ring-white" title="Desconectado"></span>
            }
            @if (ws.unreadCount() > 0) {
              <span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">
                {{ ws.unreadCount() }}
              </span>
            }
          </button>
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
  ws = inject(WebSocketService);

  userName = computed(() => this.auth.user()?.full_name ?? 'Usuario');
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

  logout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
