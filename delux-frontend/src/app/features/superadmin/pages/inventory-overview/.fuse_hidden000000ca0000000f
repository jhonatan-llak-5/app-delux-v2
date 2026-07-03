import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Stock, InventorySummary, InventoryService } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { onImageError, imgOrPlaceholder } from '@shared/utils/img-placeholder';
import { StockAdjustModalComponent } from '@features/superadmin/components/stock-adjust-modal/stock-adjust-modal.component';
import { TransferModalComponent } from '@features/superadmin/components/transfer-modal/transfer-modal.component';
import { printProductLabels } from '@shared/utils/print-labels';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-inventory-overview',
  standalone: true,
  imports: [DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, StockAdjustModalComponent, TransferModalComponent, RowActionsComponent],
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
      <div class="flex items-center gap-2 flex-wrap">
        <a routerLink="/app/admin/inventory/reception"
           class="px-4 py-2.5 rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-d)] text-sm font-semibold flex items-center gap-2">
          <i class="fa-solid fa-truck-ramp-box"></i> Ingresar mercadería
        </a>
        <a routerLink="/app/admin/inventory/movements"
           class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold flex items-center gap-2">
          <i class="fa-solid fa-clock-rotate-left"></i> Historial
        </a>
      </div>
    </div>

    <!-- KPIs -->
    @if (summary()) {
      <div class="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3 mb-6">
        <dlx-stat-card label="Unidades totales" [value]="summary()!.total_units" icon="fa-cubes-stacked" />
        <dlx-stat-card label="Productos" [value]="summary()!.products_count" icon="fa-box" iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
        <dlx-stat-card label="Variantes" [value]="summary()!.variants_count" icon="fa-layer-group" iconBg="bg-sky-50 dark:bg-sky-500/15" iconColor="text-sky-600 dark:text-sky-400" />
        <dlx-stat-card label="Stock bajo" [value]="summary()!.low_stock_count" icon="fa-triangle-exclamation" iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
        <dlx-stat-card label="Sin stock" [value]="summary()!.out_of_stock_count" icon="fa-ban" iconBg="bg-rose-50 dark:bg-rose-500/15" iconColor="text-rose-600 dark:text-rose-400" />
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
    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por SKU o producto..." class="flex-1 min-w-64" />
      @if (auth.multiBranch()) {
        <select [(ngModel)]="branchFilter" (change)="reload()"
                class="eg-input border-transparent">
          <option [ngValue]="null">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
        </select>
      }
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
                      <img [src]="imgSrc(s.product_main_image)" [alt]="s.product_name"
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
                    <dlx-row-actions [actions]="rowActions(s)" />
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
  protected auth = inject(AuthService);
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);
  private branchCtx = inject(BranchContextService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  private inited = false;

  constructor() {
    effect(() => {
      const b = this.branchCtx.current();
      if (this.inited) { this.branchFilter = b; this.reload(); }
    });
  }

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
    this.branchFilter = this.branchCtx.current();
    this.reload();
    this.inited = true;
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

  rowActions(s: Stock): RowAction[] {
    return [
      { label: 'Ajustar', icon: 'fa-pen', run: () => this.openAdjust(s) },
      { label: 'Transferir', icon: 'fa-truck', disabled: s.quantity === 0, run: () => this.openTransfer(s) },
      { label: 'Imprimir etiqueta', icon: 'fa-barcode', run: () => this.printLabel(s) },
    ];
  }

  printLabel(s: Stock): void {
    const price = s.price_override != null ? +s.price_override : +s.base_price || 0;
    printProductLabels(
      [{ sku: s.variant_sku, name: s.product_name, size: s.variant_size, price, quantity: 1 }],
      { store: this.branding.siteName(), taxRate: this.branding.taxRate(), onError: m => this.notify.error(m) },
    );
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

  imgSrc(u?: string | null): string { return imgOrPlaceholder(u); }
  onImgErr(ev: Event) { onImageError(ev); }
}
