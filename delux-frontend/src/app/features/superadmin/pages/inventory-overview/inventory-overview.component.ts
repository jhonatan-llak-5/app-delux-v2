import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Stock, InventorySummary, InventoryService } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { StockAdjustModalComponent } from '@features/superadmin/components/stock-adjust-modal/stock-adjust-modal.component';
import { TransferModalComponent } from '@features/superadmin/components/transfer-modal/transfer-modal.component';

@Component({
  selector: 'dlx-inventory-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StockAdjustModalComponent, TransferModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-boxes-stacked"></i>
          <span class="uppercase tracking-widest font-semibold">Operación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Inventario</h1>
        <p class="text-slate-500 text-sm mt-1">
          Stock en tiempo real por sucursal. Ajusta y transfiere unidades.
        </p>
      </div>
      <a routerLink="/app/admin/inventory/movements"
         class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold flex items-center gap-2">
        <i class="fa-solid fa-clock-rotate-left"></i> Historial
      </a>
    </div>

    <!-- KPIs -->
    @if (summary()) {
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Unidades totales</p>
          <p class="text-2xl font-bold mt-1">{{ summary()!.total_units }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Productos</p>
          <p class="text-2xl font-bold mt-1">{{ summary()!.products_count }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Variantes</p>
          <p class="text-2xl font-bold mt-1">{{ summary()!.variants_count }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-amber-600 font-semibold">Stock bajo</p>
          <p class="text-2xl font-bold text-amber-600 mt-1">{{ summary()!.low_stock_count }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-rose-600 font-semibold">Sin stock</p>
          <p class="text-2xl font-bold text-rose-600 mt-1">{{ summary()!.out_of_stock_count }}</p>
        </div>
      </div>

      <!-- Por sucursal -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        @for (b of summary()!.by_branch; track b.branch_id) {
          <button (click)="setBranchFilter(b.branch_id)"
                  class="card p-5 text-left hover:shadow-lg transition"
                  [class.ring-2]="branchFilter === b.branch_id"
                  [class.ring-violet-500]="branchFilter === b.branch_id">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">{{ b.branch__code }}</p>
                <p class="font-bold tracking-tight">{{ b.branch__name }}</p>
              </div>
              <div class="w-11 h-11 rounded-lg bg-ink-950 text-white grid place-items-center">
                <i class="fa-solid fa-building"></i>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
              <div>
                <p class="text-[10px] uppercase tracking-widest text-slate-400">Unidades</p>
                <p class="font-bold">{{ b.units }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-widest text-slate-400">SKUs</p>
                <p class="font-bold">{{ b.variants }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-widest text-amber-600">Bajo</p>
                <p class="font-bold text-amber-600">{{ b.low }}</p>
              </div>
            </div>
          </button>
        }
      </div>
    }

    <!-- Filtros -->
    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar por SKU o producto..."
               [ngModel]="search()" (ngModelChange)="onSearch($event)"
               class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-transparent
                      focus:bg-white focus:border-slate-300 focus:outline-none text-sm" />
      </div>
      <select [(ngModel)]="branchFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none text-sm">
        <option [ngValue]="null">Todas las sucursales</option>
        @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
      </select>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" [(ngModel)]="lowOnly" (change)="reload()" class="w-4 h-4 accent-amber-500" />
        <span>Solo stock bajo</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" [(ngModel)]="outOnly" (change)="reload()" class="w-4 h-4 accent-rose-500" />
        <span>Sin stock</span>
      </label>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
          <p>Cargando stocks...</p>
        </div>
      } @else if (stocks().length === 0) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-boxes-stacked text-3xl mb-3"></i>
          <p>No hay stocks con esos filtros.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr class="text-left">
                <th class="px-5 py-3 font-semibold">Producto</th>
                <th class="px-5 py-3 font-semibold">SKU / Variante</th>
                <th class="px-5 py-3 font-semibold">Sucursal</th>
                <th class="px-5 py-3 font-semibold text-center">Stock</th>
                <th class="px-5 py-3 font-semibold text-center">Reservado</th>
                <th class="px-5 py-3 font-semibold text-center">Disponible</th>
                <th class="px-5 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (s of stocks(); track s.id) {
                <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <img [src]="s.product_main_image" [alt]="s.product_name"
                           class="w-10 h-10 rounded-lg object-cover bg-slate-100"
                           crossorigin="anonymous" (error)="onImgErr($event)" />
                      <div>
                        <p class="font-medium">{{ s.product_name }}</p>
                        <p class="text-[11px] text-slate-500">{{ s.brand_name }} · {{ s.category_name }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <p class="font-mono text-xs">{{ s.variant_sku }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      {{ s.variant_size }} · {{ s.variant_color }}
                    </p>
                  </td>
                  <td class="px-5 py-3">
                    <span class="inline-flex items-center gap-1.5 text-xs">
                      <i class="fa-solid fa-location-dot text-slate-400"></i>
                      {{ s.branch_name }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-center">
                    <span class="inline-flex items-center justify-center min-w-12 px-2 py-1 rounded-full text-sm font-bold"
                          [class.bg-rose-100]="s.quantity === 0"
                          [class.text-rose-700]="s.quantity === 0"
                          [class.bg-amber-100]="s.is_low && s.quantity > 0"
                          [class.text-amber-700]="s.is_low && s.quantity > 0"
                          [class.bg-emerald-100]="!s.is_low && s.quantity > 0"
                          [class.text-emerald-700]="!s.is_low && s.quantity > 0">
                      {{ s.quantity }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-center text-slate-500">{{ s.reserved }}</td>
                  <td class="px-5 py-3 text-center font-semibold">{{ s.available }}</td>
                  <td class="px-5 py-3 text-right">
                    <div class="inline-flex gap-1">
                      <button (click)="openAdjust(s)" title="Ajustar"
                              class="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-100 hover:text-amber-700 transition text-slate-500">
                        <i class="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button (click)="openTransfer(s)" title="Transferir" [disabled]="s.quantity === 0"
                              class="w-8 h-8 grid place-items-center rounded-lg hover:bg-violet-100 hover:text-violet-700 transition text-slate-500 disabled:opacity-30">
                        <i class="fa-solid fa-truck text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (adjustStock()) {
      <dlx-stock-adjust-modal [stock]="adjustStock()!"
                              (close)="adjustStock.set(null)"
                              (saved)="onAdjusted()" />
    }
    @if (transferStock()) {
      <dlx-transfer-modal [stock]="transferStock()!"
                          (close)="transferStock.set(null)"
                          (saved)="onTransferred()" />
    }
  `,
})
export class InventoryOverviewComponent implements OnInit {
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);

  stocks = signal<Stock[]>([]);
  summary = signal<InventorySummary | null>(null);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);

  search = signal('');
  branchFilter: number | null = null;
  lowOnly = false;
  outOnly = false;
  private search$ = new Subject<void>();

  adjustStock = signal<Stock | null>(null);
  transferStock = signal<Stock | null>(null);

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.svc.summary(this.branchFilter || undefined).subscribe(s => this.summary.set(s));
    this.svc.stocks({
      search: this.search(),
      branch: this.branchFilter || undefined,
      low_stock: this.lowOnly,
      out_of_stock: this.outOnly,
    }).subscribe({
      next: r => { this.stocks.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  setBranchFilter(id: number) {
    this.branchFilter = this.branchFilter === id ? null : id;
    this.reload();
  }

  openAdjust(s: Stock) { this.adjustStock.set(s); }
  openTransfer(s: Stock) { this.transferStock.set(s); }

  onAdjusted() {
    this.adjustStock.set(null);
    this.reload();
  }
  onTransferred() {
    this.transferStock.set(null);
    this.reload();
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
