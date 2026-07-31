import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { ReturnsService, SaleChange } from '@shared/services/returns.service';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { BranchContextService } from '@core/services/branch-context.service';

@Component({
  selector: 'dlx-returns-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, DlxPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <i class="fa-solid fa-rotate-left"></i>
        <span class="uppercase tracking-widest font-semibold">Post-venta</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Devoluciones</h1>
      <p class="text-slate-500 text-sm mt-1">Historial de cambios registrados en ventas.</p>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-6">
      <dlx-stat-card label="Cambios registrados" [value]="total()" icon="fa-right-left" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      <dlx-stat-card label="Valor devuelto (página)" [value]="'$' + valorTotal()" icon="fa-money-bill-transfer" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)"
                        placeholder="Buscar por venta o producto…" class="flex-1 min-w-64" />
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
            <tr class="text-left">
              <th class="px-4 py-3 font-semibold">Código</th>
              <th class="px-4 py-3 font-semibold">Venta</th>
              <th class="px-4 py-3 font-semibold">Producto</th>
              <th class="px-4 py-3 font-semibold">Detalle</th>
              <th class="px-4 py-3 font-semibold text-right">Valor</th>
              <th class="px-4 py-3 font-semibold text-center">Tipo</th>
              @if (showBranchCol()) {
                <th class="px-4 py-3 font-semibold">Sucursal</th>
              }
              <th class="px-4 py-3 font-semibold">Registrado por</th>
              <th class="px-4 py-3 font-semibold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr class="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/5">
                <td class="px-4 py-2.5 font-mono text-xs font-semibold whitespace-nowrap">{{ c.code }}</td>
                <td class="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{{ c.order_code }}</td>
                <td class="px-4 py-2.5">
                  <p class="font-semibold">
                    <span class="text-slate-500">{{ c.quantity }}×</span> {{ c.product_name }}
                    @if (c.size || c.color) {
                      <span class="text-slate-500">({{ c.size || '—' }}/{{ c.color || '—' }})</span>
                    }
                  </p>
                  @if (c.sku) { <p class="text-[11px] text-slate-500 font-mono mt-0.5">{{ c.sku }}</p> }
                </td>
                <td class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-xs">{{ c.descripcion || '—' }}</td>
                <td class="px-4 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">-\${{ c.valor_devuelto | number:'1.2-2' }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">{{ c.tipo_label }}</span>
                </td>
                @if (showBranchCol()) {
                  <td class="px-4 py-2.5 text-xs">{{ c.branch_name || '—' }}</td>
                }
                <td class="px-4 py-2.5 text-xs">{{ c.actor_name || '—' }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ c.created_at | date:'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (items().length === 0) {
        <dlx-empty-state icon="fa-right-left" title="No hay cambios registrados." />
      }
    </div>

    @if (total() > 0) {
      <dlx-pagination [page]="page()" [pageSize]="pageSize()" [total]="total()"
                      (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
    }
  `,
})
export class ReturnsListComponent implements OnInit {
  private svc = inject(ReturnsService);
  private branchCtx = inject(BranchContextService);

  items = signal<SaleChange[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(25);
  search = signal('');

  /** Oculta la columna Sucursal cuando el negocio tiene una sola sucursal. */
  // Solo muestra la columna Sucursal si el perfil ve/gestiona más de una sucursal.
  showBranchCol = computed(() => this.branchCtx.canSwitch() && this.branchCtx.branches().length > 1);

  ngOnInit() { this.reload(); }
  reload() {
    this.svc.listChanges({ search: this.search(), page: this.page(), page_size: this.pageSize() })
      .subscribe(r => { this.items.set(r.results); this.total.set(r.count); });
  }
  onSearch(v: string) { this.search.set(v); this.page.set(1); this.reload(); }
  onPage(p: number) { this.page.set(p); this.reload(); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); this.reload(); }

  valorTotal(): string {
    return this.items().reduce((sum, c) => sum + (+c.valor_devuelto || 0), 0).toFixed(2);
  }
}
