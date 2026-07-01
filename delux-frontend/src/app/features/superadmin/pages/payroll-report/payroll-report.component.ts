import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DlxStatCardComponent } from '@shared/ui';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { AuthService } from '@core/services/auth.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { PayrollService, PayrollReport } from '@features/superadmin/services/payroll.service';

@Component({
  selector: 'dlx-payroll-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxStatCardComponent, ChartCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <a routerLink="/app/admin/payroll" class="text-xs text-slate-500 hover:underline"><i class="fa-solid fa-arrow-left"></i> Nómina</a>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight mt-1">Reporte de nómina</h1>
        <p class="text-slate-500 text-sm mt-1">Cuánto has invertido en pagos a empleados por mes.</p>
      </div>
      <button class="btn-secondary text-sm" [disabled]="!(d()?.months?.length)" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> Exportar PDF</button>
    </div>

    <div class="card p-3 mb-4 flex flex-wrap items-center gap-3">
      <select class="eg-input !w-auto" [(ngModel)]="year" (change)="load()">
        @for (y of years; track y) { <option [ngValue]="y">{{ y }}</option> }
      </select>
      @if (!branchLocked()) {
        <select class="eg-input !w-auto" [(ngModel)]="branch" (change)="load()">
          <option [ngValue]="null">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
        </select>
      }
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Invertido en el año" [value]="money(d()?.total)" icon="fa-sack-dollar"
                     iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
      <dlx-stat-card label="Pagado" [value]="money(d()?.paid)" icon="fa-circle-check"
                     iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Pendiente" [value]="money(d()?.pending)" icon="fa-hourglass-half"
                     iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
    </div>

    <div class="card p-6 mb-4">
      <h2 class="font-bold tracking-tight mb-4">Gasto por mes</h2>
      @if (chartConfig(); as cfg) {
        <dlx-chart-canvas [config]="cfg" [height]="280" />
      } @else {
        <div class="p-8 text-center text-slate-400 text-sm">Sin nóminas en {{ year }}.</div>
      }
    </div>

    @if ((d()?.months?.length || 0) > 0) {
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Mes</th>
                <th class="px-4 py-3 font-semibold text-center">Nóminas</th>
                <th class="px-4 py-3 font-semibold text-right">Total</th>
                <th class="px-4 py-3 font-semibold text-right">Pagado</th>
                <th class="px-4 py-3 font-semibold text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              @for (m of d()!.months; track m.month) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-semibold">{{ monthName(m.month) }} {{ m.year }}</td>
                  <td class="px-4 py-2.5 text-center">{{ m.runs }}</td>
                  <td class="px-4 py-2.5 text-right font-bold">{{ money(m.total) }}</td>
                  <td class="px-4 py-2.5 text-right text-emerald-600">{{ money(m.paid) }}</td>
                  <td class="px-4 py-2.5 text-right text-amber-600">{{ money(m.pending) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class PayrollReportComponent implements OnInit {
  private svc = inject(PayrollService);
  private adminSvc = inject(AdminService);
  private auth = inject(AuthService);

  d = signal<PayrollReport | null>(null);
  branches = signal<AdminBranch[]>([]);
  year = new Date().getFullYear();
  branch: number | null = null;
  years = [this.year, this.year - 1, this.year - 2];

  private months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  branchLocked = computed(() => this.auth.user()?.role === 'BRANCH_MANAGER');

  chartConfig = computed<ChartConfiguration | null>(() => {
    const m = this.d()?.months || [];
    if (!m.length) return null;
    return {
      type: 'bar',
      data: {
        labels: m.map(x => this.monthName(x.month)),
        datasets: [
          { label: 'Pagado', data: m.map(x => x.paid), backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6, stack: 's' },
          { label: 'Pendiente', data: m.map(x => x.pending), backgroundColor: 'rgba(245,158,11,0.8)', borderRadius: 6, stack: 's' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, stacked: true, ticks: { callback: v => '$' + v } }, x: { stacked: true, grid: { display: false } } },
      },
    };
  });

  ngOnInit(): void {
    this.load();
    if (!this.branchLocked()) this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
  }

  load(): void {
    this.svc.report({ year: this.year, branch: this.branchLocked() ? undefined : (this.branch ?? undefined) }).subscribe({
      next: r => this.d.set(r), error: () => {},
    });
  }

  exportPdf(): void {
    const r = this.d(); if (!r) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Reporte de nómina', 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Año ${this.year}  ·  Total: ${this.money(r.total)}  ·  Pagado: ${this.money(r.paid)}  ·  Pendiente: ${this.money(r.pending)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['Mes', 'Nóminas', 'Total', 'Pagado', 'Pendiente']],
      body: r.months.map(m => [`${this.monthName(m.month)} ${m.year}`, m.runs, this.money(m.total), this.money(m.paid), this.money(m.pending)]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`reporte-nomina-${this.year}.pdf`);
  }

  monthName(m: number): string { return this.months[m - 1] || String(m); }
  money(v: number | string | null | undefined): string { return '$' + (Math.round((+(v ?? 0)) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
}
