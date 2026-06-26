import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { OrderService, Order } from '@features/superadmin/services/order.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { parseApiError } from '@shared/utils/api-error.util';

interface CartItem {
  variant_id: number;
  product_name: string;
  product_image: string;
  sku: string;
  size: string;
  color: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
}

@Component({
  selector: 'dlx-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-cash-register"></i>
          <span class="uppercase tracking-widest font-semibold">Operación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">POS — Venta en sucursal</h1>
        <p class="text-slate-500 text-sm mt-1">
          Busca productos, agrega al carrito y cobra. Stock se descuenta al instante.
        </p>
      </div>
      <select [(ngModel)]="branchId" (change)="reload()" [disabled]="branchLocked"
              class="px-4 py-2.5 rounded-lg bg-ink-950 text-white font-semibold text-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
        @if (!branchLocked) { <option [ngValue]="null">— Seleccionar sucursal —</option> }
        @for (b of branches(); track b.id) {
          <option [ngValue]="b.id">{{ b.name }}</option>
        }
      </select>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

      <!-- CATÁLOGO -->
      <div class="space-y-4">
        <div class="card p-4 flex flex-wrap gap-3 items-center">
          <div class="relative flex-1 min-w-64">
            <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input placeholder="Buscar por SKU, producto..."
                   [ngModel]="search()" (ngModelChange)="onSearch($event)"
                   class="eg-input pl-9 pr-3 border-transparent" />
          </div>
        </div>

        @if (!branchId) {
          <div class="card p-12 text-center text-slate-400">
            <i class="fa-solid fa-building text-3xl mb-3"></i>
            <p>Selecciona una sucursal para empezar.</p>
          </div>
        } @else if (loading()) {
          <div class="card p-12 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
          </div>
        } @else if (stocks().length === 0) {
          <div class="card p-12 text-center text-slate-400">
            <i class="fa-solid fa-box-open text-3xl mb-3"></i>
            <p>No hay productos disponibles.</p>
          </div>
        } @else {
          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            @for (s of stocks(); track s.id) {
              <button (click)="addToCart(s)" [disabled]="s.quantity === 0"
                      class="card overflow-hidden hover:shadow-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed group">
                <div class="aspect-square bg-slate-100 relative overflow-hidden">
                  <img [src]="s.product_main_image" [alt]="s.product_name"
                       class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                       loading="lazy" crossorigin="anonymous" (error)="onImgErr($event)" />
                  <span class="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur"
                        [class.bg-emerald-100]="!s.is_low"
                        [class.text-emerald-700]="!s.is_low"
                        [class.bg-amber-100]="s.is_low && s.quantity > 0"
                        [class.text-amber-700]="s.is_low && s.quantity > 0"
                        [class.bg-rose-100]="s.quantity === 0"
                        [class.text-rose-700]="s.quantity === 0">
                    {{ s.quantity }}
                  </span>
                </div>
                <div class="p-3">
                  <p class="text-[10px] font-mono uppercase tracking-widest text-slate-500 truncate">{{ s.brand_name }}</p>
                  <h3 class="font-semibold text-xs mt-0.5 truncate">{{ s.product_name }}</h3>
                  <p class="text-[10px] text-slate-500 mt-0.5 truncate">
                    {{ s.variant_size }} · {{ s.variant_color }}
                  </p>
                  <p class="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{{ s.variant_sku }}</p>
                </div>
              </button>
            }
          </div>
        }
      </div>

      <!-- CARRITO -->
      <aside class="lg:sticky lg:top-4 lg:self-start space-y-4">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold tracking-tight flex items-center gap-2">
              <i class="fa-solid fa-cart-shopping"></i> Carrito
            </h2>
            <span class="text-xs bg-ink-950 text-white px-2 py-0.5 rounded-full font-bold">{{ cart().length }}</span>
          </div>

          @if (cart().length === 0) {
            <div class="text-center py-8 text-slate-400">
              <i class="fa-solid fa-cart-arrow-down text-2xl mb-2"></i>
              <p class="text-sm">Carrito vacío</p>
              <p class="text-xs mt-1">Haz click en un producto para agregarlo.</p>
            </div>
          } @else {
            <ul class="space-y-2 max-h-[400px] overflow-y-auto -mx-2 px-2">
              @for (item of cart(); track item.variant_id; let i = $index) {
                <li class="flex gap-2 p-2 rounded-lg hover:bg-slate-50 transition">
                  <img [src]="item.product_image" [alt]="item.product_name"
                       class="w-12 h-12 rounded object-cover bg-slate-100"
                       crossorigin="anonymous" (error)="onImgErr($event)" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold truncate">{{ item.product_name }}</p>
                    <p class="text-[10px] text-slate-500 font-mono truncate">{{ item.sku }} · {{ item.size }}/{{ item.color }}</p>
                    <div class="flex items-center gap-1 mt-1">
                      <button (click)="changeQty(i, -1)"
                              class="w-5 h-5 rounded grid place-items-center bg-slate-200 hover:bg-slate-300 text-xs">−</button>
                      <span class="text-xs font-bold w-6 text-center">{{ item.quantity }}</span>
                      <button (click)="changeQty(i, 1)" [disabled]="item.quantity >= item.max_stock"
                              class="w-5 h-5 rounded grid place-items-center bg-slate-200 hover:bg-slate-300 text-xs disabled:opacity-30">+</button>
                      <span class="ml-auto text-xs font-bold">\${{ (item.unit_price * item.quantity).toFixed(2) }}</span>
                      <button (click)="removeItem(i)" class="ml-1 text-rose-500 hover:text-rose-700">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </li>
              }
            </ul>

            <div class="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <!-- Cupón -->
              @if (!appliedCoupon()) {
                <div class="flex gap-1.5 items-center">
                  <i class="fa-solid fa-ticket text-violet-400 text-xs"></i>
                  <input [(ngModel)]="couponInput" placeholder="Código de cupón" maxlength="40"
                         class="flex-1 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:border-slate-400" />
                  <button type="button" (click)="applyCoupon()" [disabled]="!couponInput || validatingCoupon()"
                          class="px-3 py-1 rounded bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40">
                    @if (validatingCoupon()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { Aplicar }
                  </button>
                </div>
                @if (couponError()) {
                  <p class="text-[10px] text-rose-600"><i class="fa-solid fa-circle-exclamation"></i> {{ couponError() }}</p>
                }
              } @else {
                <div class="flex items-center justify-between p-2 rounded-lg bg-violet-50 border border-violet-200">
                  <div>
                    <p class="text-[10px] uppercase tracking-widest text-violet-600 font-bold">Cupón aplicado</p>
                    <p class="font-mono text-xs font-bold text-violet-700">{{ appliedCoupon()!.code }}</p>
                  </div>
                  <button (click)="removeCoupon()" class="text-violet-600 hover:text-violet-800">
                    <i class="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
              }

              <div class="flex justify-between text-sm">
                <span class="text-slate-500">Subtotal</span>
                <span class="font-semibold">\${{ subtotal().toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 text-sm">Descuento</span>
                <input type="number" [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)"
                       min="0" [max]="subtotal()" step="0.01"
                       class="w-24 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-sm text-right" />
              </div>
              <div class="flex justify-between pt-2 border-t border-slate-100">
                <span class="font-bold">TOTAL</span>
                <span class="text-2xl font-display font-bold">\${{ total().toFixed(2) }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Cliente -->
        <div class="card p-5">
          <h2 class="font-bold tracking-tight mb-3 flex items-center gap-2">
            <i class="fa-solid fa-user"></i> Cliente <span class="text-xs text-slate-400 font-normal">(opcional)</span>
          </h2>
          <div class="space-y-2">
            <input [(ngModel)]="customerData.full_name" placeholder="Nombre completo"
                   class="eg-input" />
            <input [(ngModel)]="customerData.email" type="email" placeholder="email@ejemplo.com"
                   class="eg-input" />
            <div class="grid grid-cols-2 gap-2">
              <input [(ngModel)]="customerData.phone" placeholder="Teléfono"
                     class="eg-input" />
              <input [(ngModel)]="customerData.document_id" placeholder="Cédula / RUC"
                     class="eg-input" />
            </div>
          </div>
        </div>

        @if (error()) {
          <div class="card p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        <button (click)="checkout()" [disabled]="!canCheckout() || saving()"
                class="w-full py-4 rounded-xl bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-sm font-bold uppercase tracking-widest
                       transition disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-3">
          @if (saving()) {
            <i class="fa-solid fa-spinner fa-spin"></i> Procesando...
          } @else {
            <i class="fa-solid fa-cash-register"></i>
            Cobrar \${{ total().toFixed(2) }}
          }
        </button>
      </aside>
    </div>

    @if (completedOrder()) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
        <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-8 text-center">
            <div class="w-16 h-16 rounded-full bg-white/20 grid place-items-center mx-auto mb-4">
              <i class="fa-solid fa-check text-3xl"></i>
            </div>
            <h3 class="text-2xl font-bold tracking-tight">¡Venta exitosa!</h3>
            <p class="text-emerald-100 mt-1">Voucher {{ completedOrder()!.code }}</p>
            <p class="text-3xl font-display font-bold mt-4">\${{ completedOrder()!.total }}</p>
          </div>
          <div class="p-6 space-y-2">
            <button (click)="printVoucher()" class="w-full py-3 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900 transition">
              <i class="fa-solid fa-print"></i> Imprimir voucher
            </button>
            <button (click)="newSale()" class="w-full py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
              <i class="fa-solid fa-plus"></i> Nueva venta
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PosComponent implements OnInit {
  private inv = inject(InventoryService);
  private ord = inject(OrderService);
  private adminSvc = inject(AdminService);
  private couponSvc = inject(CouponService);
  private auth = inject(AuthService);

  couponInput = '';
  appliedCoupon = signal<CouponValidation | null>(null);
  validatingCoupon = signal(false);
  couponError = signal<string | null>(null);

  branches = signal<AdminBranch[]>([]);
  branchId: number | null = null;
  branchLocked = false;
  stocks = signal<Stock[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal(false);
  search = signal('');
  discount = signal(0);
  saving = signal(false);
  error = signal<string | null>(null);
  completedOrder = signal<Order | null>(null);
  customerData = { full_name: '', email: '', phone: '', document_id: '' };

  private search$ = new Subject<void>();

  subtotal = computed(() =>
    this.cart().reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  );
  total = computed(() => Math.max(0, this.subtotal() - this.discount()));
  canCheckout = computed(() => this.cart().length > 0 && !!this.branchId);

  ngOnInit() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.adminSvc.listBranches().subscribe(r => {
      let list = r.results || [];
      const u = this.auth.user();
      // Gerente de sucursal: queda fijo a su sucursal.
      if ((u?.role === 'BRANCH_MANAGER' || u?.role === 'SALESPERSON') && u.branch_id) {
        list = list.filter(b => b.id === u.branch_id);
        this.branchLocked = true;
      }
      this.branches.set(list);
      if (list.length) {
        this.branchId = list[0].id;
        this.reload();
      }
    });
  }

  reload() {
    if (!this.branchId) return;
    this.loading.set(true);
    this.inv.stocks({
      branch: this.branchId,
      search: this.search() || undefined,
    }).subscribe({
      next: r => { this.stocks.set((r.results || []).filter(s => s.quantity > 0)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  private priceOf(s: Stock): number {
    return +(s.price_override || s.base_price || '0');
  }

  addToCart(s: Stock) {
    const existing = this.cart().find(c => c.variant_id === s.variant);
    if (existing) {
      if (existing.quantity < s.quantity) {
        const list = this.cart().map(c =>
          c.variant_id === s.variant ? { ...c, quantity: c.quantity + 1 } : c
        );
        this.cart.set(list);
      }
      return;
    }
    this.cart.update(list => [...list, {
      variant_id: s.variant,
      product_name: s.product_name,
      product_image: s.product_main_image,
      sku: s.variant_sku,
      size: s.variant_size,
      color: s.variant_color,
      unit_price: this.priceOf(s),
      quantity: 1,
      max_stock: s.quantity,
    }]);
  }

  changeQty(idx: number, delta: number) {
    const list = [...this.cart()];
    const item = list[idx];
    const next = item.quantity + delta;
    if (next < 1) return;
    if (next > item.max_stock) return;
    list[idx] = { ...item, quantity: next };
    this.cart.set(list);
  }

  removeItem(idx: number) {
    const list = [...this.cart()];
    list.splice(idx, 1);
    this.cart.set(list);
  }

  applyCoupon() {
    if (!this.couponInput) return;
    this.validatingCoupon.set(true);
    this.couponError.set(null);
    this.couponSvc.validate(this.couponInput.trim().toUpperCase(), this.subtotal()).subscribe({
      next: r => {
        this.validatingCoupon.set(false);
        if (r.valid) {
          this.appliedCoupon.set(r);
          this.discount.set(+(r.discount || 0));
          this.couponInput = '';
        } else {
          this.couponError.set(r.detail || 'Cupón inválido');
        }
      },
      error: e => {
        this.validatingCoupon.set(false);
        this.couponError.set(parseApiError(e).message || 'Cupón no válido');
      },
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.discount.set(0);
    this.couponError.set(null);
  }

  checkout() {
    if (!this.canCheckout() || !this.branchId) return;
    this.saving.set(true);
    this.error.set(null);
    const payload = {
      branch_id: this.branchId,
      items: this.cart().map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
      discount: this.discount(),
      customer_data: this.customerData.email ? this.customerData : undefined,
    };
    this.ord.posCheckout(payload).subscribe({
      next: order => {
        this.saving.set(false);
        this.completedOrder.set(order);
      },
      error: e => {
        this.saving.set(false);
        const detail = parseApiError(e).message
          || (e?.error?.items ? JSON.stringify(e.error.items) : null)
          || 'Error al procesar venta';
        this.error.set(detail);
      },
    });
  }

  printVoucher() {
    if (this.completedOrder()) generateVoucherPDF(this.completedOrder()!);
  }

  newSale() {
    this.cart.set([]);
    this.discount.set(0);
    this.completedOrder.set(null);
    this.customerData = { full_name: '', email: '', phone: '', document_id: '' };
    this.appliedCoupon.set(null);
    this.reload();
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
