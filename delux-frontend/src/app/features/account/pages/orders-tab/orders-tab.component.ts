import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
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

/** Compra agrupada: los pedidos con el mismo group_code no vacío van juntos. */
export interface OrderGroup {
  key: string;
  group_code: string;
  orders: ProfileOrder[];
}

@Component({
  selector: 'dlx-orders-tab',
  standalone: true,
  imports: [DlxEmptyStateComponent, OrderStatusLabelPipe, OrderStatusClassPipe, ImgFallbackDirective, CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editorial-card p-6">
      <h2 class="font-display font-bold text-2xl text-ink-950 dark:text-white mb-2">Mis compras</h2>
      <p class="text-sm text-ink-700 dark:text-white/60 mb-6">{{ orders().length }} órdenes registradas.</p>

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
        <div class="space-y-6">
          @for (grp of grouped(); track grp.key) {
          <div [ngClass]="grp.group_code ? 'rounded-2xl border border-accent-500/30 bg-accent-50/40 dark:bg-accent-500/[0.06] p-4' : ''">
            @if (grp.group_code) {
              <div class="flex items-center gap-2 mb-3 px-1">
                <i class="fa-solid fa-boxes-stacked text-accent-600 dark:text-accent-400"></i>
                <h3 class="font-semibold text-ink-950 dark:text-white text-sm">
                  Compra {{ grp.group_code }} · {{ grp.orders.length }} paquetes
                </h3>
              </div>
            }
            <ul class="space-y-4">
          @for (o of grp.orders; track o.id) {
            <li class="p-5 rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-950">
              <div class="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-ink-100 dark:border-white/10">
                <div>
                  <p class="font-mono text-xs uppercase tracking-widest text-ink-500 dark:text-white/50">Voucher</p>
                  <p class="font-bold text-ink-950 dark:text-white">{{ o.code }}</p>
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50 font-semibold">Fecha</p>
                  <p class="text-xs text-ink-950 dark:text-white">{{ o.created_at | date:'medium' }}</p>
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50 font-semibold">Sucursal</p>
                  <p class="text-xs text-ink-950 dark:text-white">{{ o.branch_name }}</p>
                </div>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                      [ngClass]="o.status | orderStatusClass">
                  {{ o.status | orderStatusLabel }}
                </span>
              </div>

              <div class="flex gap-2 overflow-x-auto pb-2 mb-2">
                @for (it of o.items.slice(0, 6); track it.id) {
                  <img [src]="it.product_image" [alt]="it.product_name"
                       class="w-16 h-16 rounded-lg object-cover bg-ink-100 dark:bg-white/5 shrink-0"
 dlxImgFallback />
                }
                @if (o.items.length > 6) {
                  <div class="w-16 h-16 rounded-lg bg-ink-100 dark:bg-white/5 grid place-items-center text-xs font-bold text-ink-500 dark:text-white/50 shrink-0">
                    +{{ o.items.length - 6 }}
                  </div>
                }
              </div>

              <div class="flex items-baseline justify-between">
                <span class="text-sm text-ink-700 dark:text-white/70">{{ o.items_count }} artículo(s)</span>
                <span class="font-display text-2xl font-bold text-ink-950 dark:text-white">
                  \${{ o.total }}
                </span>
              </div>

              @if (o.fulfillment === 'SHIPPING') {
                <div class="mt-3 pt-3 border-t border-ink-100 dark:border-white/10 flex justify-end">
                  <a [routerLink]="['/tracking', o.code]"
                     class="inline-flex items-center gap-2 text-sm font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300">
                    <i class="fa-solid fa-truck-fast"></i> Seguir mi pedido
                  </a>
                </div>
              }
            </li>
          }
            </ul>
          </div>
          }
        </div>
      }
    </div>
  `,
})
export class OrdersTabComponent implements OnInit {
  private me = inject(MeService);
  orders = signal<ProfileOrder[]>([]);
  loading = signal(true);

  /** Agrupa los pedidos por group_code (los vacíos quedan como compras individuales). */
  grouped = computed<OrderGroup[]>(() => {
    const out: OrderGroup[] = [];
    const map = new Map<string, OrderGroup>();
    for (const o of this.orders()) {
      const gc = (o.group_code || '').trim();
      if (gc) {
        let g = map.get(gc);
        if (!g) { g = { key: gc, group_code: gc, orders: [] }; map.set(gc, g); out.push(g); }
        g.orders.push(o);
      } else {
        out.push({ key: 'single-' + o.id, group_code: '', orders: [o] });
      }
    }
    return out;
  });

  ngOnInit() {
    this.me.orders().subscribe({
      next: r => { this.orders.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

}
