import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '@features/checkout/services/cart.service';

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
            ¡Pago confirmado!
          </h1>
          <p class="text-ink-700 dark:text-white/70 mb-2">
            Tu orden ha sido procesada exitosamente.
          </p>
          @if (orderCode()) {
            <p class="text-sm font-mono text-ink-500 dark:text-white/50 mb-8">
              Voucher: <span class="font-bold text-ink-950 dark:text-white">{{ orderCode() }}</span>
            </p>
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

  ngOnInit() {
    const s = this.route.snapshot.queryParamMap.get('success');
    this.success.set(s === 'true');
    this.orderCode.set(this.route.snapshot.queryParamMap.get('code'));
    // Limpiar carrito si fue exitoso
    if (this.success()) {
      this.cart.clear();
      sessionStorage.removeItem('dlx_pending_payment');
    }
  }
}
