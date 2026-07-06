import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, HostListener, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AdminService } from '@features/superadmin/services/admin.service';
import { NotifyService } from '@shared/services/notify.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastHostComponent } from '@shared/components/toast-host/toast-host.component';
import { WebSocketService } from '@core/services/websocket.service';
import { DlxNotificationsBellComponent } from '@shared/ui';
import { AppTourComponent } from '@shared/components/app-tour/app-tour.component';
import { TourService } from '@shared/components/app-tour/tour.service';
import { BrandingService } from '@core/services/branding.service';
import { BranchContextService } from '@core/services/branch-context.service';

interface NavItem { label: string; icon: string; route: string; badge?: string; only?: string[]; exact?: boolean; }
interface NavGroup { title: string; items: NavItem[]; roles?: string[]; }

const COLLAPSED_KEY = 'dlx_sidebar_collapsed';

@Component({
  selector: 'dlx-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastHostComponent, DlxNotificationsBellComponent, AppTourComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-layout.component.html',
})
export class DashboardLayoutComponent implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private adminSvc = inject(AdminService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private host = inject(ElementRef);
  private tour = inject(TourService);
  branding = inject(BrandingService);
  branchCtx = inject(BranchContextService);
  branchOpen = signal(false);
  theme = inject(ThemeService);
  ws = inject(WebSocketService);
  isFullscreen = signal(false);
  private fsHandler = () => {
    this.isFullscreen.set(typeof document !== 'undefined' && !!document.fullscreenElement);
  };
  toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        const el: any = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
      } else {
        (document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen)?.call(document);
      }
    } catch { /* fullscreen no disponible */ }
  }
  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', this.fsHandler);
  }

  constructor() {
    // Color principal por rol: rosa para clientes, azul para el resto.
    effect(() => this.applyRoleTheme(this.auth.user()?.role));
    this.branchCtx.load();
    // En móvil/tablet: abrir el drawer cuando el tour muestra el menú.
    effect(() => {
      if (!this.tour.active()) return;
      if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
      const step = this.tour.current();
      const inMenu = !!step?.target && (step.target.includes('"nav-') || step.target.includes('"sidebar"'));
      this.mobileOpen.set(inMenu);
    });
  }

  pickBranch(id: number | null): void {
    this.branchCtx.setBranch(id);
    this.branchOpen.set(false);
  }

  private applyRoleTheme(role?: string | null): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (role === 'CUSTOMER') {
      root.style.setProperty('--dash-primary', '#ec4899');
      root.style.setProperty('--dash-primary-d', '#db2777');
      root.style.setProperty('--dash-primary-l', '#fce7f3');
    } else {
      root.style.removeProperty('--dash-primary');
      root.style.removeProperty('--dash-primary-d');
      root.style.removeProperty('--dash-primary-l');
    }
  }

  ngAfterViewInit(): void {
    if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', this.fsHandler);
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

  /** Clicks de navegación: el item "Kiosko" abre el kiosko de la sucursal. */
  onNav(item: NavItem, mobile = false): void {
    if (mobile) this.closeMobile();
    if (item.route === '/kiosko') this.openKiosk();
  }

  /** Abre el kiosko de la sucursal del usuario (o la seleccionada) en una pestaña nueva. */
  openKiosk(): void {
    const branchId = this.auth.user()?.branch_id ?? this.branchCtx.current() ?? null;
    this.adminSvc.listBranches().subscribe({
      next: (r) => {
        const list = r.results || [];
        const b = (branchId != null ? list.find(x => x.id === branchId) : null) || list[0];
        if (b?.kiosk_token && typeof window !== 'undefined') {
          window.open('/kiosko/' + b.kiosk_token, '_blank');
        } else {
          this.notify.error('No se encontró el kiosko de la sucursal.');
        }
      },
      error: (e) => this.notify.fromServerError(e, 'No se pudo abrir el kiosko.'),
    });
  }

  collapsed = signal<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(COLLAPSED_KEY) === '1'
  );
  profileOpen = signal(false);
  mobileOpen = signal(false);

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

  isSuperadmin = computed(() => this.auth.user()?.role === 'SUPERADMIN');

  /** Distintivo (brand) que identifica el tipo de cuenta en el layout. */
  roleBadge = computed(() => {
    const r = this.auth.user()?.role ?? 'CUSTOMER';
    const map: Record<string, { label: string; icon: string; cls: string }> = {
      SUPERADMIN:     { label: 'Superadmin', icon: 'fa-crown',         cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
      TENANT_ADMIN:   { label: 'Admin',      icon: 'fa-shield-halved', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
      BRANCH_MANAGER: { label: 'Gerente',    icon: 'fa-user-tie',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
      SALESPERSON:    { label: 'Vendedor',   icon: 'fa-user-tag',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
      CUSTOMER:       { label: 'Cliente',    icon: 'fa-user',          cls: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300' },
    };
    return map[r] ?? map['CUSTOMER'];
  });
  initials = computed(() =>
    this.userName().split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  );

  readonly allGroups: NavGroup[] = [
    {
      title: 'Plataforma',
      roles: ['SUPERADMIN', 'TENANT_ADMIN'],
      items: [
        { label: 'Panel global',  icon: 'fa-shield-halved', route: '/app/admin/overview' },
        { label: 'Mi perfil',     icon: 'fa-id-card',        route: '/app/profile' },
        { label: 'Categorías',    icon: 'fa-folder-tree',    route: '/app/admin/categories' },
        { label: 'Marcas',        icon: 'fa-tags',           route: '/app/admin/brands' },
        { label: 'Proveedores',   icon: 'fa-truck-field',    route: '/app/admin/inventory/suppliers' },
        { label: 'Productos',     icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',    icon: 'fa-boxes-stacked',  route: '/app/admin/inventory', exact: true },
        { label: 'Recepción',     icon: 'fa-truck-ramp-box', route: '/app/admin/inventory/reception' },
        { label: 'Historial recep.', icon: 'fa-clock-rotate-left', route: '/app/admin/inventory/receptions' },
        { label: 'Cupones',       icon: 'fa-ticket',         route: '/app/admin/coupons' },
        { label: 'POS',           icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Ventas',        icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Envíos',        icon: 'fa-truck',          route: '/app/admin/shipments' },
        { label: 'Devoluciones',  icon: 'fa-rotate-left',    route: '/app/admin/returns' },
        { label: 'Reseñas',       icon: 'fa-comment-dots',   route: '/app/admin/reviews' },
        { label: 'Reportes',      icon: 'fa-chart-line',     route: '/app/admin/reports' },
        { label: 'Horarios',      icon: 'fa-clock',          route: '/app/admin/schedules' },
        { label: 'Usuarios',      icon: 'fa-users',          route: '/app/admin/users' },
        { label: 'Afiliados',     icon: 'fa-hand-holding-dollar', route: '/app/admin/affiliates' },
        { label: 'Nómina',        icon: 'fa-money-check-dollar', route: '/app/admin/payroll' },
        { label: 'Suscriptores',  icon: 'fa-envelope-open-text', route: '/app/admin/subscribers', only: ['SUPERADMIN','TENANT_ADMIN'] },
        { label: 'Tiendas',       icon: 'fa-store',          route: '/app/admin/tenants', only: ['SUPERADMIN'] },
        { label: 'Sucursales',    icon: 'fa-store',          route: '/app/admin/sucursales', only: ['SUPERADMIN'] },
        { label: 'Kiosko',        icon: 'fa-qrcode',         route: '/kiosko' },
        { label: 'Configuración', icon: 'fa-gear',           route: '/app/admin/settings' },
      ],
    },
    {
      title: 'Mi local',
      roles: ['BRANCH_MANAGER'],
      items: [
        { label: 'Panel',        icon: 'fa-gauge-high',     route: '/app/admin/overview' },
        { label: 'Usuarios',     icon: 'fa-users',          route: '/app/admin/users' },
        { label: 'Afiliados',    icon: 'fa-hand-holding-dollar', route: '/app/admin/affiliates' },
        { label: 'POS',          icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Ventas',       icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Productos',    icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',   icon: 'fa-boxes-stacked',  route: '/app/admin/inventory', exact: true },
        { label: 'Recepción',    icon: 'fa-truck-ramp-box', route: '/app/admin/inventory/reception' },
        { label: 'Historial recep.', icon: 'fa-clock-rotate-left', route: '/app/admin/inventory/receptions' },
        { label: 'Proveedores',   icon: 'fa-truck-field',    route: '/app/admin/inventory/suppliers' },
        { label: 'Kiosko',       icon: 'fa-qrcode',         route: '/kiosko' },
        { label: 'Envíos',       icon: 'fa-truck',          route: '/app/admin/shipments' },
        { label: 'Devoluciones', icon: 'fa-rotate-left',    route: '/app/admin/returns' },
        { label: 'Horarios',     icon: 'fa-clock',          route: '/app/admin/schedules' },
        { label: 'Reseñas',      icon: 'fa-comment-dots',   route: '/app/admin/reviews' },
        { label: 'Reportes',     icon: 'fa-chart-line',     route: '/app/admin/reports' },
        { label: 'Nómina',       icon: 'fa-money-check-dollar', route: '/app/admin/payroll' },
        { label: 'Mi perfil',    icon: 'fa-id-card',        route: '/app/profile' },
      ],
    },
    {
      title: 'Mi punto de venta',
      roles: ['SALESPERSON'],
      items: [
        { label: 'Mi panel',    icon: 'fa-gauge-high',     route: '/app/admin/seller', exact: true },
        { label: 'POS',         icon: 'fa-cash-register',  route: '/app/admin/pos' },
        { label: 'Mis ventas',  icon: 'fa-receipt',        route: '/app/admin/sales' },
        { label: 'Productos',   icon: 'fa-box',            route: '/app/admin/products' },
        { label: 'Inventario',  icon: 'fa-boxes-stacked',  route: '/app/admin/inventory', exact: true },
        { label: 'Afiliados',   icon: 'fa-hand-holding-dollar', route: '/app/admin/affiliates' },
        { label: 'Mi perfil',   icon: 'fa-id-card',        route: '/app/profile' },
      ],
    },
    {
      title: 'Afiliado',
      roles: ['AFFILIATE'],
      items: [
        { label: 'Panel de afiliado', icon: 'fa-hand-holding-dollar', route: '/app/affiliate', exact: true },
        { label: 'Mis comisiones',    icon: 'fa-hand-holding-dollar', route: '/app/affiliate/comisiones' },
        { label: 'Mis ventas',        icon: 'fa-box',                route: '/app/affiliate/ventas' },
        { label: 'Mis pagos',         icon: 'fa-money-check-dollar',  route: '/app/affiliate/pagos' },
        { label: 'Mi perfil',         icon: 'fa-id-card',            route: '/app/profile' },
      ],
    },
    {
      title: 'Mi cuenta',
      roles: ['CUSTOMER'],
      items: [
        { label: 'Mi perfil',     icon: 'fa-user',         route: '/app/account/profile' },
        { label: 'Mis compras',   icon: 'fa-receipt',      route: '/app/account/orders' },
        { label: 'Favoritos',     icon: 'fa-heart',        route: '/app/account/wishlist' },
        { label: 'Direcciones',   icon: 'fa-location-dot', route: '/app/account/addresses' },
        { label: 'Ir a la tienda',icon: 'fa-store',        route: '/', exact: true },
      ],
    },
  ];

  visibleGroups = computed(() => {
    const role = this.auth.user()?.role;
    return this.allGroups
      .filter(g => !g.roles || (role && g.roles.includes(role)))
      .map(g => ({
        ...g,
        items: g.items.filter(it =>
          // Visibilidad por item (rol) y Configuración exclusiva del superadmin.
          (!it.only || (role != null && it.only.includes(role))) &&
          (role === 'SUPERADMIN' || it.route !== '/app/admin/settings')
        ),
      }));
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
    if (this.auth.user()?.role === 'CUSTOMER') {
      this.router.navigate(['/shop'], { queryParams: { search: q } });
      return;
    }
    this.router.navigate(['/app/admin/products'], { queryParams: { search: q } });
  }

  /** En móvil abre el drawer; en desktop colapsa/expande el sidebar fijo. */
  headerMenuClick() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.mobileOpen.set(true);
      this.lockScroll(true);
    } else {
      this.toggleCollapse();
    }
  }

  closeMobile() { this.mobileOpen.set(false); this.lockScroll(false); }
  private lockScroll(on: boolean) {
    if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : '';
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
