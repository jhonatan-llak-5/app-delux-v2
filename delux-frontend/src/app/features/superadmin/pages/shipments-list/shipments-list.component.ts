import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShippingService, Shipment } from '@shared/services/shipping.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-shipments-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <i class="fa-solid fa-truck"></i>
        <span class="uppercase tracking-widest font-semibold">Operación</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Envíos</h1>
      <p class="text-slate-500 text-sm mt-1">Gestiona despachos y actualiza estados de entrega.</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3 mb-6">
      <dlx-stat-card label="Por preparar" [value]="countBy('CREATED') + countBy('PREPARING')" icon="fa-box-open" />
      <dlx-stat-card label="Enviados" [value]="countBy('SHIPPED')" icon="fa-truck-fast" iconBg="bg-sky-50 dark:bg-sky-500/15" iconColor="text-sky-600 dark:text-sky-400" />
      <dlx-stat-card label="En tránsito" [value]="countBy('IN_TRANSIT')" icon="fa-route" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
      <dlx-stat-card label="Entregados" [value]="countBy('DELIVERED')" icon="fa-circle-check" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Fallidos" [value]="countBy('FAILED')" icon="fa-triangle-exclamation" iconBg="bg-rose-50 dark:bg-rose-500/15" iconColor="text-rose-600 dark:text-rose-400" />
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search" (valueChange)="search = $event; reload()" placeholder="Buscar por tracking, orden, destinatario..." class="flex-1 min-w-64" />
      <select [(ngModel)]="statusFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent text-sm">
        <option value="">Todos los estados</option>
        <option value="CREATED">Creados</option>
        <option value="PREPARING">Preparando</option>
        <option value="SHIPPED">Enviados</option>
        <option value="IN_TRANSIT">En tránsito</option>
        <option value="DELIVERED">Entregados</option>
        <option value="FAILED">Fallidos</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      @if (items().length === 0) {
        <dlx-empty-state icon="fa-truck" title="No hay envíos registrados." />
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Tracking</th>
              <th class="px-5 py-3 font-semibold">Orden</th>
              <th class="px-5 py-3 font-semibold">Destinatario</th>
              <th class="px-5 py-3 font-semibold">Carrier</th>
              <th class="px-5 py-3 font-semibold text-center">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Costo envío</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 font-mono text-xs font-semibold">{{ s.tracking_code }}</td>
                <td class="px-5 py-3 font-mono text-xs">{{ s.order_code }}</td>
                <td class="px-5 py-3">
                  <p class="font-medium">{{ s.recipient_name }}</p>
                  <p class="text-xs text-slate-500">{{ s.city }}, {{ s.country }}</p>
                  @if (s.recipient_phone) {
                    <p class="text-[11px] mt-1 flex items-center gap-2">
                      <a [href]="'tel:' + s.recipient_phone" class="text-sky-600 hover:underline">
                        <i class="fa-solid fa-phone text-[10px]"></i> {{ s.recipient_phone }}
                      </a>
                      <a [href]="waLink(s.recipient_phone)" target="_blank" rel="noopener"
                         class="text-emerald-600 hover:underline" title="WhatsApp">
                        <i class="fa-brands fa-whatsapp"></i>
                      </a>
                    </p>
                  }
                  @if (s.customer_email) {
                    <p class="text-[11px]">
                      <a [href]="'mailto:' + s.customer_email" class="text-sky-600 hover:underline">
                        <i class="fa-solid fa-envelope text-[10px]"></i> {{ s.customer_email }}
                      </a>
                    </p>
                  }
                </td>
                <td class="px-5 py-3 text-xs">{{ s.carrier_label }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                        [ngClass]="statusBadge(s.status)">{{ s.status_label }}</span>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="inline-flex items-center gap-1">
                    <span class="text-slate-400 text-xs">$</span>
                    <input type="number" min="0" step="0.01" [ngModel]="s.shipping_cost"
                           (blur)="saveCost(s, $any($event.target).value)"
                           (keyup.enter)="saveCost(s, $any($event.target).value)"
                           class="w-20 px-2 py-1 rounded text-xs bg-slate-100 border-0 text-right"
                           title="Costo acordado con el courier (no afecta el total del pedido)" />
                  </div>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <select [ngModel]="s.status" (ngModelChange)="advance(s, $event)"
                            [disabled]="savingId() === s.id"
                            class="px-2 py-1 rounded text-xs bg-slate-100 border-0 disabled:opacity-50">
                      <option value="CREATED">Creado</option>
                      <option value="PREPARING">Preparando</option>
                      <option value="SHIPPED">Enviado</option>
                      <option value="IN_TRANSIT">En tránsito</option>
                      <option value="DELIVERED">Entregado</option>
                      <option value="FAILED">Fallido</option>
                    </select>
                    @if (savingId() === s.id) {
                      <i class="fa-solid fa-spinner fa-spin text-slate-400 text-xs"></i>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class ShipmentsListComponent implements OnInit {
  private svc = inject(ShippingService);
  private notify = inject(NotifyService);
  items = signal<Shipment[]>([]);
  search = '';
  statusFilter = '';

  ngOnInit() { this.reload(); }
  reload() { this.svc.list({ search: this.search, status: this.statusFilter }).subscribe(r => this.items.set(r.results)); }

  countBy(s: string) { return this.items().filter(i => i.status === s).length; }
  statusBadge(s: string) {
    return ({
      CREATED: 'bg-slate-100 text-slate-700',
      PREPARING: 'bg-amber-100 text-amber-700',
      SHIPPED: 'bg-sky-100 text-sky-700',
      IN_TRANSIT: 'bg-violet-100 text-violet-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-rose-100 text-rose-700',
      RETURNED: 'bg-rose-100 text-rose-700',
    } as any)[s];
  }
  savingId = signal<number | null>(null);
  waLink(phone: string) { return 'https://wa.me/' + (phone || '').replace(/[^0-9]/g, ''); }
  advance(s: Shipment, newStatus: string) {
    if (newStatus === s.status || this.savingId() !== null) return;
    this.savingId.set(s.id);
    this.svc.updateStatus(s.id, newStatus).subscribe({
      next: (updated) => {
        // Actualiza solo esa fila con la respuesta (sin recargar toda la lista).
        this.items.update(list => list.map(it => it.id === s.id ? { ...it, ...updated } : it));
        this.savingId.set(null);
        this.notify.success('Estado actualizado');
      },
      error: () => {
        this.savingId.set(null);
        this.items.update(list => [...list]); // revierte el select al estado real
        this.notify.error('No se pudo actualizar el estado.');
      },
    });
  }
  saveCost(s: Shipment, value: string) {
    const cost = Math.max(0, +value || 0);
    if (cost.toFixed(2) === (+s.shipping_cost || 0).toFixed(2)) return;
    this.svc.setShippingCost(s.id, cost).subscribe({
      next: r => { s.shipping_cost = r.shipping_cost; this.notify.success('Costo de envío guardado'); },
      error: () => this.notify.error('No se pudo guardar el costo de envío.'),
    });
  }
}
