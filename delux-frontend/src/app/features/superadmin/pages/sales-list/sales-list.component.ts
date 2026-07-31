import { ChangeDetectionStrategy, Component, OnInit, inject, signal, effect} from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { firstValueFrom } from 'rxjs';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { Order, OrderService, OrderSummary } from '@features/superadmin/services/order.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';

@Component({
  selector: 'dlx-sales-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, OrderStatusLabelPipe, OrderStatusClassPipe, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, RowActionsComponent, DlxPaginationComponent, DlxExportMenuComponent],
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
      <div class="flex items-center gap-2">
        <dlx-export-menu [columns]="exportColumns" [rows]="orders()" [loader]="fetchAllForExport"
                         filename="ventas" title="Historial de ventas" orientation="l" />
        <a routerLink="/app/admin/pos"
           class="px-4 py-2.5 rounded-lg bg-[#1e40af] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition flex items-center gap-2">
          <i class="fa-solid fa-cash-register"></i> Nueva venta POS
        </a>
      </div>
    </div>

    @if (summary()) {
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <dlx-stat-card label="Hoy" [value]="summary()!.today_orders" icon="fa-calendar-day" [sub]="'$' + summary()!.today_revenue" />
        <dlx-stat-card label="Total órdenes" [value]="summary()!.total_orders" icon="fa-receipt" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
        <dlx-stat-card label="Revenue total" [value]="'$' + summary()!.total_revenue" icon="fa-sack-dollar" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
        <dlx-stat-card label="Pendientes" [value]="summary()!.pending" icon="fa-clock" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      </div>
    }

    <!-- Tabs de canal -->
    <div class="flex gap-1 mb-4 border-b border-slate-200 dark:border-white/10">
      @for (t of channelTabs; track t.value) {
        <button type="button" (click)="setChannel(t.value)"
                class="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition"
                [ngClass]="channelFilter === t.value
                  ? 'border-[var(--dash-primary)] text-[var(--dash-primary-d)] dark:text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-white/80'">
          <i class="fa-solid mr-1.5" [ngClass]="t.icon"></i> {{ t.label }}
        </button>
      }
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por código, cliente..." class="flex-1 min-w-64" />
      <select [(ngModel)]="statusFilter" (change)="onFilter()"
              class="eg-input border-transparent">
        <option value="">Todos los estados</option>
        <option value="PENDING">Pendientes</option>
        <option value="PAID">Pagadas</option>
        <option value="CANCELLED">Canceladas</option>
        <option value="REFUNDED">Devueltas</option>
      </select>
      <label class="flex items-center gap-2 px-3 h-11 rounded-lg cursor-pointer select-none transition text-sm font-semibold border"
             [ngClass]="onlyMine()
                ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'">
        <input type="checkbox" class="sr-only" [checked]="onlyMine()" (change)="toggleMine()" />
        <i class="fa-solid" [class.fa-square-check]="onlyMine()" [class.fa-square]="!onlyMine()"></i>
        Solo mis ventas
      </label>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>
      } @else if (orders().length === 0) {
        <dlx-empty-state icon="fa-receipt" title="No hay ventas registradas con esos filtros." />
      } @else {
        <div class="overflow-x-auto">
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
              <th class="px-5 py-3 font-semibold text-center">Factura</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 font-mono text-xs font-semibold whitespace-nowrap">{{ o.code }}</td>
                <td class="px-5 py-3 text-xs text-slate-600">{{ o.created_at | date:'short' }}</td>
                <td class="px-5 py-3 text-xs">{{ o.branch_name }}</td>
                <td class="px-5 py-3 text-xs">
                  @if (o.customer_name) {
                    <p>{{ o.customer_name }}</p>
                    @if (o.customer_email || o.customer_phone) {
                      <div class="flex items-center gap-2.5 mt-1 text-slate-400">
                        @if (o.customer_email) {
                          <a [href]="'mailto:' + o.customer_email" [title]="o.customer_email"
                             class="hover:text-sky-500"><i class="fa-solid fa-envelope"></i></a>
                        }
                        @if (o.customer_phone) {
                          <a [href]="'tel:' + o.customer_phone" [title]="o.customer_phone"
                             class="hover:text-sky-500"><i class="fa-solid fa-phone"></i></a>
                          <a [href]="waLink(o.customer_phone)" target="_blank" rel="noopener" [title]="'WhatsApp ' + o.customer_phone"
                             class="hover:text-emerald-500"><i class="fa-brands fa-whatsapp"></i></a>
                        }
                      </div>
                    }
                  } @else { — }
                </td>
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
                  @if (+(o.total_changes || 0) > 0) {
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                          title="Esta venta tiene un cambio/devolución registrado">
                      Devuelta
                    </span>
                  } @else {
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                          [ngClass]="o.status | orderStatusClass">
                      {{ o.status | orderStatusLabel }}
                    </span>
                  }
                </td>
                <td class="px-5 py-3 text-center">
                  @if (o.invoice_status && o.invoice_status !== 'NOT_ISSUED') {
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                          [ngClass]="invoiceClass(o.invoice_status)" [title]="o.invoice_number || ''">
                      {{ invoiceLabel(o.invoice_status) }}
                    </span>
                  } @else {
                    <span class="text-slate-300 text-xs">—</span>
                  }
                </td>
                <td class="px-5 py-3 text-right">
                  <dlx-row-actions [actions]="rowActions(o)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>
      }
    </div>

    @if (!loading() && total() > 0) {
      <dlx-pagination [page]="page()" [pageSize]="pageSize()" [total]="total()"
                      (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
    }

    <!-- Modal: cancelar venta con motivo + devolver stock (POS y web) -->
    @if (cancelOrder(); as co) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
           (click)="cancelOrder.set(null)">
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
             (click)="$event.stopPropagation()">
          <div class="p-5 border-b border-slate-100 dark:border-white/10">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-solid fa-ban text-rose-500"></i> Cancelar venta {{ co.code }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Anula la venta internamente. La nota de crédito, si aplica, se emite aparte en NovaFactura.
            </p>
          </div>
          <div class="p-5 space-y-4">
            <label class="block">
              <span class="eg-label">Motivo <span class="text-rose-400">*</span></span>
              <select class="eg-input" [(ngModel)]="cancelReason">
                <option value="">Selecciona un motivo…</option>
                <option value="Devolución">Devolución</option>
                <option value="Producto defectuoso">Producto defectuoso</option>
                <option value="Error de registro">Error de registro</option>
                <option value="Cliente se arrepintió">Cliente se arrepintió</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            @if (cancelReason === 'Otro') {
              <input class="eg-input" [(ngModel)]="cancelDetail" placeholder="Describe el motivo…" />
            }
            <label class="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="cancelRestoreStock" class="w-4 h-4 mt-0.5" />
              <span class="text-sm text-slate-700 dark:text-slate-200">
                Devolver los productos al inventario
                <span class="block text-[11px] text-slate-400">Actívalo si la mercadería vuelve al stock (no la marques si está defectuosa o no revendible).</span>
              </span>
            </label>
          </div>
          <div class="p-5 pt-0 flex gap-2">
            <button (click)="confirmCancel()" [disabled]="!effectiveCancelReason() || cancelling()"
                    class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition">
              @if (cancelling()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-ban"></i> }
              Cancelar venta
            </button>
            <button (click)="cancelOrder.set(null)" [disabled]="cancelling()"
                    class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold transition">
              Volver
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: registrar cambio (reutiliza el flujo del detalle de venta) -->
    @if (changeOpen()) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
           (click)="cancelChange()">
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-[#121826] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
             (click)="$event.stopPropagation()">
          @if (changeLoading()) {
            <div class="p-12 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
              <p class="text-xs mt-2">Cargando venta…</p>
            </div>
          } @else if (changeOrder(); as o) {
            <div class="p-6 space-y-4">
              <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-600 grid place-items-center">
                <i class="fa-solid fa-right-left text-xl"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold tracking-tight">Registrar cambio {{ o.code }}</h3>
                <p class="text-slate-500 text-sm mt-1">
                  El producto vuelve al stock y el total neto de la venta baja. La venta no se anula.
                </p>
              </div>

              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Producto que se devuelve</label>
                <select [ngModel]="changeItemId()" (ngModelChange)="onChangeItem(+$event)"
                        class="eg-input mt-1 w-full text-sm">
                  <option [ngValue]="null" disabled>Selecciona un ítem…</option>
                  @for (it of o.items; track it.id) {
                    <option [ngValue]="it.id">{{ it.product_name }} · {{ it.size }}/{{ it.color }} · x{{ it.quantity }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Cantidad</label>
                  <input type="number" min="1" [max]="changeMaxQty()" [ngModel]="changeQty()" (ngModelChange)="changeQty.set(+$event)"
                         class="eg-input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Tipo (automático)</label>
                  <div class="eg-input mt-1 w-full text-sm flex items-center font-semibold"
                       [class.text-amber-600]="changeTipoAuto() === 'TOTAL'">
                    {{ changeTipoAutoLabel() }}
                  </div>
                </div>
              </div>

              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Valor devuelto</label>
                <input type="number" min="0.01" step="0.01" [max]="changeTotalNum()" [ngModel]="changeValue()" (ngModelChange)="changeValue.set(+$event)"
                       class="eg-input mt-1 w-full text-sm" />
                <p class="text-[11px] text-slate-400 mt-1">Mayor a $0 y hasta \${{ changeTotalNum() | number:'1.2-2' }} (total de la venta).</p>
                @if (changeValue() > changeTotalNum()) {
                  <p class="text-[11px] text-rose-500 mt-1">No puede superar el total de la venta.</p>
                }
              </div>

              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Descripción / motivo</label>
                <textarea [ngModel]="changeDesc()" (ngModelChange)="changeDesc.set($event)" rows="3" maxlength="500"
                          placeholder="Ej: talla equivocada / producto defectuoso…"
                          class="eg-input mt-1 w-full resize-none text-sm"></textarea>
              </div>
            </div>
            <div class="p-5 pt-0 flex gap-2 justify-end">
              <button (click)="cancelChange()" [disabled]="changeSaving()"
                      class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold transition">
                Cancelar
              </button>
              <button (click)="confirmChange()" [disabled]="changeItemId() === null || changeQty() < 1 || !changeValueValid() || changeSaving()"
                      class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition disabled:opacity-40 flex items-center gap-2">
                @if (changeSaving()) { <i class="fa-solid fa-spinner fa-spin"></i> }
                @else { <i class="fa-solid fa-right-left"></i> }
                Registrar cambio
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class SalesListComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(OrderService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private adminSvc = inject(AdminService);
  private branchCtx = inject(BranchContextService);
  private ready = false;
  constructor() {
    // El efecto se agenda y corre por primera vez DESPUES de ngOnInit; saltamos
    // esa primera ejecucion para no duplicar el reload inicial. Solo recarga
    // cuando el usuario cambia de sucursal en el selector global.
    let branchFirst = true;
    effect(() => {
      this.branchCtx.current();
      if (branchFirst) { branchFirst = false; return; }
      this.reload();
    }, { allowSignalWrites: true });
  }

  orders = signal<Order[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(25);
  branches = signal<AdminBranch[]>([]);
  summary = signal<OrderSummary | null>(null);
  loading = signal(true);

  search = signal('');
  branchFilter: number | null = null;
  statusFilter = '';
  channelFilter = '';
  onlyMine = signal(false);

  ngOnInit() {
    this.svc.summary().subscribe(s => this.summary.set(s));
    this.reload();
    this.ready = true;
  }

  reload() {
    this.loading.set(true);
    this.svc.list({
      search: this.search() || undefined,
      branch: this.branchCtx.current() || undefined,
      status: this.statusFilter || undefined,
      channel: this.channelFilter || undefined,
      mine: this.onlyMine() || undefined,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => { this.orders.set(r.results); this.total.set(r.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  channelTabs = [
    { value: '', label: 'Todas', icon: 'fa-list' },
    { value: 'WEB', label: 'Ventas web', icon: 'fa-globe' },
    { value: 'POS', label: 'Ventas POS', icon: 'fa-cash-register' },
  ];
  setChannel(c: string) { this.channelFilter = c; this.page.set(1); this.reload(); }
  onSearch(v: string) { this.search.set(v); this.page.set(1); this.reload(); }
  onFilter() { this.page.set(1); this.reload(); }
  toggleMine() { this.onlyMine.update(v => !v); this.page.set(1); this.reload(); }

  private statusEs(s: string): string {
    return ({ PENDING: 'Pendiente', PAID: 'Pagado', PREPARING: 'Preparando', READY: 'Listo',
      SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado', REFUNDED: 'Devuelto' } as any)[s] || s;
  }
  exportColumns: ExportColumn<Order>[] = [
    { header: 'Voucher', key: 'code' },
    { header: 'Fecha', key: o => new Date(o.created_at).toLocaleString('es-EC') },
    { header: 'Sucursal', key: 'branch_name' },
    { header: 'Cliente', key: o => o.customer_name || 'Mostrador' },
    { header: 'Vendedor', key: o => o.seller_name || 'Mostrador' },
    { header: 'Canal', key: 'channel' },
    { header: 'Items', key: 'items_count' },
    { header: 'Total', key: o => Number(o.total || 0).toFixed(2) },
    { header: 'Estado', key: o => this.statusEs(o.status) },
  ];
  fetchAllForExport = async (): Promise<Order[]> => {
    const r = await firstValueFrom(this.svc.list({
      search: this.search() || undefined,
      branch: this.branchCtx.current() || undefined,
      status: this.statusFilter || undefined,
      channel: this.channelFilter || undefined,
      mine: this.onlyMine() || undefined,
      page: 1, page_size: 2000,
    }));
    return r.results || [];
  };
  onPage(p: number) { this.page.set(p); this.reload(); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); this.reload(); }
  waLink(phone: string) { return 'https://wa.me/' + (phone || '').replace(/[^0-9]/g, ''); }

  invoiceLabel(s?: string): string {
    return ({ PROCESSING: 'Procesando', AUTHORIZED: 'Autorizada', REJECTED: 'Rechazada', ERROR: 'Error' } as any)[s || ''] || 'No emitida';
  }
  invoiceClass(s?: string): string {
    return ({
      PROCESSING: 'bg-amber-100 text-amber-700',
      AUTHORIZED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
      ERROR: 'bg-rose-100 text-rose-700',
    } as any)[s || ''] || 'bg-slate-100 text-slate-600';
  }


  /** Solo roles de gestión pueden registrar cambios / cancelar (no el vendedor). */
  canManage(): boolean {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  }

  rowActions(o: Order): RowAction[] {
    return [
      { label: 'Ver', icon: 'fa-eye', link: ['/app/admin/sales', o.id] },
      { label: 'Imprimir voucher', icon: 'fa-print', run: () => this.printVoucher(o) },
      { label: 'Registrar cambio', icon: 'fa-right-left', hidden: !this.canManage() || o.status !== 'PAID' || +(o.total_changes || 0) > 0, run: () => this.openChange(o) },
      { label: 'Cancelar venta', icon: 'fa-ban', variant: 'danger', hidden: !this.canManage() || o.status === 'CANCELLED' || o.status === 'REFUNDED', run: () => this.cancel(o) },
    ];
  }

  printVoucher(o: Order) {
    this.router.navigate(['/app/admin/sales', o.id, 'voucher']);
  }

  // ── Cancelar venta (modal con motivo + devolver stock) ──
  cancelOrder = signal<Order | null>(null);
  cancelReason = '';
  cancelDetail = '';
  cancelRestoreStock = false;
  cancelling = signal(false);

  /** Motivo final: si eligió "Otro", usa el detalle escrito. */
  effectiveCancelReason(): string {
    return this.cancelReason === 'Otro' ? this.cancelDetail.trim() : this.cancelReason;
  }

  cancel(o: Order) {
    this.cancelReason = '';
    this.cancelDetail = '';
    this.cancelRestoreStock = false;
    this.cancelOrder.set(o);
  }

  confirmCancel() {
    const o = this.cancelOrder();
    const reason = this.effectiveCancelReason();
    if (!o || !reason || this.cancelling()) return;
    this.cancelling.set(true);
    this.svc.cancel(o.id, reason, this.cancelRestoreStock).subscribe({
      next: r => {
        this.cancelling.set(false);
        this.cancelOrder.set(null);
        this.notify.success(r.restored_stock ? 'Venta cancelada y stock devuelto' : 'Venta cancelada');
        this.reload();
      },
      error: e => {
        this.cancelling.set(false);
        this.notify.fromServerError(e, 'No se pudo cancelar la venta.');
      },
    });
  }

  // ── Registrar cambio (mismo flujo que el detalle de la venta) ──
  changeOpen = signal(false);
  changeOrder = signal<Order | null>(null);
  changeLoading = signal(false);
  changeItemId = signal<number | null>(null);
  changeQty = signal(1);
  changeValue = signal(0);
  changeTipo = signal<'PARCIAL' | 'TOTAL'>('PARCIAL');
  changeDesc = signal('');
  changeSaving = signal(false);

  changeMaxQty(): number {
    const o = this.changeOrder();
    const it = o?.items?.find(i => i.id === this.changeItemId());
    return it ? it.quantity : 1;
  }
  changeTotalNum(): number { return +(this.changeOrder()?.total || 0); }
  changeTipoAuto(): 'TOTAL' | 'PARCIAL' { return this.changeValue() >= this.changeTotalNum() ? 'TOTAL' : 'PARCIAL'; }
  changeTipoAutoLabel(): string { return this.changeTipoAuto() === 'TOTAL' ? 'Total' : 'Parcial'; }
  changeValueValid(): boolean { const v = this.changeValue(); return v > 0 && v <= this.changeTotalNum(); }

  /** Abre el modal y carga el detalle de la venta para poblar los ítems. */
  openChange(o: Order) {
    this.changeItemId.set(null);
    this.changeQty.set(1);
    this.changeValue.set(0);
    this.changeTipo.set('PARCIAL');
    this.changeDesc.set('');
    this.changeOrder.set(null);
    this.changeOpen.set(true);
    this.changeLoading.set(true);
    this.svc.get(o.id).subscribe({
      next: full => { this.changeOrder.set(full); this.changeLoading.set(false); },
      error: e => {
        this.changeLoading.set(false);
        this.changeOpen.set(false);
        this.notify.fromServerError(e, 'No se pudo cargar la venta.');
      },
    });
  }

  cancelChange() { this.changeOpen.set(false); }

  onChangeItem(id: number) {
    const o = this.changeOrder();
    this.changeItemId.set(id);
    const it = o?.items?.find(i => i.id === id);
    if (it) {
      const sub = +it.subtotal || (+it.unit_price * it.quantity);
      this.changeValue.set(sub);
      this.changeQty.set(1);
    }
  }

  confirmChange() {
    const o = this.changeOrder();
    const itemId = this.changeItemId();
    if (!o || itemId == null) return;
    const qty = this.changeQty();
    const value = this.changeValue();
    if (qty < 1 || !this.changeValueValid()) return;
    this.changeSaving.set(true);
    this.svc.registerChange(o.id, {
      order_item_id: itemId,
      quantity: qty,
      valor_devuelto: value,
      tipo: this.changeTipoAuto(),
      descripcion: this.changeDesc().trim(),
    }).subscribe({
      next: () => {
        this.changeSaving.set(false);
        this.changeOpen.set(false);
        this.notify.success('Cambio registrado');
        this.reload();
      },
      error: e => { this.changeSaving.set(false); this.notify.fromServerError(e, 'No se pudo registrar el cambio.'); },
    });
  }
}
