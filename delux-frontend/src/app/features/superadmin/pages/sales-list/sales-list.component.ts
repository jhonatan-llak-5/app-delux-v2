import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Order, OrderService, OrderSummary } from '@features/superadmin/services/order.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';

@Component({
  selector: 'dlx-sales-list',
  standalone: true,
  imports: [DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, RowActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-receipt"></i>
          <span class="uppercase tracking-widest font-semibold">Operación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Ventas</h1>
        <p class="text-slate-500 text-sm mt-1">Historial de órdenes y vouchers.</p>
      </div>
      <a routerLink="/app/admin/pos"
         class="px-4 py-2.5 rounded-lg bg-[#1e40af] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition flex items-center gap-2">
        <i class="fa-solid fa-cash-register"></i> Nueva venta POS
      </a>
    </div>

    @if (summary()) {
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <dlx-stat-card label="Hoy" [value]="summary()!.today_orders" icon="fa-calendar-day" [sub]="'$' + summary()!.today_revenue" />
        <dlx-stat-card label="Total órdenes" [value]="summary()!.total_orders" icon="fa-receipt" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
        <dlx-stat-card label="Revenue total" [value]="'$' + summary()!.total_revenue" icon="fa-sack-dollar" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
        <dlx-stat-card label="Pendientes" [value]="summary()!.pending" icon="fa-clock" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      </div>
    }

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por código, cliente..." class="flex-1 min-w-64" />
      @if (auth.multiBranch()) {
        <select [(ngModel)]="branchFilter" (change)="reload()"
                class="eg-input border-transparent">
          <option [ngValue]="null">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
        </select>
      }
      <select [(ngModel)]="statusFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option value="">Todos los estados</option>
        <option value="PENDING">Pendientes</option>
        <option value="PAID">Pagadas</option>
        <option value="CANCELLED">Canceladas</option>
        <option value="REFUNDED">Devueltas</option>
      </select>
      <select [(ngModel)]="channelFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option value="">Todos los canales</option>
        <option value="POS">POS</option>
        <option value="WEB">Web</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>
      } @else if (orders().length === 0) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-receipt text-3xl mb-3"></i>
          <p>No hay ventas registradas con esos filtros.</p>
        </div>
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Voucher</th>
              <th class="px-5 py-3 font-semibold">Fecha</th>
              <th class="px-5 py-3 font-semibold">Sucursal</th>
              <th class="px-5 py-3 font-semibold">Cliente</th>
              <th class="px-5 py-3 font-semibold">Vendedor</th>
              <th class="px-5 py-3 font-semibold text-center">Canal</th>
              <th class="px-5 py-3 font-semibold text-center">Items</th>
              <th class="px-5 py-3 font-semibold text-right">Total</th>
              <th class="px-5 py-3 font-semibold text-center">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 font-mono text-xs font-semibold">{{ o.code }}</td>
                <td class="px-5 py-3 text-xs text-slate-600">{{ o.created_at | date:'short' }}</td>
                <td class="px-5 py-3 text-xs">{{ o.branch_name }}</td>
                <td class="px-5 py-3 text-xs">{{ o.customer_name || '—' }}</td>
                <td class="px-5 py-3 text-xs">{{ o.seller_name || 'Mostrador' }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                        [class.bg-violet-100]="o.channel === 'POS'"
                        [class.text-violet-700]="o.channel === 'POS'"
                        [class.bg-sky-100]="o.channel === 'WEB'"
                        [class.text-sky-700]="o.channel === 'WEB'">
                    {{ o.channel }}
                  </span>
                </td>
                <td class="px-5 py-3 text-center text-xs">{{ o.items_count }}</td>
                <td class="px-5 py-3 text-right font-bold">\${{ o.total }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                        [ngClass]="statusClass(o.status)">
                    {{ statusLabel(o.status) }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right">
                  <dlx-row-actions [actions]="rowActions(o)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class SalesListComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(OrderService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private adminSvc = inject(AdminService);

  orders = signal<Order[]>([]);
  branches = signal<AdminBranch[]>([]);
  summary = signal<OrderSummary | null>(null);
  loading = signal(true);

  search = signal('');
  branchFilter: number | null = null;
  statusFilter = '';
  channelFilter = '';
  private search$ = new Subject<void>();

  ngOnInit() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.svc.summary().subscribe(s => this.summary.set(s));
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.svc.list({
      search: this.search() || undefined,
      branch: this.branchFilter || undefined,
      status: this.statusFilter || undefined,
      channel: this.channelFilter || undefined,
    }).subscribe({
      next: r => { this.orders.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  statusLabel(s: string) {
    return ({
      PENDING: 'Pendiente', PAID: 'Pagada', PREPARING: 'Preparando',
      READY: 'Lista', SHIPPED: 'Enviada', DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada', REFUNDED: 'Devuelta',
    } as any)[s] || s;
  }
  statusClass(s: string) {
    return ({
      PAID: 'bg-emerald-100 text-emerald-700',
      PENDING: 'bg-amber-100 text-amber-700',
      CANCELLED: 'bg-rose-100 text-rose-700',
      REFUNDED: 'bg-rose-100 text-rose-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }

  rowActions(o: Order): RowAction[] {
    return [
      { label: 'Ver', icon: 'fa-eye', link: ['/app/admin/sales', o.id] },
      { label: 'Imprimir voucher', icon: 'fa-print', run: () => this.printVoucher(o) },
      { label: 'Cancelar venta', icon: 'fa-ban', variant: 'danger', hidden: o.status !== 'PAID', run: () => this.cancel(o) },
    ];
  }

  printVoucher(o: Order) {
    this.router.navigate(['/app/admin/sales', o.id, 'voucher']);
  }

  async cancel(o: Order) {
    const ok = await this.confirm.ask({
      title: 'Cancelar venta',
      message: `¿Cancelar la venta ${o.code}? Esta acción no devuelve el stock automáticamente.`,
      variant: 'danger', confirmText: 'Cancelar venta', cancelText: 'Volver',
    });
    if (!ok) return;
    this.svc.cancel(o.id).subscribe({
      next: () => { this.notify.success('Venta cancelada'); this.reload(); },
      error: e => this.notify.fromServerError(e, 'No se pudo cancelar la venta.'),
    });
  }
}
