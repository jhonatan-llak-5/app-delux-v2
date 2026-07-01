import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { AffiliateService, AffiliateSummary, CommissionRow, MonthlyPoint } from '../../affiliate.service';

@Component({
  selector: 'dlx-affiliate-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, ChartCanvasComponent],
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
        <p class="text-3xl font-black font-mono mt-2 text-[#1e40af] dark:text-[#7aa2ff]">{{ code() || '—' }}</p>
        <button (click)="copy(code(), 'Código copiado')" class="mt-3 text-sm text-[#1e40af] dark:text-[#7aa2ff] font-semibold hover:underline">
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
          <a routerLink="/afiliados/terminos" class="text-[#1e40af] dark:text-[#7aa2ff] hover:underline">Ver términos</a>.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      <div class="card p-4">
        <p class="text-[11px] uppercase tracking-widest text-amber-600 font-semibold">Comisiones por pagar</p>
        <p class="text-2xl font-black mt-1 text-amber-600">{{ money(s()?.commission_pending) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] uppercase tracking-widest text-emerald-600 font-semibold">Comisiones pagadas</p>
        <p class="text-2xl font-black mt-1 text-emerald-600">{{ money(s()?.commission_paid) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Total ganado</p>
        <p class="text-2xl font-black mt-1">{{ money(s()?.commission_total) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Ventas atribuidas</p>
        <p class="text-2xl font-black mt-1">{{ s()?.sales_with_commission ?? 0 }}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">{{ s()?.sales_in_progress ?? 0 }} en proceso</p>
      </div>
    </div>

    <!-- Grafica de comisiones por mes -->
    <div class="card p-6 mt-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold tracking-tight">Comisiones por mes</h2>
        <span class="text-xs text-slate-400">Últimos 6 meses</span>
      </div>
      @if (chartConfig(); as cfg) {
        <dlx-chart-canvas [config]="cfg" [height]="260" />
      } @else {
        <div class="p-8 text-center text-slate-400 text-sm">Aún no hay datos para mostrar.</div>
      }
    </div>

    <div class="card overflow-hidden mt-4">
      <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <h2 class="font-bold tracking-tight">Historial de comisiones</h2>
      </div>
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if (rows().length === 0) {
        <div class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-hand-holding-dollar text-3xl mb-3"></i>
          <p>Aún no tienes comisiones. Comparte tus enlaces para empezar a ganar.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Pedido</th>
                <th class="px-4 py-3 font-semibold">Fecha</th>
                <th class="px-4 py-3 font-semibold">Cliente</th>
                <th class="px-4 py-3 font-semibold text-right">Base</th>
                <th class="px-4 py-3 font-semibold text-right">%</th>
                <th class="px-4 py-3 font-semibold text-right">Comisión</th>
                <th class="px-4 py-3 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows(); track c.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ c.order_code }}</td>
                  <td class="px-4 py-2.5 text-slate-500">{{ c.created_at | date:'dd/MM/yyyy' }}</td>
                  <td class="px-4 py-2.5">{{ c.customer_name || '—' }}</td>
                  <td class="px-4 py-2.5 text-right">{{ money(c.base_amount) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ c.rate }}%</td>
                  <td class="px-4 py-2.5 text-right font-bold">{{ money(c.amount) }}</td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          [ngClass]="badge(c.status)">{{ label(c.status) }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
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
  rows = signal<CommissionRow[]>([]);
  loading = signal(true);

  monthly = signal<MonthlyPoint[]>([]);
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
    this.svc.commissions().subscribe({
      next: r => { this.rows.set(r.results || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.monthly().subscribe({ next: r => this.monthly.set(r || []), error: () => {} });
  }

  money(v: number | string | null | undefined): string {
    return '$' + (Math.round((+(v ?? 0)) * 100) / 100).toFixed(2);
  }
  label(st: string): string {
    return st === 'PAID' ? 'Pagada' : st === 'CANCELLED' ? 'Anulada' : 'Por pagar';
  }
  badge(st: string): string {
    if (st === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (st === 'CANCELLED') return 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
  copy(text: string, msg: string): void {
    if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => this.notify.success(msg)).catch(() => {});
    }
  }
}
