import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DlxStatCardComponent, DlxDateRangeComponent, DateRangeValue } from '@shared/ui';
import { imgOrPlaceholder, onImageError } from '@shared/utils/img-placeholder';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AffiliateService, AffiliateProductsData } from '../../affiliate.service';

@Component({
  selector: 'dlx-affiliate-products',
  standalone: true,
  imports: [CommonModule, RouterLink, DlxStatCardComponent, DlxDateRangeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-hand-holding-dollar"></i>
          <span class="uppercase tracking-widest font-semibold">Programa de afiliados</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mis ventas</h1>
        <p class="text-slate-500 text-sm mt-1">Productos vendidos a través de tus enlaces (pedidos pagados/entregados).</p>
      </div>
      <a routerLink="/app/affiliate" class="btn-secondary text-sm"><i class="fa-solid fa-arrow-left"></i> Volver al panel</a>
    </div>

    <div class="card p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
      <dlx-date-range (changed)="onRange($event)" />
      <div class="flex gap-2">
        <button class="btn-secondary text-xs" [disabled]="!(d()?.products?.length)" (click)="exportCsv()"><i class="fa-solid fa-file-csv"></i> CSV</button>
        <button class="btn-secondary text-xs" [disabled]="!(d()?.products?.length)" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Monto vendido" [value]="money(d()?.total_revenue)" icon="fa-sack-dollar"
                     iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Unidades" [value]="d()?.total_units ?? 0" icon="fa-cubes"
                     iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
      <dlx-stat-card label="Productos distintos" [value]="d()?.distinct_products ?? 0" icon="fa-box" />
    </div>

    <div class="card overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <h2 class="font-bold tracking-tight">Productos vendidos</h2>
      </div>
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if ((d()?.products?.length || 0) === 0) {
        <div class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-box-open text-3xl mb-3"></i>
          <p>Aún no hay ventas atribuidas a tus enlaces. Comparte tus productos para empezar.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">#</th>
                <th class="px-4 py-3 font-semibold">Producto</th>
                <th class="px-4 py-3 font-semibold">Marca</th>
                <th class="px-4 py-3 font-semibold text-center">Unidades</th>
                <th class="px-4 py-3 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              @for (p of d()!.products; track p.product_id; let i = $index) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-3 min-w-0">
                      <img [src]="img(p.image)" [alt]="p.name" (error)="onErr($event)"
                           class="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-white/5 shrink-0" />
                      <span class="font-semibold truncate">{{ p.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-slate-500">{{ p.brand || '—' }}</td>
                  <td class="px-4 py-2.5 text-center font-semibold">{{ p.units }}</td>
                  <td class="px-4 py-2.5 text-right font-bold text-emerald-600">{{ money(p.revenue) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AffiliateProductsComponent implements OnInit {
  private svc = inject(AffiliateService);
  d = signal<AffiliateProductsData | null>(null);
  loading = signal(true);

  range = signal<DateRangeValue>({});

  ngOnInit(): void { this.load(); }

  onRange(r: DateRangeValue): void { this.range.set(r); this.load(); }

  private load(): void {
    this.loading.set(true);
    this.svc.myProducts(this.range()).subscribe({
      next: r => { this.d.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportCsv(): void {
    const rows = this.d()?.products || [];
    const header = ['Producto', 'Marca', 'Unidades', 'Monto'];
    const lines = rows.map(p => [p.name, p.brand || '', p.units, p.revenue]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = ['\ufeff' + header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mis-ventas-${this.today()}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  exportPdf(): void {
    const rows = this.d()?.products || [];
    const doc = new jsPDF();
    doc.setFontSize(15); doc.text('Mis ventas', 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-EC')} · ${rows.length} producto(s)`, 14, 25);
    autoTable(doc, {
      startY: 30,
      head: [['Producto', 'Marca', 'Unidades', 'Monto']],
      body: rows.map(p => [p.name, p.brand || '—', p.units, this.money(p.revenue)]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`mis-ventas-${this.today()}.pdf`);
  }
  private today(): string { return new Date().toISOString().slice(0, 10); }

  img(u: string): string { return imgOrPlaceholder(u); }
  onErr(e: Event): void { onImageError(e); }
  money(v: number | string | null | undefined): string {
    return '$' + (Math.round((+(v ?? 0)) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
