import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { NotifyService } from '@shared/services/notify.service';
import {
  DlxCashCountComponent, DlxExportMenuComponent, DlxModalComponent, DlxPageHeaderComponent,
  DlxShareButtonComponent, DlxStatCardComponent, DlxTableColumn, DlxTableComponent, CashCountLine,
} from '@shared/ui';
import { ExportColumn, PdfLogo } from '@shared/utils/export.util';
import {
  CashReportMeta, cashSessionPdfBlob, cashSessionsPdfBlob,
  exportCashSessionPdf, exportCashSessionsPdf,
} from '@shared/utils/cash-report.util';
import {
  CashFilter, CashRegister, CashService, CashSession, CashSessionStatus, CashStats,
} from '@features/superadmin/services/cash.service';

@Component({
  selector: 'dlx-cash-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxPageHeaderComponent, DlxStatCardComponent,
            DlxTableComponent, DlxModalComponent, DlxCashCountComponent,
            DlxExportMenuComponent, DlxShareButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-history.component.html',
})
export class CashHistoryComponent implements OnInit {
  private cash = inject(CashService);
  private notify = inject(NotifyService);
  private branding = inject(BrandingService);
  auth = inject(AuthService);
  branchCtx = inject(BranchContextService);

  readonly cols: DlxTableColumn<CashSession>[] = [
    { key: 'code', label: 'Turno' },
    { key: 'branch_name', label: 'Sucursal' },
    { key: 'opened_by_name', label: 'Usuario' },
    { key: 'opened_at', label: 'Apertura' },
    { key: 'closed_at', label: 'Cierre' },
    { key: 'sales_total', label: 'Ventas', align: 'right' },
    { key: 'expected_amount', label: 'Esperado', align: 'right' },
    { key: 'counted_amount', label: 'Contado', align: 'right' },
    { key: 'difference', label: 'Diferencia', align: 'right' },
    { key: 'status', label: 'Estado', align: 'center' },
  ];

  rows = signal<CashSession[]>([]);
  total = signal(0);
  stats = signal<CashStats | null>(null);
  loading = signal(false);

  page = signal(1);
  size = signal(25);
  status = signal<CashSessionStatus | ''>('');
  registerId = signal<number | null>(null);
  registers = signal<CashRegister[]>([]);
  dateFrom = '';
  dateTo = '';

  detail = signal<CashSession | null>(null);
  detailLoading = signal(false);

  canPickBranch = computed(() => this.auth.user()?.role === 'SUPERADMIN');
  branches = computed(() => this.branchCtx.branches());
  branchId = signal<number | null>(null);

  /** Conteos del turno abierto en el modal, en el formato del contador. */
  openingLines = computed<CashCountLine[]>(() => this.toLines(this.detail()?.opening_count));
  closingLines = computed<CashCountLine[]>(() => this.toLines(this.detail()?.closing_count));

  private toLines(rows: CashSession['opening_count']): CashCountLine[] {
    return (rows || []).map(r => ({
      piece: r.piece, denomination: +r.denomination, quantity: r.quantity,
    }));
  }

  ngOnInit(): void {
    this.branchId.set(this.branchCtx.current() ?? this.auth.user()?.branch_id ?? null);
    this.loadRegisters();
    this.reload();
  }

  private loadRegisters(): void {
    this.cash.registers(this.branchId()).subscribe({
      next: r => this.registers.set(r.results || []),
      error: () => this.registers.set([]),
    });
  }

  private filter(): CashFilter {
    return {
      branch: this.branchId(),
      register: this.registerId(),
      status: this.status() || undefined,
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      page: this.page(),
      page_size: this.size(),
    };
  }

