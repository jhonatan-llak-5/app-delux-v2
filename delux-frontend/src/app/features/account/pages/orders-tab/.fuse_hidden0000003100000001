import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MeService } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-orders-tab',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
        <div class="text-center py-12">
          <i class="fa-solid fa-cart-arrow-down text-4xl text-ink-300 dark:text-white/30 mb-3"></i>
          <p class="text-ink-700 dark:text-white/70 mb-4">Aún no has hecho compras.</p>
          <a routerLink="/shop" class="btn-accent text-sm font-semibold px-6 py-3">
            Explorar catálogo
          </a>
        </div>
      } @else {
        <ul class="space-y-4">
          @for (o of orders(); track o.id) {
            <li class="p-5 rounded-xl border border-ink-200 dark:border-white/10">
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
                      [ngClass]="statusClass(o.status)">
                  {{ statusLabel(o.status) }}
                </span>
              </div>

              <div class="flex gap-2 overflow-x-auto pb-2 mb-2">
                @for (it of o.items.slice(0, 6); track it.id) {
                  <img [src]="it.product_image" [alt]="it.product_name"
                       class="w-16 h-16 rounded-lg object-cover bg-ink-100 dark:bg-white/5 shrink-0"
                       crossorigin="anonymous" (error)="onImgErr($event)" />
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
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class OrdersTabComponent implements OnInit {
  private me = inject(MeService);
  orders = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.me.orders().subscribe({
      next: r => { this.orders.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(s: string) {
    return ({ PENDING: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Cancelada', REFUNDED: 'Devuelta', READY: 'Listo', SHIPPED: 'Enviado', DELIVERED: 'Entregado' } as any)[s] || s;
  }
  statusClass(s: string) {
    return ({
      PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    } as any)[s] || 'bg-ink-100 text-ink-700 dark:bg-white/10 dark:text-white/70';
  }
  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
