import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn, PdfLogo } from '@shared/utils/export.util';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService, ReceptionResult, Supplier } from '@features/superadmin/services/inventory.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { printProductLabels } from '@shared/utils/print-labels';
import { exportReceptionsPdf, ReceptionReportRow } from '@shared/utils/reception-report.util';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';

@Component({
  selector: 'dlx-receptions-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, CommonModule, RouterLink, DatePipe, DlxExportMenuComponent, FormsModule, RowActionsComponent, DlxPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Historial de recepciones</h1>
        <p class="text-slate-500 text-sm mt-1">Todas las recepciones de mercadería confirmadas.</p>
      </div>
      <div class="flex gap-2">
        <dlx-export-menu [columns]="exportColumns" [rows]="receptions()" [pdfHandler]="onExportPdf"
                         filename="recepciones" title="Historial de recepciones" orientation="l" />
        <a routerLink="/app/admin/inventory/reception" class="eg-btn-primary text-sm"><i class="fa-solid fa-plus"></i> Nueva recepción</a>
      </div>
    </div>

    <!-- Filtros: fecha, usuario, proveedor -->
    <div class="card p-3 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Desde</label>
        <input type="date" [(ngModel)]="dateFrom" (ngModelChange)="reload()" class="eg-input !h-9 text-sm" />
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Hasta</label>
        <input type="date" [(ngModel)]="dateTo" (ngModelChange)="reload()" class="eg-input !h-9 text-sm" />
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Usuario</label>
        <select [(ngModel)]="userId" (ngModelChange)="reload()" class="eg-input !h-9 text-sm min-w-44">
          <option [ngValue]="null">Todos</option>
          @for (u of users(); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Proveedor</label>
        <select [(ngModel)]="supplierId" (ngModelChange)="reload()" class="eg-input !h-9 text-sm min-w-44">
          <option [ngValue]="null">Todos</option>
          @for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
        </select>
      </div>
      @if (dateFrom || dateTo || userId || supplierId) {
        <button class="btn-secondary text-sm !h-9" (click)="clearFilters()"><i class="fa-solid fa-xmark"></i> Limpiar</button>
      }
      <div class="ml-auto flex items-end gap-2">
        <button class="btn-secondary text-sm !h-9" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
      </div>
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (receptions().length === 0) {
      <dlx-empty-state icon="fa-truck-ramp-box" title="Aún no hay recepciones registradas.">
        <a routerLink="/app/admin/inventory/reception" class="eg-btn-primary"><i class="fa-solid fa-plus"></i> Registrar la primera</a>
      </dlx-empty-state>
    } @else {
      <!-- Tabla desktop -->
      <div class="card overflow-hidden hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
              <tr class="text-left">
                <th class="px-4 py-3 font-semibold">Código</th>
                <th class="px-4 py-3 font-semibold">Fecha</th>
                <th class="px-4 py-3 font-semibold">Proveedor</th>
                <th class="px-4 py-3 font-semibold">Sucursal</th>
                <th class="px-4 py-3 font-semibold text-center">Productos</th>
                <th class="px-4 py-3 font-semibold text-center">Unidades</th>
                <th class="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (r of receptions(); track r.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ r.code }}</td>
                  <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="px-4 py-2.5">{{ r.supplier_name || '—' }}</td>
                  <td class="px-4 py-2.5">{{ r.branch_name }}</td>
                  <td class="px-4 py-2.5 text-center">{{ r.items_count ?? r.items.length }}</td>
                  <td class="px-4 py-2.5 text-center font-semibold">{{ r.total_units }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <dlx-row-actions [actions]="rowActions(r)" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cards móvil -->
      <div class="md:hidden space-y-2">
        @for (r of receptions(); track r.id) {
          <div class="card p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-mono text-xs font-semibold">{{ r.code }}</p>
                <p class="text-xs text-slate-400">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }}</p>
                <p class="text-sm mt-1">{{ r.supplier_name || 'Sin proveedor' }} · {{ r.branch_name }}</p>
              </div>
              <div class="shrink-0">
                <dlx-row-actions [actions]="rowActions(r)" />
              </div>
            </div>
            <div class="text-xs text-slate-500 mt-2">{{ r.items_count ?? r.items.length }} productos · <span class="font-semibold">{{ r.total_units }}</span> uds</div>
          </div>
        }
      </div>

      @if (total() > pageSize()) {
        <dlx-pagination class="block mt-4" [page]="page()" [pageSize]="pageSize()" [total]="total()"
                        (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
      }
    }

    <!-- Detalle -->
    @if (detail(); as r) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl max-h-[88vh] overflow-y-auto"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <div>
              <h2 class="font-bold text-lg">{{ r.code }}</h2>
              <p class="text-xs text-slate-400">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }} · {{ r.branch_name }}</p>
            </div>
            <button class="text-slate-400 hover:text-slate-600" (click)="detail.set(null)"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="p-5 space-y-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Proveedor</p><p class="font-semibold truncate">{{ r.supplier_name || '—' }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Productos</p><p class="font-semibold">{{ r.items.length }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Unidades</p><p class="font-semibold">{{ r.total_units }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Registró</p><p class="font-semibold truncate">{{ r.created_by_name || '—' }}</p></div>
            </div>
            @if (r.note) { <p class="text-sm text-slate-500"><i class="fa-solid fa-note-sticky"></i> {{ r.note }}</p> }

            <div class="rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                  <tr class="text-left">
                    <th class="px-3 py-2 font-semibold">Producto</th>
                    <th class="px-3 py-2 font-semibold">Talla/Color</th>
                    <th class="px-3 py-2 font-semibold">Código</th>
                    <th class="px-3 py-2 font-semibold text-right">Costo</th>
                    <th class="px-3 py-2 font-semibold text-center">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of r.items; track it.id) {
                    <tr class="border-t border-slate-100 dark:border-white/5">
                      <td class="px-3 py-2">{{ it.product_name }}</td>
                      <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ it.size || '—' }} / {{ it.color || '—' }}</td>
                      <td class="px-3 py-2 font-mono text-xs">{{ it.variant_sku }}</td>
                      <td class="px-3 py-2 text-right">{{ money(it.unit_cost) }}</td>
                      <td class="px-3 py-2 text-center font-semibold">{{ it.quantity }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-white/10">
            <button class="btn-secondary" (click)="detail.set(null)">Cerrar</button>
            <button class="eg-btn-primary" (click)="printLabels(r)"><i class="fa-solid fa-print"></i> Reimprimir etiquetas</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReceptionsListComponent implements OnInit {
  private inv = inject(InventoryService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);

  receptions = signal<ReceptionResult[]>([]);
  exportColumns: ExportColumn<ReceptionResult>[] = [
    { header: 'Código', key: 'code' },
    { header: 'Proveedor', key: r => r.supplier_name || '—' },
    { header: 'Sucursal', key: 'branch_name' },
    { header: 'Unidades', key: 'total_units' },
    { header: 'Estado', key: r => r.status || '' },
    { header: 'Fecha', key: r => (r.created_at ? new Date(r.created_at).toLocaleDateString('es-EC') : '') },
  ];
  loading = signal(true);
  detail = signal<ReceptionResult | null>(null);

  // ── Filtros ──
  dateFrom = '';
  dateTo = '';
  userId: number | null = null;
  supplierId: number | null = null;
  users = signal<{ id: number; name: string }[]>([]);
  suppliers = signal<Supplier[]>([]);
  page = signal(1);
  pageSize = signal(25);
  total = signal(0);

  ngOnInit(): void {
    this.reload();
    this.inv.receptionUsers().subscribe({ next: u => this.users.set(u), error: () => {} });
    this.inv.listSuppliers().subscribe({ next: r => this.suppliers.set(r.results), error: () => {} });
  }

  /** Recarga desde la primera página (al cambiar filtros). */
  reload(): void { this.page.set(1); this.fetch(); }

  private fetch(): void {
    this.loading.set(true);
    this.inv.listReceptions({
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      created_by: this.userId ?? undefined,
      supplier: this.supplierId ?? undefined,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => { this.receptions.set(r.results); this.total.set(r.count); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.error(parseApiError(e).message || 'No se pudieron cargar las recepciones.'); },
    });
  }

  onPage(p: number): void { this.page.set(p); this.fetch(); }
  onSize(s: number): void { this.pageSize.set(s); this.page.set(1); this.fetch(); }

  clearFilters(): void {
    this.dateFrom = ''; this.dateTo = ''; this.userId = null; this.supplierId = null;
    this.reload();
  }

  /** Texto de filtros aplicados para el encabezado del PDF. */
  private filtersLabel(): string {
    const parts: string[] = [];
    if (this.userId) { const u = this.users().find(x => x.id === this.userId); if (u) parts.push(`Usuario: ${u.name}`); }
    if (this.supplierId) { const s = this.suppliers().find(x => x.id === this.supplierId); if (s) parts.push(`Proveedor: ${s.name}`); }
    return parts.join('   ·   ');
  }

  /** Genera el PDF detallado con el logo cargado por el export-menu. */
  onExportPdf = ({ logo, brandName }: { logo: PdfLogo | null; brandName: string }): void => {
    const recs = this.receptions();
    if (!recs.length) { this.notify.warning('No hay recepciones para exportar con esos filtros.'); return; }
    const rows: ReceptionReportRow[] = recs.map(r => {
      const items = (r.items || []).map(it => ({
        code: it.variant_sku,
        product: it.product_name,
        variant: [it.size, it.color].filter(Boolean).join(' / ') || '—',
        qty: +it.quantity || 0,
        unitCost: +it.unit_cost || 0,
      }));
      const totalCost = items.reduce((a, it) => a + it.qty * it.unitCost, 0);
      return {
        code: r.code,
        date: r.committed_at || r.created_at || '',
        supplier: r.supplier_name || '—',
        branch: r.branch_name,
        user: r.created_by_name || '—',
        items,
        totalUnits: r.total_units ?? items.reduce((a, it) => a + it.qty, 0),
        totalCost,
      };
    });
    exportReceptionsPdf({
      storeName: this.branding.siteName(),
      brandName,
      logo,
      range: { from: this.dateFrom, to: this.dateTo },
      filters: this.filtersLabel(),
      receptions: rows,
      grandUnits: rows.reduce((a, r) => a + r.totalUnits, 0),
      grandCost: rows.reduce((a, r) => a + r.totalCost, 0),
    });
  };

  openDetail(r: ReceptionResult): void { this.detail.set(r); }
  money(v: any): string { return '$' + (Math.round((+v || 0) * 100) / 100).toFixed(2); }

  /** Acciones de fila (mismo componente que Historial de ventas). */
  rowActions(r: ReceptionResult): RowAction[] {
    return [
      { label: 'Ver detalle', icon: 'fa-eye', run: () => this.openDetail(r) },
      { label: 'Reimprimir etiquetas', icon: 'fa-print', run: () => this.printLabels(r) },
    ];
  }

  printLabels(r: ReceptionResult): void {
    const items = r.items.map(it => ({
      sku: it.variant_sku,
      name: it.product_name,
      size: it.size,
      price: +it.price || 0,
      quantity: Math.max(1, it.quantity),
    }));
    printProductLabels(items, {
      store: this.branding.siteName(),
      onError: (m) => this.notify.error(m),
    });
  }
}
