import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { OrderService, Order } from '@features/superadmin/services/order.service';
import { AdminService, AdminBranch, AdminUser } from '@features/superadmin/services/admin.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { parseApiError } from '@shared/utils/api-error.util';
import { imgOrPlaceholder, onImageError } from '@shared/utils/img-placeholder';

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
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxSearchInputComponent, CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {
  private inv = inject(InventoryService);
  private ord = inject(OrderService);
  private adminSvc = inject(AdminService);
  private couponSvc = inject(CouponService);
  private auth = inject(AuthService);
  private branding = inject(BrandingService);

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
  confirmOpen = signal(false);
  error = signal<string | null>(null);
  completedOrder = signal<Order | null>(null);
  customerData = { full_name: '', email: '', phone: '', document_id: '' };

  // Vendedor de la venta (solo gerente/admin puede elegir; el vendedor queda a su nombre).
  sellers = signal<AdminUser[]>([]);
  sellerId: number | null = this.auth.user()?.id ?? null;
  myId = this.auth.user()?.id ?? null;
  myName = this.auth.user()?.full_name || this.auth.user()?.username || 'Yo';
  isManager = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  });
  sellersForBranch = computed(() =>
    this.sellers().filter(u => u.id !== this.myId && (!this.branchId || u.branch_id === this.branchId)));

  private search$ = new Subject<void>();

  taxRate = computed(() => +this.branding.taxRate() || 0);
  /** Suma neta (sin IVA). */
  netSubtotal = computed(() =>
    this.cart().reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  );
  /** Monto de IVA incluido. */
  taxAmount = computed(() => this.netSubtotal() * this.taxRate() / 100);
  /** Subtotal con IVA incluido. */
  subtotal = computed(() => this.netSubtotal() + this.taxAmount());
  total = computed(() => Math.max(0, this.subtotal() - this.discount()));
  /** Precio unitario con IVA para mostrar. */
  unitWithTax(i: CartItem): number { return i.unit_price * (1 + this.taxRate() / 100); }
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
      if (this.isManager()) {
        this.adminSvc.listUsers({ role: 'SALESPERSON' }).subscribe(r => this.sellers.set(r.results || []));
      }
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
  priceWithTax(s: Stock): number { return this.priceOf(s) * (1 + this.taxRate() / 100); }

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

  confirmSale() {
    this.confirmOpen.set(false);
    this.checkout();
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
      seller_id: this.isManager() ? this.sellerId : undefined,
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

  imgSrc(url?: string | null): string { return imgOrPlaceholder(url); }
}
