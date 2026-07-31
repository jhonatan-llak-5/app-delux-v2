import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BranchContextService } from '@core/services/branch-context.service';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { ExportColumn, PdfLogo } from '@shared/utils/export.util';
import { exportBalancePdf } from '@shared/utils/balance-report.util';
import {
  ExpenseService, FinanceSummary, FinanceTopProduct, FinanceTxn, FinanceTxnPage,
} from '@features/superadmin/services/expense.service';

type Period = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio' | 'custom';
type TxnKind = '' | 'INGRESO' | 'EGRESO';

@Component({
  selector: 'dlx-finanzas-resumen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxExportMenuComponent, DlxSearchInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finanzas-resumen.component.html',
})
export class FinanzasResumenComponent {
  private svc = inject(ExpenseService);
  ctx = inject(BranchContextService);

  loading = signal(false);
  loadingTxns = signal(false);
  data = signal<FinanceSummary | null>(null);
  topProducts = signal<FinanceTopProduct[]>([]);
  txns = signal<FinanceTxn[]>([]);
  txnPage = signal<FinanceTxnPage | null>(null);

  period = signal<Period>('hoy');            // por defecto: hoy
  search = signal<string>('');
  txnKind = signal<TxnKind>('');             // Todos / Ingresos / Egresos
  page = signal<number>(1);
  readonly pageSize = 20;

