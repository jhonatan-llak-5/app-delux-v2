import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MeService } from '@features/account/services/me.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { printVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { Order } from '@features/superadmin/services/order.service';

/** Un pedido individual del perfil (incluye group_code para agrupar compras multi-sucursal). */
export interface ProfileOrder {
  id: number;
  code: string;
  group_code?: string;
  created_at: string;
  branch_name: string;
  status: string;
  fulfillment: string;
  items: { id: number; product_image: string; product_name: string; sku?: string; size?: string; color?: string; quantity?: number; unit_price?: number; subtotal?: number }[];
  items_count: number;
  subtotal?: string;
  discount?: string;
  tax?: string;
  total: string;
  seller_name?: string | null;
  customer_name?: string | null;
  customer_document?: string | null;
  customer_phone?: string | null;
  // Factura electrónica
  invoice_status?: string;
  invoice_number?: string;
  invoice_access_key?: string;
  invoice_authorization?: string;
}

@Component({
  selector: 'dlx-orders-tab',
  standalone: true,
  imports: [
    DlxEmptyStateComponent, OrderStatusLabelPipe, OrderStatusClassPipe,
    DlxSearchInputComponent, DlxPaginationComponent, DlxModalComponent, ImgFallbackDirective, CommonModule, RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <i class="fa-solid fa-receipt"></i>
            <span class="uppercase tracking-widest font-semibold">Mi cuenta</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mis compras</h1>
          <p class="text-slate-500 text-sm mt-1">{{ orders().length }} órdenes registradas.</p>
        </div>
        @if (orders().length > 0) {
          <dlx-search-input [value]="search()" (valueChange)="onSearch($event)"
                            placeholder="Buscar por voucher o producto…" class="w-full sm:w-auto sm:min-w-72" />
        }
      </div>

      @if (loading()) {
        <div class="text-center py-10">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-ink-400 dark:text-white/40"></i>
        </div>
      } @else if (orders().length === 0) {
        <dlx-empty-state variant="store" icon="fa-cart-arrow-down" title="Aún no has hecho compras.">
          <a routerLink="/shop" class="btn-accent text-sm font-semibold px-6 py-3">
            Explorar catálogo
          </a>
        </dlx-empty-state>
      } @else {
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                <tr class="text-left">
                  <th class="px-4 py-3 font-semibold">Voucher</th>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                  <th class="px-4 py-3 font-semibold">Sucursal</th>
                  <th class="px-4 py-3 font-semibold text-center">Artículos</th>
                  <th class="px-4 py-3 font-semibold text-right">Total</th>
                  <th class="px-4 py-3 font-semibold text-center">Estado</th>
                  <th class="px-4 py-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (o of paged(); track o.id) {
                  <tr class="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/5">
                    <td class="px-4 py-2.5 whitespace-nowrap">
                      <span class="font-mono text-xs font-semibold">{{ o.code }}</span>
                      @if (o.group_code) {
                        <span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold
                                     bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                              title="Parte de una compra multi-sucursal">
                          <i class="fa-solid fa-boxes-stacked text-[9px]"></i> multi-sucursal
                        </span>
                      }
                    </td>
                    <td class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ o.created_at | date:'short' }}</td>
                    <td class="px-4 py-2.5 text-xs">{{ o.branch_name || '—' }}</td>
                    <td class="px-4 py-2.5 text-center">{{ o.items_count || o.items.length }}</td>
                    <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap">\${{ o.total }}</td>
                    <td class="px-4 py-2.5 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                            [ngClass]="o.status | orderStatusClass">
                        {{ o.status | orderStatusLabel }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">
                      <div class="inline-flex items-center gap-3 justify-end">
                        @if (o.fulfillment === 'SHIPPING') {
                          <a [routerLink]="['/tracking', o.code]"
                             class="inline-flex items-center gap-2 text-xs font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300">
                            <i class="fa-solid fa-truck-fast"></i> Seguir
                          </a>
                        }
                        <button type="button" (click)="openDetail(o)"
                                class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/70 hover:text-ink-950 dark:hover:text-white">
                          <i class="fa-solid fa-eye"></i> Detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (filtered().length === 0) {
            <dlx-empty-state icon="fa-magnifying-glass" title="Sin resultados para tu búsqueda." />
          }
        </div>

        @if (filtered().length > 0) {
          <dlx-pagination [page]="page()" [pageSize]="pageSize()" [total]="filtered().length"
                          (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
        }
      }
    </div>

    @if (detail(); as d) {
      <dlx-modal [open]="true" [maxWidth]="560" [title]="'Compra ' + d.code" (closed)="closeDetail()">
        <div class="space-y-4 text-sm">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
            <span><i class="fa-regular fa-calendar"></i> {{ d.created_at | date:'medium' }}</span>
            <span><i class="fa-solid fa-store"></i> {{ d.branch_name || '—' }}</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                  [ngClass]="d.status | orderStatusClass">{{ d.status | orderStatusLabel }}</span>
          </div>

          <div class="rounded-xl border border-slate-100 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10">
            @for (it of d.items; track it.id) {
              <div class="flex items-center gap-3 p-3">
                <img [src]="it.product_image" [alt]="it.product_name" dlxImgFallback
                     class="w-12 h-12 rounded-lg object-cover bg-slate-100 dark:bg-white/5 shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="font-semibold truncate">{{ it.product_name }}</p>
                  <p class="text-xs text-slate-500">
                    {{ it.size || '' }}{{ it.color ? (it.size ? ' · ' : '') + it.color : '' }} · x{{ it.quantity || 1 }}
                  </p>
                </div>
                <span class="font-semibold whitespace-nowrap">\${{ it.subtotal ?? it.unit_price }}</span>
              </div>
            }
          </div>

          <div class="flex justify-end">
            <div class="w-52 space-y-1">
              @if (d.subtotal) { <div class="flex justify-between text-slate-500"><span>Subtotal</span><span>\${{ d.subtotal }}</span></div> }
              @if (d.discount && +d.discount > 0) { <div class="flex justify-between text-slate-500"><span>Descuento</span><span>-\${{ d.discount }}</span></div> }
              @if (d.tax && +d.tax > 0) { <div class="flex justify-between text-slate-500"><span>IVA</span><span>\${{ d.tax }}</span></div> }
              <div class="flex justify-between font-bold text-base pt-1 border-t border-slate-100 dark:border-white/10"><span>Total</span><span>\${{ d.total }}</span></div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-100 dark:border-white/10 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-semibold"><i class="fa-solid fa-file-invoice text-slate-400"></i> Factura electrónica</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                    [ngClass]="invoiceClass(d.invoice_status)">{{ invoiceLabel(d.invoice_status) }}</span>
            </div>
            @if (d.invoice_status === 'AUTHORIZED') {
              @if (d.invoice_number) { <p class="text-xs text-slate-500">Número: <span class="font-mono text-slate-700 dark:text-slate-300">{{ d.invoice_number }}</span></p> }
              @if (d.invoice_access_key) { <p class="text-[11px] text-slate-400 break-all">Clave de acceso: {{ d.invoice_access_key }}</p> }
              <div class="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" (click)="openInvoiceFile(d, 'pdf')" [disabled]="downloading()"
                        class="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-60">
                  <i class="fa-solid" [ngClass]="downloading() ? 'fa-spinner fa-spin' : 'fa-file-pdf'"></i> RIDE (PDF)
                </button>
                <button type="button" (click)="openInvoiceFile(d, 'xml')" [disabled]="downloading()"
                        class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:underline disabled:opacity-60">
                  <i class="fa-solid fa-file-code"></i> XML
                </button>
                <button type="button" (click)="printReceipt(d)"
                        class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-ink-950 text-white hover:bg-ink-900">
                  <i class="fa-solid fa-print"></i> Imprimir comprobante
                </button>
              </div>
            } @else {
              <p class="text-xs text-slate-500">Aún no hay factura disponible. Aparecerá aquí cuando el SRI la autorice.</p>
            }
          </div>
        </div>
      </dlx-modal>
    }
  `,
})
export class OrdersTabComponent implements OnInit {
  private me = inject(MeService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  orders = signal<ProfileOrder[]>([]);
  loading = signal(true);
  search = signal('');
  page = signal(1);
  pageSize = signal(25);

  detail = signal<ProfileOrder | null>(null);
  downloading = signal(false);

  openDetail(o: ProfileOrder) { this.detail.set(o); }
  closeDetail() { this.detail.set(null); }

  invoiceLabel(s?: string): string {
    return ({
      PROCESSING: 'Procesando', PENDING_SRI: 'En espera del SRI',
      AUTHORIZED: 'Autorizada', REJECTED: 'Rechazada',
      ANNULLED: 'Anulada', ERROR: 'Error',
    } as any)[s || ''] || 'No emitida';
  }
  invoiceClass(s?: string): string {
    return ({
      PROCESSING: 'bg-amber-100 text-amber-700',
      PENDING_SRI: 'bg-sky-100 text-sky-700',
      AUTHORIZED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
      ANNULLED: 'bg-slate-200 text-slate-600',
      ERROR: 'bg-rose-100 text-rose-700',
    } as any)[s || ''] || 'bg-slate-100 text-slate-600';
  }

  /** Abre el RIDE (pdf) o XML de la factura en una pestaña nueva. */
  openInvoiceFile(o: ProfileOrder, kind: 'pdf' | 'xml') {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.me.orderInvoiceFile(o.id, kind).subscribe({
      next: blob => {
        this.downloading.set(false);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => {
        this.downloading.set(false);
        this.notify.error('No se pudo obtener el archivo. Intenta más tarde.');
      },
    });
  }

  /** Imprime el comprobante térmico de la compra (mismo formato de la tienda). */
  printReceipt(o: ProfileOrder) {
    printVoucherPDF(o as unknown as Order, this.branding.receiptBusiness());
  }

  /** Filtra por voucher, sucursal y nombre de producto (client-side). */
  filtered = computed<ProfileOrder[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.orders();
    return this.orders().filter(o =>
      o.code.toLowerCase().includes(q) ||
      (o.branch_name || '').toLowerCase().includes(q) ||
      (o.items || []).some(it => (it.product_name || '').toLowerCase().includes(q)),
    );
  });

  /** Página actual sobre el resultado filtrado. */
  paged = computed<ProfileOrder[]>(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.me.orders().subscribe({
      next: r => { this.orders.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.page.set(1); }
  onPage(p: number) { this.page.set(p); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); }
}
