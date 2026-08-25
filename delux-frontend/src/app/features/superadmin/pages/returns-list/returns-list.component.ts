import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReturnsService, SaleChange } from '@shared/services/returns.service';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { BranchContextService } from '@core/services/branch-context.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-returns-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, RouterLink, DlxPaginationComponent],
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
          <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
            <tr class="text-left">
              <th class="px-4 py-3 font-semibold">Código</th>
              <th class="px-4 py-3 font-semibold">Venta</th>
              <th class="px-4 py-3 font-semibold">Devolvió → Se llevó</th>
              <th class="px-4 py-3 font-semibold text-right">Diferencia</th>
              @if (showBranchCol()) {
                <th class="px-4 py-3 font-semibold">Sucursal</th>
              }
              <th class="px-4 py-3 font-semibold">Registrado por</th>
              <th class="px-4 py-3 font-semibold">Fecha</th>
              <th class="px-4 py-3 font-semibold text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr class="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/[0.04] transition-colors"
                  [class.opacity-50]="c.annulled">
                <td class="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200">
                  {{ c.code }}
                  @if (c.annulled) {
                    <span class="block mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 line-through-none">Anulado</span>
                  }
                </td>
                <td class="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">{{ c.order_code }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      <i class="fa-solid fa-arrow-left text-[10px]"></i>{{ c.quantity }}× {{ c.product_name }}
                    </span>
                    @if (c.delivered_summary) {
                      <i class="fa-solid fa-arrow-right text-slate-300 dark:text-slate-600 text-[10px]"></i>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {{ c.delivered_summary }}
                      </span>
                    }
                  </div>
                  @if (c.descripcion) { <p class="text-[11px] text-slate-400 mt-1 italic">{{ c.descripcion }}</p> }
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  @if (+(c.difference || 0) > 0) {
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">+\${{ c.difference | number:'1.2-2' }}</span>
                    <span class="block text-[10px] text-slate-400">cliente pagó</span>
                  } @else if (+(c.difference || 0) < 0) {
                    <span class="font-bold text-rose-600 dark:text-rose-400">-\${{ -(+(c.difference || 0)) | number:'1.2-2' }}</span>
                    <span class="block text-[10px] text-slate-400">devuelto</span>
                  } @else {
                    <span class="text-slate-400">—</span>
                  }
                </td>
                @if (showBranchCol()) {
                  <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{{ c.branch_name || '—' }}</td>
                }
                <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{{ c.actor_name || '—' }}</td>
                <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ c.created_at | date:'dd/MM/yyyy' }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-1">
                    <a [routerLink]="['/app/admin/sales', c.order]"
                       class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                       title="Ir a la venta">
                      <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver venta
                    </a>
                    @if (!c.annulled) {
                      <button type="button" (click)="undo(c)" [disabled]="undoing() === c.id"
                              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-40"
                              title="Deshacer el cambio (revierte stock y balance)">
                        @if (undoing() === c.id) { <i class="fa-solid fa-spinner fa-spin"></i> }
                        @else { <i class="fa-solid fa-rotate-left"></i> }
                        Deshacer
                      </button>
                    }
                  </div>
                </td>
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
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);

  items = signal<SaleChange[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(25);
  search = signal('');
  undoing = signal<number | null>(null);

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
    return this.items()
      .filter(c => !c.annulled)
      .reduce((sum, c) => sum + (+c.valor_devuelto || 0), 0).toFixed(2);
  }

  /** Deshace un cambio: revierte stock + balance y lo marca anulado (con rastro). */
  async undo(c: SaleChange) {
    const ok = await this.confirm.ask({
      title: `Deshacer cambio ${c.code}`,
      message: 'Se revertirá el stock (lo devuelto sale, lo entregado vuelve a entrar) y la diferencia en el balance. El registro no se borra: queda marcado como anulado para auditoría. ¿Continuar?',
      confirmText: 'Sí, deshacer',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    this.undoing.set(c.id);
    this.svc.undoChange(c.id).subscribe({
      next: () => { this.undoing.set(null); this.notify.success('Cambio deshecho'); this.reload(); },
      error: e => { this.undoing.set(null); this.notify.fromServerError(e, 'No se pudo deshacer el cambio.'); },
    });
  }
}
