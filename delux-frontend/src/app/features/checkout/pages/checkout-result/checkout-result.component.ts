import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '@features/checkout/services/cart.service';
import { environment } from '@env/environment';

@Component({
  selector: 'dlx-checkout-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="min-h-screen bg-white dark:bg-ink-950 grid place-items-center px-6 pt-32 pb-16">
      <div class="max-w-md w-full text-center">
        @if (success()) {
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center mx-auto mb-6 animate-cta-pulse">
            <i class="fa-solid fa-check text-white text-4xl"></i>
          </div>
          <h1 class="display-xl text-4xl md:text-5xl text-ink-950 dark:text-white tracking-[-0.03em] mb-3">
            {{ isCod() ? '¡Pedido registrado!' : '¡Pago confirmado!' }}
          </h1>
          <p class="text-ink-700 dark:text-white/70 mb-2">
            {{ isCod()
              ? 'Tu pedido fue registrado. Te contactaremos para coordinar la entrega y el pago contra entrega.'
              : 'Tu orden ha sido procesada exitosamente.' }}
          </p>
          @if (orderCount() > 1) {
            <div class="mb-6 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-4 py-3">
              <p class="text-sm text-sky-800 dark:text-sky-200 font-semibold">
                <i class="fa-solid fa-boxes-stacked"></i>
                Tu compra se dividió en {{ orderCount() }} pedidos (uno por sucursal).
              </p>
              @if (groupCode()) {
                <p class="text-xs font-mono text-sky-700 dark:text-sky-300 mt-1">Compra {{ groupCode() }}</p>
              }
            </div>
          }
          @if (orderCode()) {
            <p class="text-sm font-mono text-ink-500 dark:text-white/50 mb-8">
              {{ orderCount() > 1 ? 'Primer voucher' : 'Voucher' }}:
              <span class="font-bold text-ink-950 dark:text-white">{{ orderCode() }}</span>
            </p>
          }
          @if (trackCode()) {
            <a [routerLink]="['/tracking', trackCode()]"
               class="inline-flex items-center justify-center gap-2 mb-3 px-6 py-3 rounded-xl
                      bg-[#0095f6] text-white text-sm font-semibold hover:opacity-90 transition">
              <i class="fa-solid fa-truck-fast"></i> Rastrear mi pedido
            </a>
          }
          @if (orderCode()) {
            <a [href]="receiptUrl()" target="_blank" rel="noopener"
               class="inline-flex items-center justify-center gap-2 mb-6 px-6 py-3 rounded-xl
                      bg-ink-950 dark:bg-white text-white dark:text-ink-950 text-sm font-semibold
                      hover:opacity-90 transition">
              <i class="fa-solid fa-file-arrow-down"></i> Descargar comprobante (PDF)
            </a>
          }
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a routerLink="/shop" class="btn-accent text-sm font-semibold px-6 py-3">
              Seguir comprando
            </a>
            <a routerLink="/" class="btn-outline text-sm font-semibold px-6 py-3">
              Volver al inicio
            </a>
          </div>
        } @else {
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 grid place-items-center mx-auto mb-6">
            <i class="fa-solid fa-xmark text-white text-4xl"></i>
          </div>
          <h1 class="display-xl text-4xl md:text-5xl text-ink-950 dark:text-white tracking-[-0.03em] mb-3">
            Pago no procesado
          </h1>
          <p class="text-ink-700 dark:text-white/70 mb-8">
            El pago fue rechazado o cancelado. Tu carrito sigue intacto, puedes intentarlo nuevamente.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a routerLink="/checkout" class="btn-accent text-sm font-semibold px-6 py-3">
              Intentar nuevamente
            </a>
            <a routerLink="/cart" class="btn-outline text-sm font-semibold px-6 py-3">
              Ver carrito
            </a>
          </div>
        }
      </div>
    </section>
  `,
})
export class CheckoutResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private cart = inject(CartService);

  success = signal(false);
  orderCode = signal<string | null>(null);
  isCod = signal(false);
  receiptUrl = computed(() => `${environment.apiUrl}/admin/checkout/receipt/${this.orderCode()}/`);
  trackCode = signal<string | null>(null);
  groupCode = signal<string | null>(null);
  orderCount = signal<number>(1);

  ngOnInit() {
    const s = this.route.snapshot.queryParamMap.get('success');
    this.success.set(s === 'true');
    this.orderCode.set(this.route.snapshot.queryParamMap.get('code'));
    this.isCod.set(this.route.snapshot.queryParamMap.get('cod') === 'true');
    const tc = this.route.snapshot.queryParamMap.get('track');
    this.trackCode.set(tc && tc.length ? tc : null);
    const gc = this.route.snapshot.queryParamMap.get('group');
    this.groupCode.set(gc && gc.length ? gc : null);
    this.orderCount.set(Number(this.route.snapshot.queryParamMap.get('count')) || 1);
    // Limpiar carrito si fue exitoso
    if (this.success()) {
      this.cart.clear();
      sessionStorage.removeItem('dlx_pending_payment');
    }
  }
}
