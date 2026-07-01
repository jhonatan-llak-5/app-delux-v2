import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DlxDateRangeComponent, DateRangeValue } from '@shared/ui';
import { AffiliateService, CommissionRow } from '../../affiliate.service';

@Component({
  selector: 'dlx-affiliate-commissions',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, DlxDateRangeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-hand-holding-dollar"></i>
          <span class="uppercase tracking-widest font-semibold">Programa de afiliados</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mis comisiones</h1>
        <p class="text-slate-500 text-sm mt-1">Detalle de tus comisiones por cada venta atribuida.</p>
      </div>
      <a routerLink="/app/affiliate" class="btn-secondary text-sm"><i class="fa-solid fa-arrow-left"></i> Volver al panel</a>
    </div>

    <div class="card p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <dlx-date-range (changed)="onRange($event)" />
        <select [(ngModel)]="status" (change)="load()" class="eg-input !py-1.5 text-xs !w-auto">
          <option value="">Todos los estados</option>
          <option value="APPROVED">Por pagar</option>
          <option value="PAID">Pagadas</option>
          <option value="CANCELLED">Anuladas</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-xs" [disabled]="!rows().length" (click)="exportCsv()"><i class="fa-solid fa-file-csv"></i> CSV</button>
        <button class="btn-secondary text-xs" [disabled]="!rows().length" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
      </div>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if (rows().length === 0) {
        <div class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-hand-holding-dollar text-3xl mb-3"></i>
          <p>No hay comisiones con estos filtros.</p>
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
                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" [ngClass]="badge(c.status)">{{ label(c.status) }}</span>
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
export class AffiliateCommissionsComponent implements OnInit {
  private svc = inject(AffiliateService);
  rows = signal<CommissionRow[]>([]);
  loading = signal(true);
  range = signal<DateRangeValue>({});
  status = '';

  ngOnInit(): void { this.load(); }
  onRange(r: DateRangeValue): void { this.range.set(r); this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.commissions(this.range(), this.status).subscribe({
      next: r => { this.rows.set(r.results || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportCsv(): void {
    const header = ['Pedido', 'Fecha', 'Cliente', 'Base', '%', 'Comisión', 'Estado'];
    const lines = this.rows().map(c => [c.order_code, this.fmt(c.created_at), c.customer_name || '',
      c.base_amount, c.rate, c.amount, this.label(c.status)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = ['﻿' + header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mis-comisiones-${this.today()}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }
  exportPdf(): void {
    const doc = new jsPDF();
    doc.setFontSize(15); doc.text('Mis comisiones', 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-EC')} · ${this.rows().length} registro(s)`, 14, 25);
    autoTable(doc, {
      startY: 30,
      head: [['Pedido', 'Fecha', 'Cliente', 'Base', '%', 'Comisión', 'Estado']],
      body: this.rows().map(c => [c.order_code, this.fmt(c.created_at), c.customer_name || '—',
        this.money(c.base_amount), c.rate + '%', this.money(c.amount), this.label(c.status)]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`mis-comisiones-${this.today()}.pdf`);
  }

  money(v: number | string | null | undefined): string { return '$' + (Math.round((+(v ?? 0)) * 100) / 100).toFixed(2); }
  label(st: string): string { return st === 'PAID' ? 'Pagada' : st === 'CANCELLED' ? 'Anulada' : 'Por pagar'; }
  badge(st: string): string {
    if (st === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (st === 'CANCELLED') return 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
  private fmt(iso: string): string { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-EC'); }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}
