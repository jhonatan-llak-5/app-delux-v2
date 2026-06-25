import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryService, StockMovement } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-inventory-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
      <a routerLink="/app/admin/inventory" class="hover:text-ink-950">Inventario</a>
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
      <span class="uppercase tracking-widest font-semibold">Movimientos</span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">Historial de movimientos</h1>
    <p class="text-slate-500 text-sm mb-6">Auditoría completa de entradas, salidas, ajustes y transferencias.</p>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center">
      <select [(ngModel)]="branchFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option [ngValue]="null">Todas las sucursales</option>
        @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
      </select>
      <select [(ngModel)]="typeFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option value="">Todos los tipos</option>
        <option value="IN">Entradas</option>
        <option value="OUT">Salidas</option>
        <option value="ADJ">Ajustes</option>
        <option value="XFER_IN">Transferencia entrada</option>
        <option value="XFER_OUT">Transferencia salida</option>
        <option value="RESERVE">Reservas</option>
        <option value="RELEASE">Liberaciones</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>
      } @else if (items().length === 0) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-clock-rotate-left text-3xl mb-3"></i>
          <p>No hay movimientos registrados.</p>
        </div>
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Fecha</th>
              <th class="px-5 py-3 font-semibold">Tipo</th>
              <th class="px-5 py-3 font-semibold">Producto / SKU</th>
              <th class="px-5 py-3 font-semibold">Sucursal</th>
              <th class="px-5 py-3 font-semibold text-center">Cantidad</th>
              <th class="px-5 py-3 font-semibold">Actor</th>
              <th class="px-5 py-3 font-semibold">Nota</th>
            </tr>
          </thead>
          <tbody>
            @for (m of items(); track m.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 text-xs text-slate-600 font-mono">{{ m.created_at | date:'short' }}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                        [ngClass]="typeClass(m.type)">
                    <i class="fa-solid" [ngClass]="typeIcon(m.type)"></i>
                    {{ m.type_label }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <p class="font-medium text-xs">{{ m.product_name }}</p>
                  <p class="text-[11px] text-slate-500 font-mono">{{ m.variant_sku }}</p>
                </td>
                <td class="px-5 py-3 text-xs">{{ m.branch_name }}</td>
                <td class="px-5 py-3 text-center font-bold"
                    [class.text-emerald-600]="m.quantity > 0"
                    [class.text-rose-600]="m.quantity < 0">
                  {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                </td>
                <td class="px-5 py-3 text-xs text-slate-600">{{ m.actor_name || '—' }}</td>
                <td class="px-5 py-3 text-xs text-slate-500 max-w-xs truncate">{{ m.note || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class InventoryMovementsComponent implements OnInit {
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);

  items = signal<StockMovement[]>([]);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);
  branchFilter: number | null = null;
  typeFilter = '';

  ngOnInit(): void {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.svc.movements({
      branch: this.branchFilter || undefined,
      type: this.typeFilter || undefined,
    }).subscribe({
      next: r => { this.items.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  typeClass(t: string) {
    return ({
      IN:       'bg-emerald-100 text-emerald-700',
      OUT:      'bg-rose-100 text-rose-700',
      ADJ:      'bg-amber-100 text-amber-700',
      XFER_IN:  'bg-violet-100 text-violet-700',
      XFER_OUT: 'bg-violet-100 text-violet-700',
      RESERVE:  'bg-sky-100 text-sky-700',
      RELEASE:  'bg-sky-100 text-sky-700',
    } as any)[t] || 'bg-slate-100 text-slate-700';
  }
  typeIcon(t: string) {
    return ({
      IN:       'fa-arrow-down',
      OUT:      'fa-arrow-up',
      ADJ:      'fa-pen',
      XFER_IN:  'fa-truck-fast',
      XFER_OUT: 'fa-truck',
      RESERVE:  'fa-lock',
      RELEASE:  'fa-lock-open',
    } as any)[t] || 'fa-circle';
  }
}