  reload(): void {
    this.loading.set(true);
    const f = this.filter();
    this.cash.list(f).subscribe({
      next: r => { this.rows.set(r.results || []); this.total.set(r.count || 0); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.fromServerError(e, 'No se pudo cargar el historial.'); },
    });
    this.cash.stats({ ...f, page: undefined, page_size: undefined }).subscribe({
      next: s => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  applyFilters(): void { this.page.set(1); this.reload(); }
  clearFilters(): void {
    this.status.set('');
    this.registerId.set(null);
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }
  onBranch(id: number | null): void {
    this.branchId.set(id);
    this.registerId.set(null);
    this.loadRegisters();
    this.applyFilters();
  }
  onPage(p: number) { this.page.set(p); this.reload(); }
  onSize(s: number) { this.size.set(s); this.page.set(1); this.reload(); }

  openDetail(row: CashSession): void {
    this.detailLoading.set(true);
    this.detail.set(row);
    this.cash.get(row.id).subscribe({
      next: full => { this.detail.set(full); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }
  closeDetail(): void { this.detail.set(null); }

  // ─────────────────────────────────────────────
  // Exportación
  // ─────────────────────────────────────────────
  /** Columnas de CSV/Excel. El PDF usa su propio diseño por secciones. */
  readonly exportCols: ExportColumn<CashSession>[] = [
    { header: 'Turno', key: 'code' },
    { header: 'Caja', key: r => r.register_name || 'Caja' },
    { header: 'Sucursal', key: 'branch_name' },
    { header: 'Usuario', key: 'opened_by_name' },
    { header: 'Día', key: r => this.dayOf(r.opened_at) },
    { header: 'Apertura', key: r => this.dateTime(r.opened_at) },
    { header: 'Cierre', key: r => (r.closed_at ? this.dateTime(r.closed_at) : 'En curso') },
    { header: 'Estado', key: r => (r.status === 'OPEN' ? 'Abierta' : 'Cerrada') },
    { header: 'Fondo inicial', key: r => (+r.opening_amount).toFixed(2) },
    { header: 'Ventas', key: r => (+r.sales_total).toFixed(2) },
    { header: 'Ventas efectivo', key: r => (+r.cash_sales).toFixed(2) },
    { header: 'Ventas tarjeta', key: r => (+r.card_sales).toFixed(2) },
    { header: 'Ventas transferencia', key: r => (+r.transfer_sales).toFixed(2) },
    { header: 'Gastos efectivo', key: r => (+r.expenses_cash).toFixed(2) },
    { header: 'Ingresos manuales', key: r => (+r.cash_in).toFixed(2) },
    { header: 'Retiros', key: r => (+r.cash_out).toFixed(2) },
    { header: 'Esperado', key: r => (+r.expected_amount).toFixed(2) },
    { header: 'Contado', key: r => (r.status === 'CLOSED' ? (+r.counted_amount).toFixed(2) : '') },
    { header: 'Diferencia', key: r => (r.status === 'CLOSED' ? (+r.difference).toFixed(2) : '') },
  ];

  /** Trae TODOS los turnos del filtro actual (sin paginar) para exportar.
   *  `detail` incluye conteos y movimientos: el PDF los necesita para el anexo
   *  de billetes y monedas. */
  loadAllForExport = async (): Promise<CashSession[]> => {
    const r = await firstValueFrom(
      this.cash.list({ ...this.filter(), page: 1, page_size: 1000, detail: true }));
    return r.results || [];
  };

  private meta(logo: PdfLogo | null = null): CashReportMeta {
    const branch = this.branches().find(b => b.id === this.branchId())?.name;
    return {
      storeName: branch ? `${this.branding.siteName()} · ${branch}` : this.branding.siteName(),
      brandName: this.branding.siteName(),
      logo,
      range: { from: this.dateFrom, to: this.dateTo },
    };
  }

  /** PDF del período completo (lo invoca el menú Exportar). */
  exportGroupPdf = async (o: { logo: PdfLogo | null }): Promise<void> => {
    const rows = await this.loadAllForExport();
    if (!rows.length) { this.notify.info('No hay turnos que exportar con esos filtros.'); return; }
    exportCashSessionsPdf(rows as any, this.meta(o.logo));
  };

  /** PDF de un turno concreto (desde el detalle). */
  exportOnePdf(): void {
    const d = this.detail();
    if (!d) return;
    exportCashSessionPdf(d as any, this.meta());
    this.notify.success('Arqueo descargado', { description: d.code });
  }

  /** PDF de un turno desde la tabla: la fila no trae conteos ni movimientos,
   *  así que primero se pide el detalle completo. */
  rowPdfBusy = signal<number | null>(null);
  exportRowPdf(row: CashSession): void {
    this.rowPdfBusy.set(row.id);
    this.cash.get(row.id).subscribe({
      next: full => {
        this.rowPdfBusy.set(null);
        exportCashSessionPdf(full as any, this.meta());
        this.notify.success('Arqueo descargado', { description: full.code });
      },
      error: e => {
        this.rowPdfBusy.set(null);
        this.notify.fromServerError(e, 'No se pudo generar el arqueo.');
      },
    });
  }

  /** Archivo del turno abierto en el detalle, para el botón Compartir. */
  detailPdfBlob = (): Blob => cashSessionPdfBlob(this.detail() as any, this.meta());

  /** Archivo del período completo, para el "Compartir PDF" del menú Exportar. */
  sharePdfBlob = async (o: { logo: PdfLogo | null }): Promise<Blob> =>
    cashSessionsPdfBlob(await this.loadAllForExport() as any, this.meta(o.logo));

  shareText(): string {
    const d = this.detail();
    if (!d) return '';
    const estado = Math.abs(+d.difference) < 0.005 ? 'cuadrada' : `con diferencia de ${this.money(d.difference)}`;
    return `Arqueo de caja ${d.code} — ${d.branch_name} (${d.register_name || 'Caja'}). `
         + `Ventas ${this.money(d.sales_total)}, efectivo contado ${this.money(d.counted_amount)}: ${estado}.`;
  }

  private dayOf(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-EC');
  }
  private dateTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('es-EC');
  }

  money(v: string | number | null | undefined): string {
    return '$' + (+(v ?? 0)).toFixed(2);
  }
  diffClass(v: string | number | null | undefined): string {
    const n = +(v ?? 0);
    if (Math.abs(n) < 0.005) return 'text-emerald-600 dark:text-emerald-400';
    return n > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400';
  }
}
