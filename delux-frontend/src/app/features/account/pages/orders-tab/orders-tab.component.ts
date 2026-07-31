import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MeService } from '@features/account/services/me.service';

/** Un pedido individual del perfil (incluye group_code para agrupar compras multi-sucursal). */
export interface ProfileOrder {
  id: number;
  code: string;
  group_code?: string;
  created_at: string;
  branch_name: string;
  status: string;
  fulfillment: string;
  items: { id: number; product_image: string; product_name: string }[];
  items_count: number;
  total: string;
}

@Component({
  selector: 'dlx-orders-tab',
  standalone: true,
  imports: [
    DlxEmptyStateComponent, OrderStatusLabelPipe, OrderStatusClassPipe,
    DlxSearchInputComponent, DlxPaginationComponent, CommonModule, RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <i class="fa-solid fa-receipt"></i>
            <span class="uppercase tracking-widest font-semibold">Mi cuenta</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mis compras</h1>
          <p class="text-slate-500 text-sm mt-1">{{ orders().length }} órdenes registradas.</p>
        </div>
        @if (orders().length > 0) {
          <dlx-search-input [value]="search()" (valueChange)="onSearch($event)"
                            placeholder="Buscar por voucher o producto…" class="w-full sm:w-auto sm:min-w-72" />
        }
      </div>

      @if (loading()) {
        <div class="text-center py-10">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-ink-400 dark:text-white/40"></i>
        </div>
      } @else if (orders().length === 0) {
        <dlx-empty-state variant="store" icon="fa-cart-arrow-down" title="Aún no has hecho compras.">
          <a routerLink="/shop" class="btn-accent text-sm font-semibold px-6 py-3">
            Explorar catálogo
          </a>
        </dlx-empty-state>
      } @else {
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                <tr class="text-left">
                  <th class="px-4 py-3 font-semibold">Voucher</th>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                  <th class="px-4 py-3 font-semibold">Sucursal</th>
                  <th class="px-4 py-3 font-semibold text-center">Artículos</th>
                  <th class="px-4 py-3 font-semibold text-right">Total</th>
                  <th class="px-4 py-3 font-semibold text-center">Estado</th>
                  <th class="px-4 py-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (o of paged(); track o.id) {
                  <tr class="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/5">
                    <td class="px-4 py-2.5 whitespace-nowrap">
                      <span class="font-mono text-xs font-semibold">{{ o.code }}</span>
                      @if (o.group_code) {
                        <span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold
                                     bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                              title="Parte de una compra multi-sucursal">
                          <i class="fa-solid fa-boxes-stacked text-[9px]"></i> multi-sucursal
                        </span>
                      }
                    </td>
                    <td class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ o.created_at | date:'short' }}</td>
                    <td class="px-4 py-2.5 text-xs">{{ o.branch_name || '—' }}</td>
                    <td class="px-4 py-2.5 text-center">{{ o.items_count || o.items.length }}</td>
                    <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap">\${{ o.total }}</td>
                    <td class="px-4 py-2.5 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                            [ngClass]="o.status | orderStatusClass">
                        {{ o.status | orderStatusLabel }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">
                      @if (o.fulfillment === 'SHIPPING') {
                        <a [routerLink]="['/tracking', o.code]"
                           class="inline-flex items-center gap-2 text-xs font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300">
                          <i class="fa-solid fa-truck-fast"></i> Seguir mi pedido
                        </a>
                      } @else {
                        <span class="text-slate-400 dark:text-white/30">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (filtered().length === 0) {
            <dlx-empty-state icon="fa-magnifying-glass" title="Sin resultados para tu búsqueda." />
          }
        </div>

        @if (filtered().length > 0) {
          <dlx-pagination [page]="page()" [pageSize]="pageSize()" [total]="filtered().length"
                          (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
        }
      }
    </div>
  `,
})
export class OrdersTabComponent implements OnInit {
  private me = inject(MeService);
  orders = signal<ProfileOrder[]>([]);
  loading = signal(true);
  search = signal('');
  page = signal(1);
  pageSize = signal(25);

  /** Filtra por voucher, sucursal y nombre de producto (client-side). */
  filtered = computed<ProfileOrder[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.orders();
    return this.orders().filter(o =>
      o.code.toLowerCase().includes(q) ||
      (o.branch_name || '').toLowerCase().includes(q) ||
      (o.items || []).some(it => (it.product_name || '').toLowerCase().includes(q)),
    );
  });

  /** Página actual sobre el resultado filtrado. */
  paged = computed<ProfileOrder[]>(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.me.orders().subscribe({
      next: r => { this.orders.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.page.set(1); }
  onPage(p: number) { this.page.set(p); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); }
}
