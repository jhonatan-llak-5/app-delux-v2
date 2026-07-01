import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShippingService, Shipment } from '@shared/services/shipping.service';

@Component({
  selector: 'dlx-shipments-list',
  standalone: true,
  imports: [DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule],
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
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-truck text-3xl mb-3"></i>
          <p>No hay envíos registrados.</p>
        </div>
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Tracking</th>
              <th class="px-5 py-3 font-semibold">Orden</th>
              <th class="px-5 py-3 font-semibold">Destinatario</th>
              <th class="px-5 py-3 font-semibold">Carrier</th>
              <th class="px-5 py-3 font-semibold text-center">Estado</th>
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
                </td>
                <td class="px-5 py-3 text-xs">{{ s.carrier_label }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                        [ngClass]="statusBadge(s.status)">{{ s.status_label }}</span>
                </td>
                <td class="px-5 py-3 text-right">
                  <select [ngModel]="s.status" (ngModelChange)="advance(s, $event)"
                          class="px-2 py-1 rounded text-xs bg-slate-100 border-0">
                    <option value="CREATED">Creado</option>
                    <option value="PREPARING">Preparando</option>
                    <option value="SHIPPED">Enviado</option>
                    <option value="IN_TRANSIT">En tránsito</option>
                    <option value="DELIVERED">Entregado</option>
                    <option value="FAILED">Fallido</option>
                  </select>
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
  advance(s: Shipment, newStatus: string) {
    if (newStatus === s.status) return;
    this.svc.updateStatus(s.id, newStatus).subscribe(() => this.reload());
  }
}
