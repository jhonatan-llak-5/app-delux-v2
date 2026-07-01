import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DlxStatCardComponent } from '@shared/ui';
import { AffiliateService, PayoutRow } from '../../affiliate.service';

@Component({
  selector: 'dlx-affiliate-payouts',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, DlxStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-hand-holding-dollar"></i>
          <span class="uppercase tracking-widest font-semibold">Programa de afiliados</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mis pagos</h1>
        <p class="text-slate-500 text-sm mt-1">Historial de los pagos de comisiones que has recibido.</p>
      </div>
      <a routerLink="/app/affiliate" class="btn-secondary text-sm"><i class="fa-solid fa-arrow-left"></i> Volver al panel</a>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Total cobrado" [value]="money(totalPaid())" icon="fa-sack-dollar"
                     iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="N° de pagos" [value]="rows().length" icon="fa-receipt"
                     iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
      <dlx-stat-card label="Último pago" [value]="lastDate()" icon="fa-calendar-check" />
    </div>

    <div class="card overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <h2 class="font-bold tracking-tight">Historial de pagos</h2>
      </div>
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if (rows().length === 0) {
        <div class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-hand-holding-dollar text-3xl mb-3"></i>
          <p>Aún no has recibido pagos. Cuando la tienda registre un pago, aparecerá aquí.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Fecha</th>
                <th class="px-4 py-3 font-semibold">Método</th>
                <th class="px-4 py-3 font-semibold">Referencia</th>
                <th class="px-4 py-3 font-semibold text-center">Comisiones</th>
                <th class="px-4 py-3 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 text-slate-500">{{ p.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="px-4 py-2.5">
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                          [ngClass]="p.method === 'CASH' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'">
                      <i class="fa-solid" [ngClass]="p.method === 'CASH' ? 'fa-money-bill-wave' : 'fa-building-columns'"></i>
                      {{ p.method_label }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-slate-500">{{ p.reference || '—' }}</td>
                  <td class="px-4 py-2.5 text-center">{{ p.commissions_count }}</td>
                  <td class="px-4 py-2.5 text-right font-bold text-emerald-600">{{ money(p.amount) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AffiliatePayoutsComponent implements OnInit {
  private svc = inject(AffiliateService);

  rows = signal<PayoutRow[]>([]);
  loading = signal(true);

  totalPaid = computed(() => this.rows().reduce((s, p) => s + (+p.amount || 0), 0));
  lastDate = computed(() => {
    const r = this.rows();
    if (!r.length) return '—';
    const d = new Date(r[0].created_at);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: '2-digit' });
  });

  ngOnInit(): void {
    this.svc.myPayouts().subscribe({
      next: r => { this.rows.set(r || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  money(v: number | string): string {
    return '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
