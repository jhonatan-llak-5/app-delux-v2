import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Customer, CustomerService } from '@features/superadmin/services/customer.service';
import { Order, OrderService } from '@features/superadmin/services/order.service';

@Component({
  selector: 'dlx-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (customer(); as c) {
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <a routerLink="/app/admin/customers" class="hover:text-ink-950">Clientes</a>
        <i class="fa-solid fa-chevron-right text-[10px]"></i>
        <span class="uppercase tracking-widest font-semibold">{{ c.full_name }}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Perfil -->
        <div class="lg:col-span-1 space-y-4">
          <div class="card p-6 text-center">
            <div class="w-20 h-20 rounded-full grid place-items-center text-white font-bold text-2xl mx-auto mb-3"
                 [style.background]="avatarColor(c)">
              {{ initials(c.full_name) }}
            </div>
            <h1 class="text-xl font-bold tracking-tight">{{ c.full_name }}</h1>
            <p class="text-sm text-slate-500 mt-1">{{ c.email }}</p>
            @if (c.phone) {
              <p class="text-xs text-slate-500 mt-1">
                <i class="fa-solid fa-phone text-slate-400"></i> {{ c.phone }}
              </p>
            }
            @if (c.document_id) {
              <p class="text-xs text-slate-500 mt-1 font-mono">{{ c.document_id }}</p>
            }
            <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              Cliente desde {{ c.created_at | date:'mediumDate' }}
            </div>
          </div>

          <div class="card p-6 space-y-3">
            <h3 class="font-bold tracking-tight">Resumen</h3>
            <div class="flex justify-between items-baseline">
              <span class="text-xs text-slate-500 uppercase tracking-widest font-semibold">Órdenes</span>
              <span class="text-2xl font-bold">{{ c.total_orders }}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-xs text-slate-500 uppercase tracking-widest font-semibold">Total gastado</span>
              <span class="text-2xl font-bold text-emerald-600">\${{ (+(c.total_spent || 0)).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-xs text-slate-500 uppercase tracking-widest font-semibold">Última compra</span>
              <span class="text-sm font-semibold">{{ c.last_order_at ? (c.last_order_at | date:'shortDate') : '—' }}</span>
            </div>
            @if (c.accepts_marketing) {
              <div class="pt-3 border-t border-slate-100">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <i class="fa-solid fa-envelope"></i> Suscrito a marketing
                </span>
              </div>
            }
          </div>

          @if (c.addresses.length) {
            <div class="card p-6">
              <h3 class="font-bold tracking-tight mb-3">Direcciones</h3>
              <ul class="space-y-2">
                @for (a of c.addresses; track a.id) {
                  <li class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-600">{{ a.label }}</p>
                    <p class="text-sm mt-1">{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}</p>
                    <p class="text-xs text-slate-500">{{ a.city }}, {{ a.country }}</p>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <!-- Órdenes -->
        <div class="lg:col-span-2">
          <div class="card overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100">
              <h2 class="font-bold tracking-tight">Historial de compras ({{ orders().length }})</h2>
            </div>
            @if (orders().length === 0) {
              <div class="p-12 text-center text-slate-400">
                <i class="fa-solid fa-cart-arrow-down text-3xl mb-3"></i>
                <p>Este cliente aún no ha hecho compras.</p>
              </div>
            } @else {
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-500">
                  <tr class="text-left">
                    <th class="px-5 py-3 font-semibold">Voucher</th>
                    <th class="px-5 py-3 font-semibold">Fecha</th>
                    <th class="px-5 py-3 font-semibold">Sucursal</th>
                    <th class="px-5 py-3 font-semibold text-center">Items</th>
                    <th class="px-5 py-3 font-semibold text-right">Total</th>
                    <th class="px-5 py-3 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of orders(); track o.id) {
                    <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                      <td class="px-5 py-3">
                        <a [routerLink]="['/app/admin/sales', o.id]" class="font-mono text-xs font-semibold text-violet-600 hover:underline">
                          {{ o.code }}
                        </a>
                      </td>
                      <td class="px-5 py-3 text-xs text-slate-600">{{ o.created_at | date:'short' }}</td>
                      <td class="px-5 py-3 text-xs">{{ o.branch_name }}</td>
                      <td class="px-5 py-3 text-center text-xs">{{ o.items_count }}</td>
                      <td class="px-5 py-3 text-right font-bold">\${{ o.total }}</td>
                      <td class="px-5 py-3 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                              [ngClass]="statusClass(o.status)">
                          {{ statusLabel(o.status) }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    }
  `,
})
export class CustomerDetailComponent implements OnInit {
  private svc = inject(CustomerService);
  private ordSvc = inject(OrderService);
  private route = inject(ActivatedRoute);

  customer = signal<Customer | null>(null);
  orders = signal<Order[]>([]);

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.svc.get(id).subscribe(c => this.customer.set(c));
    // Filtrar órdenes por customer: usamos search por email para simplificar
    // (idealmente añadir filtro customer al backend)
    this.ordSvc.list().subscribe(r => {
      this.orders.set(r.results.filter(o => o.customer === id));
    });
  }

  initials(n: string) { return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'; }
  avatarColor(c: Customer) {
    const palette = ['#7c3aed', '#22d3ee', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'];
    return palette[c.id % palette.length];
  }
  statusLabel(s: string) {
    return ({ PENDING: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Cancelada' } as any)[s] || s;
  }
  statusClass(s: string) {
    return ({
      PAID: 'bg-emerald-100 text-emerald-700',
      PENDING: 'bg-amber-100 text-amber-700',
      CANCELLED: 'bg-rose-100 text-rose-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }
}
