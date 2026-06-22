import { Injectable, computed, signal } from '@angular/core';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
  /** Selector del elemento a resaltar. `null` => paso centrado (sin spotlight). */
  target: string | null;
  title: string;
  body: string;
  placement?: TourPlacement;
  icon?: string;
}

const DONE_KEY = 'dlx_tour_done_v1';

/**
 * Servicio de onboarding/tour reutilizable.
 *
 * Los pasos se definen una sola vez; al iniciar, sólo se conservan los pasos
 * cuyo `target` existe en el DOM (o que no tienen target). Así el mismo tour
 * sirve para Superadmin, Admin, Gerente, Vendedor, etc.: cada rol ve los pasos
 * de los menús que efectivamente tiene visibles.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private _active = signal(false);
  private _index = signal(0);
  private _steps = signal<TourStep[]>([]);

  readonly active = computed(() => this._active());
  readonly index = computed(() => this._index());
  readonly steps = computed(() => this._steps());
  readonly total = computed(() => this._steps().length);
  readonly current = computed<TourStep | null>(() => this._steps()[this._index()] ?? null);
  readonly isFirst = computed(() => this._index() === 0);
  readonly isLast = computed(() => this._index() === this._steps().length - 1);

  /** Catálogo maestro de pasos (orden de recorrido). */
  private readonly catalog: TourStep[] = [
    {
      target: null, placement: 'center', icon: 'fa-rocket',
      title: '¡Bienvenido a Delux! 👋',
      body: 'Te damos un recorrido por el panel para que conozcas cada menú. Puedes salir cuando quieras y repetirlo desde tu menú de cuenta.',
    },
    {
      target: '[data-tour="sidebar"]', placement: 'right', icon: 'fa-compass',
      title: 'Menú de navegación',
      body: 'Desde aquí accedes a todos los módulos. Puedes colapsarlo con el botón ☰ para ganar espacio.',
    },
    {
      target: '[data-tour="nav-overview"]', placement: 'right', icon: 'fa-shield-halved',
      title: 'Panel global',
      body: 'Tu resumen ejecutivo: ventas del día, stock crítico, pedidos y métricas clave de toda la plataforma.',
    },
    {
      target: '[data-tour="nav-tenants"]', placement: 'right', icon: 'fa-store',
      title: 'Tiendas',
      body: 'Administra los tenants (tiendas) de la plataforma y sus sucursales: Quito, Guayaquil y Cuenca.',
    },
    {
      target: '[data-tour="nav-brands"]', placement: 'right', icon: 'fa-tags',
      title: 'Marcas',
      body: 'Crea y edita las marcas del catálogo (Nike, Adidas, Jordan…) con logo y descripción.',
    },
    {
      target: '[data-tour="nav-categories"]', placement: 'right', icon: 'fa-folder-tree',
      title: 'Categorías',
      body: 'Organiza el catálogo en categorías y subcategorías para que los clientes encuentren todo fácil.',
    },
    {
      target: '[data-tour="nav-products"]', placement: 'right', icon: 'fa-box',
      title: 'Productos',
      body: 'El corazón del catálogo: variantes (talla/color), precios, imágenes y estado de publicación.',
    },
    {
      target: '[data-tour="nav-inventory"]', placement: 'right', icon: 'fa-boxes-stacked',
      title: 'Inventario por sucursal',
      body: 'Controla el stock de cada tienda, ajustes manuales y transferencias entre sucursales.',
    },
    {
      target: '[data-tour="nav-pos"]', placement: 'right', icon: 'fa-cash-register',
      title: 'Punto de venta (POS)',
      body: 'Registra ventas en mostrador. Descuenta el stock de la sucursal en tiempo real.',
    },
    {
      target: '[data-tour="nav-sales"]', placement: 'right', icon: 'fa-receipt',
      title: 'Ventas',
      body: 'Historial de ventas online y en tienda, con su detalle, pagos y estado.',
    },
    {
      target: '[data-tour="nav-staff"]', placement: 'right', icon: 'fa-user-tie',
      title: 'Equipo',
      body: 'Gestiona al personal: gerentes de sucursal y vendedores, con sus roles y permisos.',
    },
    {
      target: '[data-tour="nav-schedules"]', placement: 'right', icon: 'fa-clock',
      title: 'Horarios',
      body: 'Define los horarios de atención de cada sucursal por día de la semana.',
    },
    {
      target: '[data-tour="nav-customers"]', placement: 'right', icon: 'fa-user-group',
      title: 'Clientes',
      body: 'Base de clientes con su historial de compras y datos de contacto.',
    },
    {
      target: '[data-tour="nav-coupons"]', placement: 'right', icon: 'fa-ticket',
      title: 'Cupones',
      body: 'Crea descuentos y promociones por porcentaje o monto, con vigencia y límites de uso.',
    },
    {
      target: '[data-tour="nav-reports"]', placement: 'right', icon: 'fa-chart-line',
      title: 'Reportes',
      body: 'Gráficas de ingresos, productos más vendidos y desempeño por sucursal para decidir mejor.',
    },
    {
      target: '[data-tour="nav-reviews"]', placement: 'right', icon: 'fa-comment-dots',
      title: 'Reseñas',
      body: 'Modera las reseñas y calificaciones que dejan los clientes en los productos.',
    },
    {
      target: '[data-tour="nav-shipments"]', placement: 'right', icon: 'fa-truck',
      title: 'Envíos',
      body: 'Sigue los despachos y su tracking en vivo, desde la sucursal hasta el cliente.',
    },
    {
      target: '[data-tour="nav-returns"]', placement: 'right', icon: 'fa-rotate-left',
      title: 'Devoluciones',
      body: 'Gestiona solicitudes de cambio y devolución, con su estado y reingreso a stock.',
    },
    {
      target: '[data-tour="nav-users"]', placement: 'right', icon: 'fa-users',
      title: 'Usuarios',
      body: 'Administra todas las cuentas de usuario de la plataforma y sus accesos.',
    },
    {
      target: '[data-tour="nav-settings"]', placement: 'right', icon: 'fa-gear',
      title: 'Configuración',
      body: 'Ajustes de la plataforma: branding, parámetros generales y preferencias.',
    },
    {
      target: '[data-tour="search"]', placement: 'bottom', icon: 'fa-magnifying-glass',
      title: 'Búsqueda rápida',
      body: 'Encuentra productos, pedidos o clientes al instante desde cualquier pantalla.',
    },
    {
      target: '[data-tour="theme"]', placement: 'bottom', icon: 'fa-circle-half-stroke',
      title: 'Modo claro / oscuro',
      body: 'Cambia el tema cuando quieras. Recordamos tu preferencia.',
    },
    {
      target: '[data-tour="notifications"]', placement: 'bottom', icon: 'fa-bell',
      title: 'Notificaciones',
      body: 'Avisos en vivo: nuevos pedidos, stock bajo y alertas importantes.',
    },
    {
      target: '[data-tour="account"]', placement: 'bottom', icon: 'fa-circle-user',
      title: 'Tu cuenta',
      body: 'Aquí ves tus datos, abres tu perfil, repites este tour y cierras sesión. ¡Listo para empezar! 🚀',
    },
  ];

  /** Inicia el tour, conservando sólo pasos aplicables al DOM actual. */
  start(): void {
    const applicable = this.catalog.filter(
      s => !s.target || (typeof document !== 'undefined' && !!document.querySelector(s.target))
    );
    if (!applicable.length) return;
    this._steps.set(applicable);
    this._index.set(0);
    this._active.set(true);
    this.lockScroll(true);
  }

  next(): void {
    if (this.isLast()) { this.finish(); return; }
    this._index.update(i => Math.min(i + 1, this._steps().length - 1));
  }

  prev(): void {
    this._index.update(i => Math.max(i - 1, 0));
  }

  goTo(i: number): void {
    if (i >= 0 && i < this._steps().length) this._index.set(i);
  }

  /** Cierra el tour y lo marca como completado. */
  finish(): void {
    this._active.set(false);
    this.lockScroll(false);
    this.markDone();
  }

  /** Cierra sin marcar (por si quieres reintentarlo luego). */
  skip(): void {
    this.finish();
  }

  /** Lanza el tour automáticamente la primera vez (tras login). */
  maybeAutoStart(delayMs = 600): void {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DONE_KEY) === '1') return;
    setTimeout(() => this.start(), delayMs);
  }

  resetSeen(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(DONE_KEY);
  }

  private markDone(): void {
    if (typeof window !== 'undefined') localStorage.setItem(DONE_KEY, '1');
  }

  private lockScroll(lock: boolean): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }
}
