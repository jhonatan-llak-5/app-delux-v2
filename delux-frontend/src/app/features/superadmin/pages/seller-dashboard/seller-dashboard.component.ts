import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { AuthService } from '@core/services/auth.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { DlxStatCardComponent } from '@shared/ui';
import { ReportsService, MySalesData } from '@features/superadmin/services/reports.service';

@Component({
  selector: 'dlx-seller-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, ChartCanvasComponent, DlxStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-sm text-slate-500 dark:text-white/50">{{ greeting() }},</p>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ name() }} 👋</h1>
        <p class="text-slate-500 dark:text-white/50 text-sm mt-1">Este es el resumen de tus ventas (últimos 30 días).</p>
      </div>
      <a routerLink="/app/admin/pos" class="eg-btn-primary text-sm"><i class="fa-solid fa-cash-register"></i> Nueva venta</a>
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else {
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <dlx-stat-card label="Ventas del periodo" [value]="'$' + money(d()?.total_revenue)" icon="fa-sack-dollar" />
        <dlx-stat-card label="N° de ventas" [value]="d()?.total_orders ?? 0" icon="fa-receipt"
                       iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
        <dlx-stat-card label="Mi comisión" [value]="'$' + money(d()?.commission)" icon="fa-hand-holding-dollar"
                       iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400"
                       [sub]="d()?.commission_rate + '% por venta'" />
        <dlx-stat-card label="Vendido hoy" [value]="'$' + money(d()?.today_revenue)" icon="fa-calendar-day"
                       iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400"
                       [sub]="(d()?.today_orders ?? 0) + ' venta(s) hoy'" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div class="card p-6 lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-bold tracking-tight">Mis ventas</h2>
              <p class="text-xs text-slate-400">Ingresos por día</p>
            </div>
            <span class="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300 rounded-full px-3 py-1">
              {{ d()?.items_sold ?? 0 }} artículos
            </span>
          </div>
          @if (chartConfig(); as cfg) {
            <dlx-chart-canvas [config]="cfg" [height]="280" />
          } @else {
            <div class="p-10 text-center text-slate-400 text-sm">Aún no tienes ventas en el periodo.</div>
          }
        </div>

        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <h2 class="font-bold tracking-tight"><i class="fa-solid fa-store text-[var(--dash-primary)] mr-1"></i> Dónde vendí</h2>
          </div>
          @if ((d()?.by_branch?.length || 0) === 0) {
            <div class="p-8 text-center text-slate-400 text-sm">Sin datos.</div>
          } @else {
            <ul>
              @for (b of d()!.by_branch; track b.branch__name) {
                <li class="flex items-center justify-between px-5 py-3 border-t border-slate-50 dark:border-white/5 first:border-t-0">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="grid place-items-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0"><i class="fa-solid fa-store text-xs"></i></span>
                    <div class="min-w-0">
                      <p class="font-semibold text-sm truncate">{{ b.branch__name || '—' }}</p>
                      <p class="text-xs text-slate-400">{{ b.orders }} venta(s)</p>
                    </div>
                  </div>
                  <span class="font-bold text-sm text-emerald-600">\${{ money(b.revenue) }}</span>
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <div class="card overflow-hidden mt-4">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 class="font-bold tracking-tight">Mis últimas ventas</h2>
          <a routerLink="/app/admin/sales" class="text-xs text-blue-600 hover:underline">Ver todas</a>
        </div>
        @if ((d()?.recent?.length || 0) === 0) {
          <div class="p-8 text-center text-slate-400 text-sm">Aún no registras ventas.</div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
                <tr>
                  <th class="px-4 py-3 font-semibold">Comprobante</th>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                  <th class="px-4 py-3 font-semibold">Cliente</th>
                  <th class="px-4 py-3 font-semibold">Sucursal</th>
                  <th class="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (o of d()!.recent; track o.code) {
                  <tr class="border-t border-slate-100 dark:border-white/5">
                    <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ o.code }}</td>
                    <td class="px-4 py-2.5 text-slate-500">{{ o.created_at | date:'dd/MM/yy HH:mm' }}</td>
                    <td class="px-4 py-2.5">{{ o.customer || '—' }}</td>
                    <td class="px-4 py-2.5">{{ o.branch }}</td>
                    <td class="px-4 py-2.5 text-right font-bold">\${{ money(o.total) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
  `,
})
export class SellerDashboardComponent implements OnInit {
  private reports = inject(ReportsService);
  private auth = inject(AuthService);

  d = signal<MySalesData | null>(null);
  loading = signal(true);

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

  chartConfig = computed<ChartConfiguration | null>(() => {
    const t = this.d()?.timeline || [];
    if (!t.length || t.every(p => +p.revenue === 0)) return null;
    return {
      type: 'line',
      data: {
        labels: t.map(p => this.fmt(p.day)),
        datasets: [{
          label: 'Ingresos', data: t.map(p => +p.revenue),
          borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)',
          fill: true, tension: 0.35, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
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

  ngOnInit(): void {
    this.reports.mySales().subscribe({
      next: r => { this.d.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  money(v: string | number | null | undefined): string {
    return (Math.round((+(v ?? 0)) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  private fmt(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  }
}
