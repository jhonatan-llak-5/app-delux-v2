import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxStatCardComponent } from '@shared/ui';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { AffiliateService, AffiliateSummary, MonthlyPoint, AffiliateProductRow } from '../../affiliate.service';

@Component({
  selector: 'dlx-affiliate-panel',
  standalone: true,
  imports: [DlxStatCardComponent, CommonModule, RouterLink, ChartCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <i class="fa-solid fa-hand-holding-dollar"></i>
        <span class="uppercase tracking-widest font-semibold">Programa de afiliados</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Panel de afiliado</h1>
      <p class="text-slate-500 text-sm mt-1">Comparte tus enlaces y gana comisiones por cada venta.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-6">
        <p class="text-[11px] uppercase tracking-widest text-slate-400">Tu código</p>
        <p class="text-3xl font-black font-mono mt-2 text-[var(--dash-primary)]">{{ code() || '—' }}</p>
        <button (click)="copy(code(), 'Código copiado')" class="mt-3 text-sm text-[var(--dash-primary)] font-semibold hover:underline">
          <i class="fa-solid fa-copy"></i> Copiar código
        </button>
      </div>
      <div class="card p-6">
        <p class="text-[11px] uppercase tracking-widest text-slate-400">Comisión por venta</p>
        <p class="text-3xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{{ commission() }}%</p>
        <p class="text-xs text-slate-400 mt-2">Sobre el valor de cada pedido atribuido a ti.</p>
      </div>
      <div class="card p-6">
        <p class="text-[11px] uppercase tracking-widest text-slate-400">Tu enlace</p>
        <div class="flex gap-2 mt-2">
          <input [value]="baseLink()" readonly class="eg-input font-mono text-xs flex-1" />
          <button (click)="copy(baseLink(), 'Enlace copiado')" class="eg-btn-secondary shrink-0" title="Copiar"><i class="fa-solid fa-copy"></i></button>
        </div>
        <p class="text-xs text-slate-400 mt-2">
          En cada producto tienes un botón para copiar su enlace con tu código.
          <a routerLink="/afiliados/terminos" class="text-[var(--dash-primary)] hover:underline">Ver términos</a>.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      <dlx-stat-card label="Comisiones por pagar" [value]="money(s()?.commission_pending)" icon="fa-hourglass-half" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      <dlx-stat-card label="Comisiones pagadas" [value]="money(s()?.commission_paid)" icon="fa-circle-check" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Total ganado" [value]="money(s()?.commission_total)" icon="fa-sack-dollar" />
      <dlx-stat-card label="Ventas atribuidas" [value]="s()?.sales_with_commission ?? 0" icon="fa-cart-shopping" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" [sub]="(s()?.sales_in_progress ?? 0) + ' en proceso'" />
    </div>

    <!-- Accesos a secciones -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      <a routerLink="/app/affiliate/comisiones" class="card p-5 flex items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
        <span class="grid place-items-center w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"><i class="fa-solid fa-hand-holding-dollar"></i></span>
        <div class="min-w-0"><p class="font-bold text-sm">Mis comisiones</p><p class="text-xs text-slate-400">Detalle, filtros y export</p></div>
        <i class="fa-solid fa-arrow-right text-[10px] text-slate-400 ml-auto group-hover:translate-x-1 transition-transform"></i>
      </a>
      <a routerLink="/app/affiliate/ventas" class="card p-5 flex items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
        <span class="grid place-items-center w-11 h-11 rounded-xl bg-[var(--dash-primary-l)] text-[var(--dash-primary)] shrink-0"><i class="fa-solid fa-box"></i></span>
        <div class="min-w-0"><p class="font-bold text-sm">Mis ventas</p><p class="text-xs text-slate-400">Productos vendidos</p></div>
        <i class="fa-solid fa-arrow-right text-[10px] text-slate-400 ml-auto group-hover:translate-x-1 transition-transform"></i>
      </a>
      <a routerLink="/app/affiliate/pagos" class="card p-5 flex items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
        <span class="grid place-items-center w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0"><i class="fa-solid fa-money-check-dollar"></i></span>
        <div class="min-w-0"><p class="font-bold text-sm">Mis pagos</p><p class="text-xs text-slate-400">Historial de cobros</p></div>
        <i class="fa-solid fa-arrow-right text-[10px] text-slate-400 ml-auto group-hover:translate-x-1 transition-transform"></i>
      </a>
    </div>

    <!-- Grafica de comisiones por mes + top productos -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h2 class="font-bold tracking-tight">Comisiones por mes</h2>
            @if (monthDelta() !== null) {
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
                    [ngClass]="monthDelta()! >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'">
                <i class="fa-solid" [ngClass]="monthDelta()! >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'"></i>
                {{ monthDelta()! >= 0 ? '+' : '' }}{{ monthDelta() }}% vs. mes anterior
              </span>
            }
          </div>
          <span class="text-xs text-slate-400">Últimos 6 meses</span>
        </div>
        @if (chartConfig(); as cfg) {
          <dlx-chart-canvas [config]="cfg" [height]="260" />
        } @else {
          <div class="p-8 text-center text-slate-400 text-sm">Aún no hay datos para mostrar.</div>
        }
      </div>

      <div class="card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 class="font-bold tracking-tight"><i class="fa-solid fa-fire text-orange-500 mr-1"></i> Top productos</h2>
          <a routerLink="/app/affiliate/ventas" class="text-xs text-[var(--dash-primary)] hover:underline">Ver todo</a>
        </div>
        @if (topProducts().length === 0) {
          <div class="p-8 text-center text-slate-400 text-sm">Aún no hay ventas.</div>
        } @else {
          <ul>
            @for (p of topProducts(); track p.product_id; let i = $index) {
              <li class="flex items-center gap-3 px-5 py-3 border-t border-slate-50 dark:border-white/5 first:border-t-0">
                <span class="grid place-items-center w-6 h-6 rounded-lg text-xs font-bold shrink-0" [ngClass]="rankClass(i)">{{ i + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-sm truncate">{{ p.name }}</p>
                  <p class="text-xs text-slate-400">{{ p.units }} uds.</p>
                </div>
                <span class="font-bold text-sm text-emerald-600">{{ money(p.revenue) }}</span>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class AffiliatePanelComponent implements OnInit {
  private auth = inject(AuthService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  private svc = inject(AffiliateService);

  code = computed(() => this.auth.user()?.ref_code || '');
  commission = computed(() => this.branding.affiliateCommissionRate());
  origin = signal(typeof window !== 'undefined' ? window.location.origin : '');
  baseLink = computed(() => this.origin() + '/?ref=' + this.code());

  s = signal<AffiliateSummary | null>(null);
  monthly = signal<MonthlyPoint[]>([]);
  topProducts = signal<AffiliateProductRow[]>([]);

  monthDelta = computed<number | null>(() => {
    const m = this.monthly();
    if (m.length < 2) return null;
    const cur = m[m.length - 1].commission;
    const prev = m[m.length - 2].commission;
    if (!prev) return cur > 0 ? 100 : null;
    return Math.round(((cur - prev) / prev) * 100);
  });

  chartConfig = computed<ChartConfiguration | null>(() => {
    const data = this.monthly();
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Comisión ($)',
          data: data.map(d => d.commission),
          backgroundColor: 'rgba(16,185,129,0.75)',
          borderRadius: 6,
          maxBarThickness: 46,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } },
          x: { grid: { display: false } },
        },
      },
    };
  });

  ngOnInit(): void {
    this.svc.summary().subscribe({ next: r => this.s.set(r), error: () => {} });
    this.svc.monthly().subscribe({ next: r => this.monthly.set(r || []), error: () => {} });
    this.svc.myProducts().subscribe({ next: r => this.topProducts.set((r.products || []).slice(0, 5)), error: () => {} });
  }

  rankClass(i: number): string {
    return ['bg-amber-100 text-amber-700', 'bg-slate-200 text-slate-600', 'bg-orange-100 text-orange-700'][i]
      || 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300';
  }
  money(v: number | string | null | undefined): string {
    return '$' + (Math.round((+(v ?? 0)) * 100) / 100).toFixed(2);
  }
  copy(text: string, msg: string): void {
    if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => this.notify.success(msg)).catch(() => {});
    }
  }
}
