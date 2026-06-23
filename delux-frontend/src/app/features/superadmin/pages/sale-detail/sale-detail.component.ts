import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, OrderService } from '@features/superadmin/services/order.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';

@Component({
  selector: 'dlx-sale-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
                       crossorigin="anonymous" (error)="onImgErr($event)" />
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
            } @else {
              <p class="text-sm text-slate-400">Sin cliente asociado</p>
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
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.svc.get(id).subscribe(o => this.order.set(o));
  }

  print() { if (this.order()) generateVoucherPDF(this.order()!); }

  statusLabel(s: string) {
    return ({
      PENDING: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Cancelada', REFUNDED: 'Devuelta',
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

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
