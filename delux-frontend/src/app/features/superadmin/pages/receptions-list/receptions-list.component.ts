import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService, ReceptionResult } from '@features/superadmin/services/inventory.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { printProductLabels } from '@shared/utils/print-labels';

@Component({
  selector: 'dlx-receptions-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, CommonModule, RouterLink, DatePipe, DlxExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Historial de recepciones</h1>
        <p class="text-slate-500 text-sm mt-1">Todas las recepciones de mercadería confirmadas.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-sm" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
        <dlx-export-menu [columns]="exportColumns" [rows]="receptions()" filename="recepciones" title="Historial de recepciones" orientation="l" />
        <a routerLink="/app/admin/inventory/reception" class="eg-btn-primary text-sm"><i class="fa-solid fa-plus"></i> Nueva recepción</a>
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
                <th class="px-4 py-3"></th>
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
                  <td class="px-4 py-2.5 text-right whitespace-nowrap">
                    <button class="text-slate-400 hover:text-[var(--dash-primary)] mr-3" (click)="openDetail(r)" title="Ver detalle">
                      <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                    <button class="text-slate-400 hover:text-[var(--dash-primary)]" (click)="printLabels(r)" title="Reimprimir etiquetas">
                      <i class="fa-solid fa-print text-xs"></i>
                    </button>
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
              <div class="flex items-center gap-3 shrink-0">
                <button (click)="openDetail(r)" class="text-slate-400"><i class="fa-solid fa-eye text-xs"></i></button>
                <button (click)="printLabels(r)" class="text-slate-400"><i class="fa-solid fa-print text-xs"></i></button>
              </div>
            </div>
            <div class="text-xs text-slate-500 mt-2">{{ r.items_count ?? r.items.length }} productos · <span class="font-semibold">{{ r.total_units }}</span> uds</div>
          </div>
        }
      </div>
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

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.inv.listReceptions().subscribe({
      next: r => { this.receptions.set(r.results); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.error(parseApiError(e).message || 'No se pudieron cargar las recepciones.'); },
    });
  }

  openDetail(r: ReceptionResult): void { this.detail.set(r); }
  money(v: any): string { return '$' + (Math.round((+v || 0) * 100) / 100).toFixed(2); }

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
