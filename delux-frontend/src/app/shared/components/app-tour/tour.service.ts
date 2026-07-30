import { Injectable, computed, signal } from '@angular/core';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export function resolveTourEl(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const visible = els.find(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0);
  return visible || els[0] || null;
}

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
      target: '[data-tour="nav-users"]', placement: 'right', icon: 'fa-users',
      title: 'Usuarios',
      body: 'Tu módulo central de personas: el equipo interno (Sistema) y los clientes de la plataforma, con edición de datos, contraseñas y accesos.',
    },
    {
      target: '[data-tour="nav-tenants"]', placement: 'right', icon: 'fa-store',
      title: 'Tiendas',
      body: 'Administra los tenants (tiendas) de la plataforma y sus sucursales: Quito, Guayaquil y Cuenca.',
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
      title: 'Ventas',
      body: 'Registra ventas en mostrador y consulta el historial. Descuenta el stock de la sucursal en tiempo real.',
    },
    {
      target: '[data-tour="nav-sales"]', placement: 'right', icon: 'fa-receipt',
      title: 'Ventas',
      body: 'Historial de ventas online y en tienda, con su detalle, pagos y estado.',
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
      target: '[data-tour="nav-categories"]', placement: 'right', icon: 'fa-folder-tree',
      title: 'Categorías',
      body: 'Organiza el catálogo en categorías y subcategorías para que los clientes encuentren todo fácil.',
    },
    {
      target: '[data-tour="nav-brands"]', placement: 'right', icon: 'fa-tags',
      title: 'Marcas',
      body: 'Crea y edita las marcas del catálogo (Nike, Adidas, Jordan…) con logo y descripción.',
    },
    {
      target: '[data-tour="nav-coupons"]', placement: 'right', icon: 'fa-ticket',
      title: 'Cupones',
      body: 'Crea descuentos y promociones por porcentaje o monto, con vigencia y límites de uso.',
    },
    {
      target: '[data-tour="nav-schedules"]', placement: 'right', icon: 'fa-clock',
      title: 'Horarios',
      body: 'Define los horarios de atención de cada sucursal por día de la semana.',
    },
    {
      target: '[data-tour="nav-reviews"]', placement: 'right', icon: 'fa-comment-dots',
      title: 'Reseñas',
      body: 'Modera las reseñas y calificaciones que dejan los clientes en los productos.',
    },
    {
      target: '[data-tour="nav-reports"]', placement: 'right', icon: 'fa-chart-line',
      title: 'Reportes',
      body: 'Gráficas de ingresos, productos más vendidos y desempeño por sucursal para decidir mejor.',
    },
    {
      target: '[data-tour="nav-settings"]', placement: 'right', icon: 'fa-gear',
      title: 'Configuración',
      body: 'Ajustes de la plataforma: branding, parámetros generales y preferencias.',
    },
    {
      target: '[data-tour="nav-store-config"]', placement: 'right', icon: 'fa-gear',
      title: 'Configuración',
      body: 'Ajustes de tu tienda: datos, impuestos, pagos, horarios y preferencias de venta.',
    },
    {
      target: '[data-tour="nav-labels"]', placement: 'right', icon: 'fa-barcode',
      title: 'Etiquetas',
      body: 'Genera e imprime etiquetas con código de barras y QR de tus productos, en lote.',
    },
    {
      target: '[data-tour="nav-customers"]', placement: 'right', icon: 'fa-user-group',
      title: 'Clientes',
      body: 'La base de clientes de la tienda: datos de contacto, historial y activación.',
    },
    {
      target: '[data-tour="nav-finanzas"]', placement: 'right', icon: 'fa-scale-balanced',
      title: 'Balance general',
      body: 'Tu resumen financiero: ingresos, egresos y ganancia, con filtro por fechas.',
    },
    {
      target: '[data-tour="nav-gastos"]', placement: 'right', icon: 'fa-wallet',
      title: 'Gastos',
      body: 'Registra y controla los gastos del negocio para tener la ganancia real.',
    },
    {
      target: '[data-tour="nav-reception"]', placement: 'right', icon: 'fa-truck-ramp-box',
      title: 'Recepción',
      body: 'Registra el ingreso de mercadería: escanea o agrega productos y suma stock a la sucursal.',
    },
    {
      target: '[data-tour="nav-receptions"]', placement: 'right', icon: 'fa-clock-rotate-left',
      title: 'Historial de recepciones',
      body: 'Consulta todas las recepciones confirmadas y reimprime sus etiquetas cuando lo necesites.',
    },
    {
      target: '[data-tour="nav-suppliers"]', placement: 'right', icon: 'fa-truck-field',
      title: 'Proveedores',
      body: 'Administra tus proveedores; aparecen al registrar una recepción de mercadería.',
    },
    {
      target: '[data-tour="nav-kiosko"]', placement: 'right', icon: 'fa-qrcode',
      title: 'Kiosko',
      body: 'Pantalla de autoconsulta para clientes: buscan un producto y ven precio y stock por sucursal.',
    },
    {
      target: '[data-tour="nav-sucursales"]', placement: 'right', icon: 'fa-store',
      title: 'Sucursales',
      body: 'Crea y administra las sucursales de la tienda, cada una con su catálogo, stock y horario.',
    },
    {
      target: '[data-tour="nav-profile"]', placement: 'right', icon: 'fa-id-card',
      title: 'Mi perfil',
      body: 'Tus datos personales y el cambio de contraseña.',
    },
    {
      target: '[data-tour="nav-affiliates"]', placement: 'right', icon: 'fa-hand-holding-dollar',
      title: 'Afiliados',
      body: 'Gestiona tu programa de afiliados: enlaces de referido, comisiones y pagos.',
    },
    {
      target: '[data-tour="nav-payroll"]', placement: 'right', icon: 'fa-money-check-dollar',
      title: 'Nómina',
      body: 'Genera y controla los pagos de sueldos y comisiones de tu equipo por mes.',
    },
    {
      target: '[data-tour="nav-messages"]', placement: 'right', icon: 'fa-inbox',
      title: 'Mensajes',
      body: 'Los mensajes que envían los clientes desde el formulario de contacto.',
    },
    {
      target: '[data-tour="nav-subscribers"]', placement: 'right', icon: 'fa-envelope-open-text',
      title: 'Suscriptores',
      body: 'Personas suscritas a tu newsletter, con opción de exportar y dar de baja.',
    },
    {
      target: '[data-tour="nav-wishlist"]', placement: 'right', icon: 'fa-heart',
      title: 'Mis favoritos',
      body: 'Los productos que guardaste como favoritos para revisarlos luego.',
    },
    {
      target: '[data-tour="nav-orders"]', placement: 'right', icon: 'fa-receipt',
      title: 'Mis compras',
      body: 'El historial de tus pedidos: su estado, detalle y comprobantes.',
    },
    {
      target: '[data-tour="nav-addresses"]', placement: 'right', icon: 'fa-location-dot',
      title: 'Direcciones',
      body: 'Tus direcciones de envío guardadas para comprar más rápido.',
    },
    {
      target: '[data-tour="nav-store"]', placement: 'right', icon: 'fa-store',
      title: 'Ir a la tienda',
      body: 'Vuelve al catálogo público para seguir comprando cuando quieras.',
    },
    {
      target: '[data-tour="nav-seller"]', placement: 'right', icon: 'fa-gauge-high',
      title: 'Mi panel',
      body: 'Tu resumen como vendedor: ventas del día, tu comisión y accesos rápidos.',
    },
    {
      target: '[data-tour="nav-affiliate"]', placement: 'right', icon: 'fa-hand-holding-dollar',
      title: 'Panel de afiliado',
      body: 'Tu resumen: clics, ventas con tu código, comisiones generadas y saldo.',
    },
    {
      target: '[data-tour="nav-comisiones"]', placement: 'right', icon: 'fa-hand-holding-dollar',
      title: 'Mis comisiones',
      body: 'El detalle de las comisiones que has ganado por cada venta con tu código.',
    },
    {
      target: '[data-tour="nav-ventas"]', placement: 'right', icon: 'fa-box',
      title: 'Mis ventas',
      body: 'Las ventas realizadas con tu código de afiliado y su estado.',
    },
    {
      target: '[data-tour="nav-pagos"]', placement: 'right', icon: 'fa-money-check-dollar',
      title: 'Mis pagos',
      body: 'El historial de pagos de comisiones que has recibido.',
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

  /** Corre un set de pasos específico (tour contextual de una pantalla). */
  runSteps(steps: TourStep[]): void {
    const applicable = steps.filter(
      s => !s.target || !!resolveTourEl(s.target)
    );
    if (!applicable.length) return;
    this._steps.set(applicable);
    this._index.set(0);
    this._active.set(true);
    this.lockScroll(true);
  }

  /** Inicia el tour, conservando sólo pasos aplicables al DOM actual. */
  start(): void {
    const applicable = this.catalog.filter(
      s => !s.target || !!resolveTourEl(s.target)
    );
    if (!applicable.length) return;
    this._steps.set(this.orderByMenu(applicable));
    this._index.set(0);
    this._active.set(true);
    this.lockScroll(true);
  }

  /** Ordena los pasos de navegación (nav-*) según el ORDEN REAL del menú.
   *  Usa el orden de aparición en el DOM (document order), que coincide con el
   *  orden del arreglo de items del sidebar de cada rol. Es determinista: no
   *  depende de la geometría ni de si el sidebar móvil está montado/oculto
   *  (antes se ordenaba por getBoundingClientRect().top y a veces tomaba el
   *  sidebar móvil oculto, descuadrando el orden). */
  private orderByMenu(steps: TourStep[]): TourStep[] {
    if (typeof document === 'undefined') return steps;
    const isNav = (s: TourStep) => !!s.target && s.target.includes('"nav-');
    // SOLO los items de navegación VISIBLES, en orden de documento. El sidebar
    // móvil (oculto) duplica los data-tour; si se cuela, descuadra el orden.
    // Usamos la MISMA resolución de elemento visible que el filtrado, para que
    // el orden coincida siempre con el menú que el usuario realmente ve.
    const allNav = Array.from(
      document.querySelectorAll<HTMLElement>('[data-tour^="nav-"]'))
      .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0);
    const orderOf = (sel: string | null): number => {
      if (!sel) return Number.MAX_SAFE_INTEGER;
      const el = resolveTourEl(sel);
      const i = el ? allNav.indexOf(el) : -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const navSorted = steps.filter(isNav)
      .sort((a, b) => orderOf(a.target) - orderOf(b.target));
    const result: TourStep[] = [];
    let inserted = false;
    for (const s of steps) {
      if (isNav(s)) {
        if (!inserted) { result.push(...navSorted); inserted = true; }
      } else {
        result.push(s);
      }
    }
    return result;
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
