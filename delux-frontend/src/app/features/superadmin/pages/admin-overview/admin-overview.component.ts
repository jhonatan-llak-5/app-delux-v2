import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxStatCardComponent } from '@shared/ui';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { AuthService } from '@core/services/auth.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import {
  ReportsService, OverviewKPIs, TimelinePoint, ChannelRow, ProductRow, LowStockRow,
} from '@features/superadmin/services/reports.service';

@Component({
  selector: 'dlx-admin-overview',
  standalone: true,
  imports: [DlxStatCardComponent, CommonModule, RouterLink, ChartCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Saludo -->
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-sm text-slate-500 dark:text-white/50">{{ greeting() }},</p>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ name() }} 👋</h1>
        <p class="text-slate-500 dark:text-white/50 text-sm mt-1">Este es el resumen de tu tienda de los últimos 30 días.</p>
      </div>
      <span class="text-xs text-slate-400 bg-slate-100 dark:bg-white/5 rounded-full px-3 py-1.5">
        <i class="fa-regular fa-calendar"></i> {{ rangeLabel() }}
      </span>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      @for (k of kpiCards(); track k.label) {
        <dlx-stat-card [label]="k.label" [value]="k.value" [icon]="k.icon"
                       [iconBg]="k.iconBg" [iconColor]="k.iconColor" [delta]="k.delta" [sub]="k.sub" />
      }
    </div>

    @if (noAccess()) {
      <div class="card p-6 mt-4 text-center text-slate-500">
        <i class="fa-solid fa-lock text-2xl mb-2 text-slate-300"></i>
        <p>Los reportes detallados están disponibles para administradores y gerentes.</p>
      </div>
    } @else {
      <!-- Gráfica de ventas + canal -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div class="card p-6 lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-bold tracking-tight">Ventas</h2>
              <p class="text-xs text-slate-400">Ingresos por día</p>
            </div>
            <span class="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300 rounded-full px-3 py-1">
              Total: {{ money(kpis()?.total_revenue) }}
            </span>
          </div>
          @if (revenueConfig(); as cfg) {
            <dlx-chart-canvas [config]="cfg" [height]="280" />
          } @else {
            <div class="p-10 text-center text-slate-400 text-sm">Sin datos de ventas en el periodo.</div>
          }
        </div>

        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Por canal</h2>
          <p class="text-xs text-slate-400 mb-4">Web vs. tienda física</p>
          @if (channelConfig(); as cfg) {
            <dlx-chart-canvas [config]="cfg" [height]="220" />
          } @else {
            <div class="p-10 text-center text-slate-400 text-sm">Sin datos.</div>
          }
        </div>
      </div>

      <!-- Top productos + stock bajo -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
            <h2 class="font-bold tracking-tight"><i class="fa-solid fa-fire text-orange-500 mr-1"></i> Top productos</h2>
            <a routerLink="/app/admin/reports" class="text-xs text-blue-600 hover:underline">Ver reportes</a>
          </div>
          @if (topProducts().length === 0) {
            <div class="p-8 text-center text-slate-400 text-sm">Sin ventas todavía.</div>
          } @else {
            <ul>
              @for (p of topProducts().slice(0, 5); track p.variant__product_id; let i = $index) {
                <li class="flex items-center gap-3 px-5 py-3 border-t border-slate-50 dark:border-white/5 first:border-t-0">
                  <span class="grid place-items-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
                        [ngClass]="rankClass(i)">{{ i + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-sm truncate">{{ p.variant__product__name }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ p.variant__product__brand__name || '—' }} · {{ p.units }} uds.</p>
                  </div>
                  <span class="font-bold text-sm text-emerald-600">{{ money(p.revenue) }}</span>
                </li>
              }
            </ul>
          }
        </div>

        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <h2 class="font-bold tracking-tight"><i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i> Stock bajo</h2>
          </div>
          @if (lowStock().length === 0) {
            <div class="p-8 text-center text-slate-400 text-sm">Todo el stock está en niveles saludables. 👍</div>
          } @else {
            <ul>
              @for (s of lowStock().slice(0, 5); track s.variant_sku) {
                <li class="flex items-center gap-3 px-5 py-3 border-t border-slate-50 dark:border-white/5 first:border-t-0">
                  <span class="grid place-items-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 shrink-0"><i class="fa-solid fa-box"></i></span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-sm truncate">{{ s.product_name }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ s.branch_name }} · {{ s.variant_sku }}</p>
                  </div>
                  <span class="text-sm font-bold" [ngClass]="s.quantity === 0 ? 'text-rose-600' : 'text-amber-600'">{{ s.quantity }}</span>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }

    <!-- Accesos rápidos -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
      @for (s of shortcuts; track s.route) {
        <a [routerLink]="s.route" class="card p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
          <span class="grid place-items-center w-12 h-12 rounded-xl shrink-0" [ngClass]="s.iconBg + ' ' + s.iconColor">
            <i class="fa-solid text-lg" [ngClass]="s.icon"></i>
          </span>
          <div class="min-w-0">
            <p class="font-bold text-sm">{{ s.title }}</p>
            <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5 leading-snug">{{ s.description }}</p>
            <span class="text-xs font-semibold text-blue-600 mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              {{ s.cta }} <i class="fa-solid fa-arrow-right text-[10px]"></i>
            </span>
          </div>
        </a>
      }
    </div>
  `,
})
export class AdminOverviewComponent implements OnInit {
  private reports = inject(ReportsService);
  private auth = inject(AuthService);

  kpis = signal<OverviewKPIs | null>(null);
  timeline = signal<TimelinePoint[]>([]);
  channels = signal<ChannelRow[]>([]);
  topProducts = signal<ProductRow[]>([]);
  lowStock = signal<LowStockRow[]>([]);
  noAccess = signal(false);

  name = computed(() => {
    const u = this.auth.user();
    return (u?.full_name || u?.username || 'Hola').split(' ')[0];
  });

  greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  private range = (() => {
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - 29);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  })();
  rangeLabel = () => `${this.fmt(this.range.from)} – ${this.fmt(this.range.to)}`;

  kpiCards = computed(() => {
    const k = this.kpis();
    return [
      { label: 'Ingresos', value: this.money(k?.total_revenue), icon: 'fa-sack-dollar',
        iconBg: 'bg-blue-50 dark:bg-blue-500/15', iconColor: 'text-blue-600 dark:text-blue-400',
        delta: k?.revenue_delta_pct ?? null, sub: '' },
      { label: 'Pedidos', value: (k?.total_orders ?? 0).toLocaleString('es-EC'), icon: 'fa-receipt',
        iconBg: 'bg-violet-50 dark:bg-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-400',
        delta: k?.orders_delta_pct ?? null, sub: '' },
      { label: 'Ticket promedio', value: this.money(k?.avg_order_value), icon: 'fa-tags',
        iconBg: 'bg-emerald-50 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400',
        delta: null, sub: 'Valor medio por pedido' },
      { label: 'Clientes', value: (k?.unique_customers ?? 0).toLocaleString('es-EC'), icon: 'fa-user-group',
        iconBg: 'bg-amber-50 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400',
        delta: null, sub: (k?.items_sold ?? 0) + ' artículos vendidos' },
    ];
  });

  revenueConfig = computed<ChartConfiguration | null>(() => {
    const t = this.timeline();
    if (!t.length) return null;
    return {
      type: 'line',
      data: {
        labels: t.map(p => this.fmt(p.day)),
        datasets: [{
          label: 'Ingresos',
          data: t.map(p => +p.revenue),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          fill: true, tension: 0.35, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + v }, grid: { color: 'rgba(148,163,184,0.15)' } },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        },
      },
    };
  });

  channelConfig = computed<ChartConfiguration | null>(() => {
    const c = this.channels();
    if (!c.length) return null;
    const label = (ch: string) => ch === 'WEB' ? 'Web' : ch === 'POS' ? 'Tienda' : ch;
    return {
      type: 'doughnut',
      data: {
        labels: c.map(x => label(x.channel)),
        datasets: [{
          data: c.map(x => +x.revenue),
          backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
      },
    };
  });

  readonly shortcuts = [
    { route: '/app/admin/pos', icon: 'fa-cash-register',
      iconBg: 'bg-blue-50 dark:bg-blue-500/15', iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'Punto de venta', description: 'Registra una venta en tienda.', cta: 'Abrir POS' },
    { route: '/app/admin/products', icon: 'fa-box',
      iconBg: 'bg-violet-50 dark:bg-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-400',
      title: 'Productos', description: 'Gestiona tu catálogo e inventario.', cta: 'Ver productos' },
    { route: '/app/admin/reports', icon: 'fa-chart-line',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Reportes', description: 'Analítica completa de tu negocio.', cta: 'Ver reportes' },
  ];

  ngOnInit(): void {
    const p = this.range;
    this.reports.overview(p).subscribe({
      next: k => this.kpis.set(k),
      error: () => this.noAccess.set(true),
    });
    this.reports.timeline(p).subscribe({ next: r => this.timeline.set(r.results || []), error: () => {} });
    this.reports.byChannel(p).subscribe({ next: r => this.channels.set(r.results || []), error: () => {} });
    this.reports.topProducts(p).subscribe({ next: r => this.topProducts.set(r.results || []), error: () => {} });
    this.reports.lowStock().subscribe({ next: r => this.lowStock.set(r.results || []), error: () => {} });
  }

  money(v: number | string | null | undefined): string {
    const n = +(v ?? 0) || 0;
    return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  rankClass(i: number): string {
    return ['bg-amber-100 text-amber-700', 'bg-slate-200 text-slate-600', 'bg-orange-100 text-orange-700'][i]
      || 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300';
  }
  private fmt(iso: string): string {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  }
}
