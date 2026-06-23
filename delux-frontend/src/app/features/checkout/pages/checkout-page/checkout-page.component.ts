import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '@features/checkout/services/cart.service';
import { CheckoutService } from '@features/checkout/services/checkout.service';
import { NotifyService } from '@shared/services/notify.service';
import { PublicBranchesService, PublicBranch } from '@shared/services/public-branches.service';
import { ZoneService } from '@shared/services/zone.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';

@Component({
  selector: 'dlx-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1400px] mx-auto px-6 md:px-10 pt-32 pb-24 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Checkout</p>
      <h1 class="display-xl text-4xl md:text-6xl mt-4 mb-12 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Finalizar compra
      </h1>

      @if (cart.lines().length === 0) {
        <div class="text-center py-16">
          <p class="text-ink-700 dark:text-white/70 mb-4">Tu carrito está vacío.</p>
          <a routerLink="/shop" class="btn-outline">Ver catálogo</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          <form (ngSubmit)="payNow()" #f="ngForm" class="space-y-6">
            <!-- 1. Cliente -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">1</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Información de contacto</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Nombre completo *</label>
                  <input [(ngModel)]="customer.full_name" name="full_name" required maxlength="160"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Email *</label>
                  <input [(ngModel)]="customer.email" name="email" type="email" required
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Teléfono *</label>
                  <input [(ngModel)]="customer.phone" name="phone" required maxlength="30"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Cédula</label>
                  <input [(ngModel)]="customer.document_id" name="document_id" maxlength="30"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white font-mono" />
                </div>
              </div>
            </div>

            <!-- 2. Sucursal -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">2</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Sucursal de despacho</h2>
              </div>
              <p class="text-sm text-ink-700 dark:text-white/70 mb-4">El stock se reserva en la sucursal seleccionada.</p>

              <!-- Tipo de entrega -->
              <div class="grid grid-cols-2 gap-3 mb-4">
                <button type="button" (click)="fulfillment = 'SHIPPING'"
                        class="p-3 rounded-xl border-2 text-left transition flex items-center gap-3"
                        [class.border-accent-500]="fulfillment === 'SHIPPING'"
                        [class.bg-accent-50]="fulfillment === 'SHIPPING'"
                        [class.dark:bg-white/10]="fulfillment === 'SHIPPING'"
                        [class.border-ink-200]="fulfillment !== 'SHIPPING'"
                        [class.dark:border-white/10]="fulfillment !== 'SHIPPING'">
                  <i class="fa-solid fa-truck text-accent-600"></i>
                  <span>
                    <span class="block font-semibold text-ink-950 dark:text-white text-sm">Envío a domicilio</span>
                    <span class="block text-xs text-ink-600 dark:text-white/55">Te lo llevamos</span>
                  </span>
                </button>
                <button type="button" (click)="fulfillment = 'PICKUP'"
                        class="p-3 rounded-xl border-2 text-left transition flex items-center gap-3"
                        [class.border-accent-500]="fulfillment === 'PICKUP'"
                        [class.bg-accent-50]="fulfillment === 'PICKUP'"
                        [class.dark:bg-white/10]="fulfillment === 'PICKUP'"
                        [class.border-ink-200]="fulfillment !== 'PICKUP'"
                        [class.dark:border-white/10]="fulfillment !== 'PICKUP'">
                  <i class="fa-solid fa-store text-accent-600"></i>
                  <span>
                    <span class="block font-semibold text-ink-950 dark:text-white text-sm">Retiro en tienda</span>
                    <span class="block text-xs text-ink-600 dark:text-white/55">Sin costo de envío</span>
                  </span>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                @for (b of branches(); track b.id) {
                  <button type="button" (click)="branchId = b.id"
                          class="p-4 rounded-xl border-2 text-left transition"
                          [class.border-accent-500]="branchId === b.id"
                          [class.bg-accent-50]="branchId === b.id"
                          [class.dark:bg-white/10]="branchId === b.id"
                          [class.border-ink-200]="branchId !== b.id"
                          [class.dark:border-white/10]="branchId !== b.id">
                    <p class="font-mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50">{{ b.code }}</p>
                    <p class="font-semibold text-ink-950 dark:text-white mt-0.5">{{ b.name }}</p>
                    <p class="text-xs text-ink-700 dark:text-white/60 mt-0.5">{{ b.city }}</p>
                  </button>
                }
              </div>
            </div>

            <!-- 3. Pago -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">3</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Método de pago</h2>
              </div>

              <div class="p-5 rounded-xl border-2 border-violet-400 bg-violet-50 dark:bg-violet-500/10">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-lg bg-violet-600 text-white grid place-items-center">
                    <i class="fa-solid fa-mobile-screen text-xl"></i>
                  </div>
                  <div class="flex-1">
                    <p class="font-bold text-ink-950 dark:text-white">PayPhone</p>
                    <p class="text-xs text-ink-700 dark:text-white/70">Tarjeta de crédito, débito o PayPhone wallet</p>
                  </div>
                  <i class="fa-solid fa-circle-check text-violet-600 text-xl"></i>
                </div>
              </div>

              @if (error()) {
                <div class="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
                </div>
              }
            </div>
          </form>

          <!-- Resumen -->
          <aside class="lg:sticky lg:top-24 self-start">
            <div class="editorial-card p-6">
              <h2 class="font-display font-bold text-xl mb-4 text-ink-950 dark:text-white">Tu orden</h2>

              <ul class="space-y-3 max-h-72 overflow-y-auto pb-3 border-b border-ink-200 dark:border-white/10">
                @for (l of cart.lines(); track l.variant_id) {
                  <li class="flex gap-2.5">
                    <div class="relative w-14 h-14 rounded-lg bg-ink-100 dark:bg-white/5 overflow-hidden shrink-0">
                      <img [src]="l.product_image" [alt]="l.product_name"
                           class="w-full h-full object-cover"
                           crossorigin="anonymous" (error)="onImgErr($event)" />
                      <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 text-[10px] font-bold grid place-items-center">
                        {{ l.quantity }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold truncate text-ink-950 dark:text-white">{{ l.product_name }}</p>
                      <p class="text-[10px] text-ink-500 dark:text-white/50 font-mono truncate">{{ l.size }} · {{ l.color }}</p>
                    </div>
                    <span class="text-xs font-bold text-ink-950 dark:text-white">\${{ (l.unit_price * l.quantity).toFixed(2) }}</span>
                  </li>
                }
              </ul>

              <!-- Cupón -->
              @if (!appliedCoupon()) {
                <div class="mt-4 flex gap-2">
                  <input [(ngModel)]="couponInput" placeholder="Código de cupón"
                         class="flex-1 px-3 py-2 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-xs font-mono uppercase focus:outline-none" />
                  <button type="button" (click)="applyCoupon()" [disabled]="!couponInput || validating()"
                          class="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40">
                    @if (validating()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { Aplicar }
                  </button>
                </div>
                @if (couponError()) {
                  <p class="text-[10px] text-rose-600 mt-1"><i class="fa-solid fa-circle-exclamation"></i> {{ couponError() }}</p>
                }
              } @else {
                <div class="mt-4 flex items-center justify-between p-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-400/30">
                  <div>
                    <p class="text-[10px] uppercase tracking-widest text-violet-600 dark:text-violet-300 font-bold">Cupón</p>
                    <p class="font-mono text-xs font-bold text-violet-700 dark:text-violet-200">{{ appliedCoupon()!.code }}</p>
                  </div>
                  <button (click)="removeCoupon()" class="text-violet-600 hover:text-violet-800">
                    <i class="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
              }

              <div class="mt-4 pt-4 border-t border-ink-200 dark:border-white/10 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-ink-700 dark:text-white/70">Subtotal</span>
                  <span class="text-ink-950 dark:text-white font-semibold">\${{ cart.subtotal().toFixed(2) }}</span>
                </div>
                @if (discount() > 0) {
                  <div class="flex justify-between text-violet-600">
                    <span>Descuento</span>
                    <span>-\${{ discount().toFixed(2) }}</span>
                  </div>
                }
                <div class="flex justify-between pt-3 border-t border-ink-200 dark:border-white/10">
                  <span class="font-bold text-ink-950 dark:text-white">TOTAL</span>
                  <span class="font-display text-2xl font-bold text-ink-950 dark:text-white">
                    \${{ total().toFixed(2) }}
                  </span>
                </div>
              </div>

              <button type="button" (click)="payNow()" [disabled]="!canPay() || saving()"
                      class="w-full mt-5 btn-accent text-sm font-semibold py-4 disabled:opacity-50">
                @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Procesando... }
                @else {
                  <i class="fa-solid fa-lock"></i> Pagar \${{ total().toFixed(2) }}
                }
              </button>

              <p class="text-[10px] text-ink-500 dark:text-white/40 mt-3 text-center">
                Serás redirigido a PayPhone para completar el pago.
              </p>
            </div>
          </aside>
        </div>
      }
    </section>
  `,
})
export class CheckoutPageComponent implements OnInit {
  cart = inject(CartService);
  private checkout = inject(CheckoutService);
  private notify = inject(NotifyService);
  private branchSvc = inject(PublicBranchesService);
  zone = inject(ZoneService);
  private couponSvc = inject(CouponService);
  private router = inject(Router);

  branches = signal<PublicBranch[]>([]);
  branchId: number | null = null;
  fulfillment: 'SHIPPING' | 'PICKUP' = 'SHIPPING';
  saving = signal(false);
  error = signal<string | null>(null);

  customer = { full_name: '', email: '', phone: '', document_id: '' };

  couponInput = '';
  appliedCoupon = signal<CouponValidation | null>(null);
  validating = signal(false);
  couponError = signal<string | null>(null);
  discount = signal(0);

  total = computed(() => Math.max(0, this.cart.subtotal() - this.discount()));
  canPay = computed(() =>
    this.cart.lines().length > 0 && this.branchId !== null &&
    this.customer.full_name && this.customer.email && this.customer.phone
  );

  ngOnInit() {
    // Sucursales segun la ciudad elegida por el cliente (zona).
    this.zone.load(false);
    const city = this.zone.city() || undefined;
    this.branchSvc.list(city).subscribe(r => {
      const list = r.results || [];
      this.branches.set(list);
      if (list.length) this.branchId = list[0].id;
    });
  }

  applyCoupon() {
    if (!this.couponInput) return;
    this.validating.set(true);
    this.couponError.set(null);
    this.couponSvc.validate(this.couponInput.trim().toUpperCase(), this.cart.subtotal()).subscribe({
      next: r => {
        this.validating.set(false);
        if (r.valid) {
          this.appliedCoupon.set(r);
          this.discount.set(+(r.discount || 0));
          this.couponInput = '';
        } else {
          this.couponError.set(r.detail || 'Cupón inválido');
        }
      },
      error: e => {
        this.validating.set(false);
        this.couponError.set(e?.error?.detail || 'Cupón no válido');
      },
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.discount.set(0);
  }

  payNow() {
    if (!this.canPay() || !this.branchId) return;
    this.saving.set(true);
    this.error.set(null);
    const returnUrl = `${window.location.origin}/checkout/result`;
    this.checkout.initPayPhone({
      branch_id: this.branchId,
      fulfillment: this.fulfillment,
      customer_data: this.customer,
      items: this.cart.lines().map(l => ({ variant_id: l.variant_id, quantity: l.quantity })),
      discount: this.discount(),
      coupon_code: this.appliedCoupon()?.code,
      return_url: returnUrl,
    }).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.error) {
          this.error.set(r.error);
          this.notify.error(r.error);
          return;
        }
        // Guardar referencia para confirmación tras volver
        sessionStorage.setItem('dlx_pending_payment', JSON.stringify({
          payment_id: r.payment_id,
          order_code: r.order_code,
          order_total: r.order_total,
        }));
        if (r.payment_url) {
          if (r.payment_url.startsWith('/')) {
            this.router.navigateByUrl(r.payment_url);
          } else {
            window.location.href = r.payment_url;
          }
        }
      },
      error: e => {
        this.saving.set(false);
        const msg = e?.error?.detail || 'Error al iniciar el pago.';
        this.error.set(msg);
        this.notify.error(msg);
      },
    });
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