  customFrom = signal<string>(this.fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  customTo = signal<string>(this.fmtDate(new Date()));
  readonly maxDate = this.fmtDate(new Date());

  readonly periods: { key: Period; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'quincena', label: 'Quincena' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' },
    { key: 'custom', label: 'Rango' },
  ];
  readonly kinds: { key: TxnKind; label: string }[] = [
    { key: '', label: 'Todos' },
    { key: 'INGRESO', label: 'Ingresos' },
    { key: 'EGRESO', label: 'Egresos' },
  ];

  // Balance = Ventas − Gastos (sin compras, por decisión del negocio)
  balance = computed(() => {
    const d = this.data(); if (!d) return 0;
    return Number(d.ventas || 0) - Number(d.gastos || 0);
  });

  constructor() {
    // Resumen (KPIs) + top productos: dependen de periodo/sucursal/rango
    effect(() => {
      this.period(); this.ctx.current();
      if (this.period() === 'custom') { this.customFrom(); this.customTo(); }
      this.reload();
    }, { allowSignalWrites: true });

    // Transacciones: además dependen de búsqueda, tipo y página
    effect(() => {
      this.period(); this.ctx.current(); this.search(); this.txnKind(); this.page();
      if (this.period() === 'custom') { this.customFrom(); this.customTo(); }
      this.reloadTxns();
    }, { allowSignalWrites: true });
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private range(): { from: string; to: string } {
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    switch (this.period()) {
      case 'hoy':      return { from: this.fmtDate(d), to: this.fmtDate(d) };
      case 'semana': { const mon = new Date(d); mon.setDate(day - ((d.getDay() + 6) % 7)); return { from: this.fmtDate(mon), to: this.fmtDate(d) }; }
      case 'quincena': return { from: this.fmtDate(day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16)), to: this.fmtDate(d) };
      case 'mes':      return { from: this.fmtDate(new Date(y, m, 1)), to: this.fmtDate(d) };
      case 'anio':     return { from: this.fmtDate(new Date(y, 0, 1)), to: this.fmtDate(d) };
      case 'custom':   return { from: this.customFrom(), to: this.customTo() };
    }
  }
  private validRange(r: { from: string; to: string }): boolean {
    return !(this.period() === 'custom' && (!r.from || !r.to || r.from > r.to));
  }

  reload(): void {
    const r = this.range();
    if (!this.validRange(r)) return;
    this.loading.set(true);
    const f = { from: r.from, to: r.to, branch: this.ctx.current() ?? undefined };
    this.svc.financeSummary(f).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.financeTopProducts(f).subscribe({ next: p => this.topProducts.set(p), error: () => this.topProducts.set([]) });
  }

  reloadTxns(): void {
    const r = this.range();
    if (!this.validRange(r)) return;
    this.loadingTxns.set(true);
    this.svc.financeTransactions({
      from: r.from, to: r.to, branch: this.ctx.current() ?? undefined,
      q: this.search().trim() || undefined, kind: this.txnKind() || undefined,
      page: this.page(), page_size: this.pageSize,
    }).subscribe({
      next: p => { this.txnPage.set(p); this.txns.set(p.results); this.loadingTxns.set(false); },
      error: () => { this.txnPage.set(null); this.txns.set([]); this.loadingTxns.set(false); },
    });
  }

  setPeriod(p: Period): void { this.page.set(1); this.period.set(p); }
  setKind(k: TxnKind): void { this.page.set(1); this.txnKind.set(k); }

  onSearch(v: string): void { this.page.set(1); this.search.set(v); }

  onFromChange(v: string): void { if (!v) return; this.customFrom.set(v); if (this.customTo() < v) this.customTo.set(v); }
  onToChange(v: string): void { if (!v) return; this.customTo.set(v); if (this.customFrom() > v) this.customFrom.set(v); }

  // Paginación
  totalPages = computed(() => { const p = this.txnPage(); return p ? Math.max(1, Math.ceil(p.count / p.page_size)) : 1; });
  prevPage(): void { if (this.page() > 1) this.page.update(v => v - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.page.update(v => v + 1); }

  // Exportación: resumen (Balance/Ventas/Gastos) + productos más vendidos
  readonly exportColumns: ExportColumn<{ seccion: string; concepto: string; valor: string }>[] = [
    { header: 'Sección', key: 'seccion' },
    { header: 'Concepto', key: 'concepto' },
    { header: 'Valor (USD)', key: 'valor' },
  ];
  exportRows = computed(() => {
    const d = this.data(); if (!d) return [];
    const $ = (n: string | number) => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rows: { seccion: string; concepto: string; valor: string }[] = [];
    rows.push({ seccion: 'RESUMEN', concepto: 'Ventas totales', valor: $(d.ventas) });
    rows.push({ seccion: 'RESUMEN', concepto: 'Gastos totales', valor: $(d.gastos) });
    rows.push({ seccion: 'RESUMEN', concepto: 'Balance', valor: $(this.balance()) });
    rows.push({ seccion: 'RESUMEN', concepto: 'Número de ventas', valor: String(d.orders ?? 0) });
    for (const p of this.topProducts()) rows.push({ seccion: 'PRODUCTOS MÁS VENDIDOS', concepto: p.product, valor: p.qty + ' u · ' + $(p.revenue) });
    return rows;
  });
  exportSubtitle = computed(() => {
    const d = this.data();
    return d ? `${this.ctx.currentName()} · ${d.range.from} a ${d.range.to}` : '';
  });

  /**
   * PDF dedicado del Balance general (blanco y negro, por secciones).
   * Se conecta a la opción "PDF" del menú de exportación; CSV/Excel siguen usando
   * la utilidad genérica con `exportColumns`/`exportRows`.
   */
  onExportPdf = async ({ logo, brandName }: { logo: PdfLogo | null; brandName: string }): Promise<void> => {
    const d = this.data();
    if (!d) return;
    const r = this.range();
    if (!this.validRange(r)) return;

    // Trae TODAS las transacciones del período (sin paginar, sin filtro de tipo/búsqueda).
    let page: FinanceTxnPage | null = null;
    try {
      page = await firstValueFrom(this.svc.financeTransactions({
        from: r.from, to: r.to, branch: this.ctx.current() ?? undefined,
        page: 1, page_size: 1000,
      }));
    } catch { page = null; }

    const txns = (page?.results ?? []).map(t => ({
      kind: t.kind, date: t.date, concept: t.concept,
      party: t.party, method: t.method, amount: Number(t.amount || 0),
    }));

    exportBalancePdf({
      storeName: this.ctx.currentName(),
      brandName,
      logo,
      range: { from: r.from, to: r.to },
      ventas: Number(d.ventas || 0),
      gastos: Number(d.gastos || 0),
      balance: this.balance(),
      orders: d.orders ?? 0,
      compras: Number(d.compras || 0),
      comprasUnits: d.compras_units ?? 0,
      topProducts: this.topProducts().map(p => ({ product: p.product, qty: p.qty, revenue: Number(p.revenue || 0) })),
      txns,
      ingresosTotal: Number(page?.ingresos_total || 0),
      egresosTotal: Number(page?.egresos_total || 0),
      txnBalance: page ? Number(page.balance || 0) : this.balance(),
    });
  };

  money(n: string | number | undefined): string { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  txnDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) +
      (iso.includes('T') ? ' · ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '');
  }
}
