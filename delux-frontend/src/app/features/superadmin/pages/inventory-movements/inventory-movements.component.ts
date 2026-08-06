import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { AuthService } from '@core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InventoryService, StockMovement } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';

@Component({
  selector: 'dlx-inventory-movements',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, CommonModule, FormsModule, RouterLink, DlxPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
      <a routerLink="/app/admin/inventory" class="hover:text-ink-950">Inventario</a>
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
      <span class="uppercase tracking-widest font-semibold">Movimientos</span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">Historial de movimientos</h1>
    <p class="text-slate-500 text-sm mb-6">Auditoría completa de entradas, salidas, ajustes y transferencias.</p>

    <!-- Encabezado por producto (cuando se abre "Ver historial" de una fila) -->
    @if (productId()) {
      <div class="card p-4 mb-4 flex items-center gap-4">
        @if (productImage()) {
          <img [src]="productImage()" [alt]="productName()" dlxImgFallback
               class="w-14 h-14 rounded-xl object-cover bg-slate-100 dark:bg-white/5 shrink-0" />
        } @else {
          <div class="w-14 h-14 rounded-xl bg-violet-100 text-violet-600 grid place-items-center text-xl font-bold shrink-0">
            {{ (productName() || 'P').charAt(0) }}
          </div>
        }
        <div>
          <p class="font-bold text-lg leading-tight">{{ productName() || 'Producto' }}</p>
          <p class="text-sm text-slate-500">
            <span class="font-bold text-ink-950">{{ currentUnits() ?? '—' }}</span> unidades totales
          </p>
        </div>
        <a routerLink="/app/admin/inventory"
           class="ml-auto text-sm text-slate-500 hover:text-ink-950">
          <i class="fa-solid fa-arrow-left mr-1"></i> Volver al inventario
        </a>
      </div>
    }

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      @if (auth.multiBranch()) {
        <select [(ngModel)]="branchFilter" (change)="reload()"
                class="eg-input border-transparent">
          <option [ngValue]="null">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
        </select>
      }
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
        <dlx-empty-state icon="fa-clock-rotate-left" title="No hay movimientos registrados." />
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Fecha</th>
              <th class="px-5 py-3 font-semibold">Tipo</th>
              @if (!productId()) { <th class="px-5 py-3 font-semibold">Producto / Código</th> }
              <th class="px-5 py-3 font-semibold">Sucursal</th>
              <th class="px-5 py-3 font-semibold text-center">Antes</th>
              <th class="px-5 py-3 font-semibold text-center">Movimiento</th>
              <th class="px-5 py-3 font-semibold text-center">Después</th>
              <th class="px-5 py-3 font-semibold">Responsable</th>
              <th class="px-5 py-3 font-semibold text-right">Detalle</th>
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
                @if (!productId()) {
                  <td class="px-5 py-3">
                    <p class="font-medium text-xs">{{ m.product_name }}</p>
                    <p class="text-[11px] text-slate-500 font-mono">{{ m.variant_sku }}</p>
                  </td>
                }
                <td class="px-5 py-3 text-xs">{{ m.branch_name }}</td>
                <td class="px-5 py-3 text-center text-slate-600">{{ m.qty_before ?? '—' }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                        [ngClass]="m.quantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                    {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                  </span>
                </td>
                <td class="px-5 py-3 text-center font-bold text-ink-950">{{ m.qty_after ?? '—' }}</td>
                <td class="px-5 py-3 text-xs text-slate-600">{{ m.actor_name || '—' }}</td>
                <td class="px-5 py-3 text-right">
                  <button type="button" (click)="open(m)"
                          class="text-xs font-semibold text-violet-600 hover:text-violet-800 whitespace-nowrap">
                    Ver detalle <i class="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (total() > pageSize()) {
      <dlx-pagination class="block mt-4" [page]="page()" [pageSize]="pageSize()" [total]="total()"
                      (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
    }

    <!-- Drawer: Detalle del movimiento -->
    @if (selected(); as m) {
      <div class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/40" (click)="close()"></div>
        <div class="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6 animate-[slidein_.2s_ease]">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-bold">Detalle del movimiento</h2>
            <button type="button" (click)="close()"
                    class="w-8 h-8 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="rounded-2xl border border-slate-200 p-5">
            <div class="flex items-center gap-2 mb-4">
              <span class="w-9 h-9 grid place-items-center rounded-lg" [ngClass]="typeClass(m.type)">
                <i class="fa-solid" [ngClass]="typeIcon(m.type)"></i>
              </span>
              <span class="font-semibold">{{ m.type_label }}</span>
            </div>

            <p class="text-xs text-slate-400 uppercase tracking-wide">Movimiento</p>
            <p class="text-2xl font-bold mb-4"
               [ngClass]="m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'">
              {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }} unidades
            </p>

            <dl class="text-sm divide-y divide-slate-100">
              <div class="flex justify-between py-2">
                <dt class="text-slate-500">Fecha y hora</dt>
                <dd class="font-medium">{{ m.created_at | date:'short' }}</dd>
              </div>
              <div class="flex justify-between py-2">
                <dt class="text-slate-500">Responsable</dt>
                <dd class="font-medium">{{ m.actor_name || '—' }}</dd>
              </div>
              <div class="flex justify-between py-2">
                <dt class="text-slate-500">Tienda</dt>
                <dd class="font-medium">{{ m.branch_name }}</dd>
              </div>
              @if (!productId()) {
                <div class="flex justify-between py-2">
                  <dt class="text-slate-500">Producto</dt>
                  <dd class="font-medium text-right">{{ m.product_name }}</dd>
                </div>
              }
            </dl>

            <p class="text-xs text-slate-400 uppercase tracking-wide mt-4 mb-1">Motivo</p>
            <p class="text-sm text-slate-700">{{ motivoLabel(m.note) }}</p>
          </div>

          <p class="font-semibold mt-6 mb-2">Resumen de movimiento en unidades</p>
          <div class="grid grid-cols-3 rounded-2xl border border-slate-200 overflow-hidden text-center">
            <div class="p-4">
              <p class="text-xs text-slate-400">Antes</p>
              <p class="text-xl font-bold">{{ m.qty_before ?? '—' }}</p>
            </div>
            <div class="p-4 border-x border-slate-200">
              <p class="text-xs text-slate-400">Movimiento</p>
              <p class="text-xl font-bold" [ngClass]="m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'">
                {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
              </p>
            </div>
            <div class="p-4">
              <p class="text-xs text-slate-400">Después</p>
              <p class="text-xl font-bold">{{ m.qty_after ?? '—' }}</p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InventoryMovementsComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);
  private route = inject(ActivatedRoute);

  items = signal<StockMovement[]>([]);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);
  selected = signal<StockMovement | null>(null);
  productId = signal<number | null>(null);
  productName = signal<string>('');
  productImage = signal<string>('');
  page = signal(1);
  pageSize = signal(25);
  total = signal(0);
  branchFilter: number | null = null;
  typeFilter = '';

  // Unidades actuales del producto = "Después" del movimiento más reciente.
  currentUnits = computed<number | null>(() => {
    const list = this.items();
    for (const m of list) if (m.qty_after !== null && m.qty_after !== undefined) return m.qty_after;
    return null;
  });

  ngOnInit(): void {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.route.queryParams.subscribe(q => {
      this.productId.set(q['product'] ? +q['product'] : null);
      this.productName.set(q['name'] || '');
      this.reload();
    });
  }

  reload(): void { this.page.set(1); this.fetch(); }

  private fetch(): void {
    this.loading.set(true);
    this.svc.movements({
      branch: this.branchFilter || undefined,
      product: this.productId() || undefined,
      type: this.typeFilter || undefined,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => {
        this.items.set(r.results);
        this.total.set(r.count);
        if (this.productId() && r.results.length) {
          if (!this.productName()) this.productName.set(r.results[0].product_name);
          this.productImage.set(r.results[0].product_main_image || '');
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(p: number): void { this.page.set(p); this.fetch(); }
  onSize(s: number): void { this.pageSize.set(s); this.page.set(1); this.fetch(); }

  open(m: StockMovement): void { this.selected.set(m); }
  close(): void { this.selected.set(null); }

  motivoLabel(note: string | null | undefined): string {
    if (!note) return '—';
    const map: Record<string, string> = {
      COMPRA: 'Compra / Reposición', MERMA: 'Merma o daño',
      PERDIDA: 'Pérdida', CONTEO: 'Error de conteo', OTRO: 'Otro',
    };
    return map[note] || note;
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
