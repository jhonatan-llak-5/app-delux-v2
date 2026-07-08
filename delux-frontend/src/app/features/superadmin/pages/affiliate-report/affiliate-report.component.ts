import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { AffiliateService, AffiliateReport } from '@features/affiliate/affiliate.service';

@Component({
  selector: 'dlx-affiliate-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxStatCardComponent, DlxEmptyStateComponent, ChartCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <a routerLink="/app/admin/affiliates" class="hover:text-ink-950">Afiliados</a>
          <i class="fa-solid fa-chevron-right text-[10px]"></i>
          <span class="uppercase tracking-widest font-semibold">Reporte</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Reporte de pagos a afiliados</h1>
        <p class="text-slate-500 text-sm mt-1">Cuánto has pagado en comisiones y a quiénes.</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button class="btn-secondary text-sm" [disabled]="!d()?.payouts?.length" (click)="exportCsv()"><i class="fa-solid fa-file-csv"></i> CSV</button>
        <button class="btn-secondary text-sm" [disabled]="!d()?.payouts?.length" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
      </div>
    </div>

    <div class="card p-3 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="eg-label">Desde</label>
        <input type="date" class="eg-input !w-auto" [(ngModel)]="from" (change)="load()" />
      </div>
      <div>
        <label class="eg-label">Hasta</label>
        <input type="date" class="eg-input !w-auto" [(ngModel)]="to" (change)="load()" />
      </div>
      <button class="btn-secondary text-sm" (click)="from=''; to=''; load()"><i class="fa-solid fa-xmark"></i> Limpiar</button>
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (d(); as r) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <dlx-stat-card label="Total pagado" [value]="money(r.total_paid)" icon="fa-circle-check"
          iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
        <dlx-stat-card label="Por pagar (actual)" [value]="money(r.total_pending)" icon="fa-hourglass-half"
          iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
        <dlx-stat-card label="Pagos" [value]="r.payouts_count" icon="fa-receipt" />
        <dlx-stat-card label="Afiliados pagados" [value]="r.affiliates_paid" icon="fa-users"
          iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
      </div>

      <div class="card p-5 mb-4">
        <h2 class="font-bold tracking-tight mb-4">Pagos por mes</h2>
        @if (chartConfig(); as cfg) {
          <dlx-chart-canvas [config]="cfg" [height]="280" />
        } @else {
          <div class="p-8 text-center text-slate-400 text-sm">Sin pagos en el rango seleccionado.</div>
        }
      </div>

      @if (r.payouts.length === 0) {
        <dlx-empty-state icon="fa-money-check-dollar" title="No hay pagos en ese rango de fechas." />
      } @else {
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
                <tr>
                  <th class="px-4 py-3 font-semibold">Afiliado</th>
                  <th class="px-4 py-3 font-semibold">Código</th>
                  <th class="px-4 py-3 font-semibold text-right">Monto</th>
                  <th class="px-4 py-3 font-semibold">Método</th>
                  <th class="px-4 py-3 font-semibold text-center">Comisiones</th>
                  <th class="px-4 py-3 font-semibold">Referencia</th>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                @for (p of r.payouts; track $index) {
                  <tr class="border-t border-slate-100 dark:border-white/5">
                    <td class="px-4 py-3 font-semibold">{{ p.affiliate }}</td>
                    <td class="px-4 py-3 font-mono text-[var(--dash-primary)]">{{ p.ref_code || '—' }}</td>
                    <td class="px-4 py-3 text-right font-bold text-emerald-600">{{ money(p.amount) }}</td>
                    <td class="px-4 py-3">{{ p.method }}</td>
                    <td class="px-4 py-3 text-center">{{ p.commissions_count }}</td>
                    <td class="px-4 py-3 text-xs text-slate-500">{{ p.reference || '—' }}</td>
                    <td class="px-4 py-3 text-xs text-slate-500">{{ fmtDate(p.date) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }
  `,
})
export class AffiliateReportComponent implements OnInit {
  private svc = inject(AffiliateService);
  from = '';
  to = '';
  loading = signal(true);
  d = signal<AffiliateReport | null>(null);

  private readonly MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  monthName(iso: string): string {
    const dt = new Date(iso + 'T00:00:00');
    return isNaN(dt.getTime()) ? iso : `${this.MES[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  chartConfig = computed<ChartConfiguration | null>(() => {
    const m = this.d()?.by_month || [];
    if (!m.length) return null;
    return {
      type: 'bar',
      data: {
        labels: m.map(x => this.monthName(x.month)),
        datasets: [
          { label: 'Pagado', data: m.map(x => +x.total || 0), backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v } }, x: { grid: { display: false } } },
      },
    };
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.affiliateReport({ from: this.from || undefined, to: this.to || undefined }).subscribe({
      next: r => { this.d.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  money(v: string | number | null | undefined): string {
    return '$' + (Math.round((+(v ?? 0) || 0) * 100) / 100).toFixed(2);
  }
  fmtDate(iso: string): string { try { return new Date(iso).toLocaleString(); } catch { return iso; } }

  exportCsv(): void {
    const rows = this.d()?.payouts || [];
    const head = ['Afiliado', 'Codigo', 'Monto', 'Metodo', 'Comisiones', 'Referencia', 'Fecha'];
    const lines = [head.join(',')].concat(rows.map(p =>
      [p.affiliate, p.ref_code, p.amount, p.method, String(p.commissions_count),
       (p.reference || '').replace(/[,\n]/g, ' '), this.fmtDate(p.date)]
        .map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'reporte-afiliados.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    const d = this.d(); if (!d) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Reporte de pagos a afiliados', 14, 18);
    doc.setFontSize(10);
    doc.text(`Total pagado: ${this.money(d.total_paid)}   Por pagar: ${this.money(d.total_pending)}   Pagos: ${d.payouts_count}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['Afiliado', 'Código', 'Monto', 'Método', 'Com.', 'Fecha']],
      body: (d.payouts || []).map(p => [
        p.affiliate, p.ref_code, this.money(p.amount), p.method,
        String(p.commissions_count), this.fmtDate(p.date),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save('reporte-afiliados.pdf');
  }
}
