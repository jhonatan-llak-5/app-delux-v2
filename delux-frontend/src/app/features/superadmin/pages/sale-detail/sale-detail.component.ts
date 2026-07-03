import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, OrderService } from '@features/superadmin/services/order.service';
import { environment } from '@env/environment';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-sale-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (order(); as o) {
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <a routerLink="/app/admin/sales" class="hover:text-ink-950">Ventas</a>
        <i class="fa-solid fa-chevron-right text-[10px]"></i>
        <span class="uppercase tracking-widest font-semibold">Detalle</span>
      </div>

      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ o.code }}</h1>
          <p class="text-slate-500 text-sm mt-1">
            {{ o.created_at | date:'fullDate' }} · {{ o.created_at | date:'shortTime' }}
          </p>
        </div>
        <div class="flex gap-2">
          <a routerLink="/app/admin/sales" class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
            <i class="fa-solid fa-arrow-left"></i> Volver
          </a>
          <a [routerLink]="['/app/admin/sales', o.id, 'voucher']"
                  class="px-4 py-2 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900">
            <i class="fa-solid fa-print"></i> Ver / imprimir voucher
          </a>
          <a [href]="receiptUrl(o.code)" target="_blank" rel="noopener"
                  class="px-4 py-2 rounded-lg bg-[var(--dash-primary)] text-white text-sm font-semibold hover:opacity-90">
            <i class="fa-solid fa-qrcode"></i> Comprobante (PDF)
          </a>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Items + totals -->
        <div class="lg:col-span-2 space-y-4">
          <div class="card overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100">
              <h2 class="font-bold tracking-tight">Items ({{ o.items.length }})</h2>
            </div>
            <ul class="divide-y divide-slate-100">
              @for (it of o.items; track it.id) {
                <li class="flex items-center gap-4 px-6 py-4">
                  <img [src]="it.product_image" [alt]="it.product_name"
                       class="w-16 h-16 rounded-lg object-cover bg-slate-100"
 (error)="onImgErr($event)" />
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm">{{ it.product_name }}</p>
                    <p class="text-xs text-slate-500 font-mono mt-0.5">
                      {{ it.sku }} · {{ it.size }} · {{ it.color }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-slate-500">{{ it.quantity }} × \${{ it.unit_price }}</p>
                    <p class="font-bold mt-0.5">\${{ it.subtotal }}</p>
                  </div>
                </li>
              }
            </ul>
            <div class="px-6 py-4 border-t border-slate-100 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-slate-500">Subtotal</span>
                <span class="font-semibold">\${{ o.subtotal }}</span>
              </div>
              @if (+o.discount > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-slate-500">Descuento</span>
                  <span class="font-semibold text-rose-600">-\${{ o.discount }}</span>
                </div>
              }
              <div class="flex justify-between pt-2 border-t border-slate-100">
                <span class="font-bold">TOTAL</span>
                <span class="text-2xl font-display font-bold">\${{ o.total }}</span>
              </div>
            </div>
          </div>

          @if (o.notes) {
            <div class="card p-5">
              <h3 class="font-semibold text-sm mb-2 flex items-center gap-2">
                <i class="fa-solid fa-note-sticky text-slate-400"></i> Notas
              </h3>
              <p class="text-sm text-slate-600">{{ o.notes }}</p>
            </div>
          }
        </div>

        <!-- Meta -->
        <div class="space-y-4">
          <div class="card p-5 space-y-3">
            <h3 class="font-bold tracking-tight mb-1">Información</h3>
            <div>
              <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Estado</p>
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase mt-1"
                    [ngClass]="statusClass(o.status)">
                {{ statusLabel(o.status) }}
              </span>
              @if (canManage() && !isFinal(o.status)) {
                <div class="mt-2 flex items-center gap-2">
                  <select [ngModel]="o.status" (ngModelChange)="changeStatus($event)" [disabled]="saving()"
                          class="eg-input text-xs !py-1.5 flex-1">
                    @for (st of statuses; track st.value) {
                      <option [value]="st.value">{{ st.label }}</option>
                    }
                  </select>
                  @if (saving()) { <i class="fa-solid fa-spinner fa-spin text-slate-400 text-xs"></i> }
                </div>
                <p class="text-[10px] text-slate-400 mt-1">Cambia el estado del pedido y notifica al equipo.</p>
              }
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Canal</p>
              <p class="font-semibold text-sm mt-0.5">{{ o.channel }}</p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Sucursal</p>
              <p class="font-semibold text-sm mt-0.5">
                <i class="fa-solid fa-location-dot text-slate-400"></i> {{ o.branch_name }}
              </p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Vendedor</p>
              <p class="font-semibold text-sm mt-0.5">{{ o.seller_name || '—' }}</p>
            </div>
          </div>

          <div class="card p-5">
            <h3 class="font-bold tracking-tight mb-3 flex items-center gap-2">
              <i class="fa-solid fa-user text-slate-400"></i> Cliente
            </h3>
            @if (o.customer_name) {
              <p class="font-semibold">{{ o.customer_name }}</p>
              @if (o.customer_document) {
                <p class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-id-card w-4 text-slate-400"></i> {{ o.customer_document }}</p>
              }
              @if (o.customer_email) {
                <p class="text-xs mt-1">
                  <i class="fa-solid fa-envelope w-4 text-slate-400"></i>
                  <a [href]="'mailto:' + o.customer_email" class="text-sky-600 hover:underline">{{ o.customer_email }}</a>
                </p>
              }
              @if (o.customer_phone) {
                <p class="text-xs mt-1 flex items-center gap-2">
                  <span><i class="fa-solid fa-phone w-4 text-slate-400"></i>
                    <a [href]="'tel:' + o.customer_phone" class="text-sky-600 hover:underline">{{ o.customer_phone }}</a>
                  </span>
                  <a [href]="waLink(o.customer_phone)" target="_blank" rel="noopener"
                     class="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp
                  </a>
                </p>
              }
              @if (!o.customer_email && !o.customer_phone) {
                <p class="text-xs text-slate-400 mt-1">Sin datos de contacto registrados.</p>
              }
            } @else {
              <p class="text-sm text-slate-400">Sin cliente asociado (venta de mostrador)</p>
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
export class SaleDetailComponent implements OnInit {
  private svc = inject(OrderService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  saving = signal(false);
  readonly statuses = [
    { value: 'PENDING',   label: 'Pendiente de pago' },
    { value: 'PAID',      label: 'Pagado' },
    { value: 'PREPARING', label: 'Preparando' },
    { value: 'READY',     label: 'Listo para retirar' },
    { value: 'SHIPPED',   label: 'Enviado' },
    { value: 'DELIVERED', label: 'Entregado' },
    { value: 'CANCELLED', label: 'Cancelado' },
    { value: 'REFUNDED',  label: 'Devuelto' },
  ];
  canManage() {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  }
  isFinal(s: string) { return s === 'CANCELLED' || s === 'REFUNDED'; }
  waLink(phone: string) {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    return 'https://wa.me/' + digits;
  }
  changeStatus(newStatus: string) {
    const o = this.order();
    if (!o || newStatus === o.status) return;
    this.saving.set(true);
    this.svc.setStatus(o.id, newStatus).subscribe({
      next: updated => { this.order.set(updated); this.saving.set(false); this.notify.success('Estado actualizado'); },
      error: e => { this.saving.set(false); this.notify.fromServerError(e, 'No se pudo cambiar el estado.'); },
    });
  }
  receiptUrl(code: string): string { return `${environment.apiUrl}/admin/checkout/receipt/${code}/`; }
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.svc.get(id).subscribe(o => this.order.set(o));
  }

  print() { if (this.order()) generateVoucherPDF(this.order()!); }

  statusLabel(s: string) {
    return ({
      PENDING: 'Pendiente', PAID: 'Pagada', PREPARING: 'Preparando', READY: 'Lista',
      SHIPPED: 'Enviada', DELIVERED: 'Entregada', CANCELLED: 'Cancelada', REFUNDED: 'Devuelta',
    } as any)[s] || s;
  }
  statusClass(s: string) {
    return ({
      PENDING:   'bg-amber-100 text-amber-700',
      PAID:      'bg-emerald-100 text-emerald-700',
      PREPARING: 'bg-blue-100 text-blue-700',
      READY:     'bg-indigo-100 text-indigo-700',
      SHIPPED:   'bg-cyan-100 text-cyan-700',
      DELIVERED: 'bg-teal-100 text-teal-700',
      CANCELLED: 'bg-rose-100 text-rose-700',
      REFUNDED:  'bg-rose-100 text-rose-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
