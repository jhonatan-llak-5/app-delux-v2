import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '@features/checkout/services/cart.service';

@Component({
  selector: 'dlx-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1200px] mx-auto px-6 md:px-10 pt-32 pb-24 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Carrito</p>
      <h1 class="display-xl text-5xl md:text-6xl mt-4 mb-12 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Tu carrito
      </h1>

      @if (cart.lines().length === 0) {
        <div class="text-center py-24">
          <i class="fa-solid fa-cart-arrow-down text-5xl text-ink-300 dark:text-white/20 mb-6"></i>
          <p class="text-xl text-ink-700 dark:text-white/70 mb-6">Tu carrito está vacío</p>
          <a routerLink="/shop" class="btn-accent text-sm uppercase tracking-widest px-8 py-4">
            <i class="fa-solid fa-arrow-left text-xs"></i> Explorar catálogo
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <!-- Items -->
          <div class="editorial-card overflow-hidden">
            <ul>
              @for (item of cart.lines(); track item.variant_id; let i = $index) {
                <li class="flex gap-4 p-5 border-b border-ink-200 dark:border-white/10 last:border-0">
                  <a [routerLink]="['/product', item.product_id]"
                     class="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-ink-100 dark:bg-white/5 shrink-0">
                    <img [src]="item.product_image" [alt]="item.product_name"
                         class="w-full h-full object-cover"
                         crossorigin="anonymous" (error)="onImgErr($event)" />
                  </a>
                  <div class="flex-1 min-w-0">
                    @if (item.brand_name) {
                      <p class="text-[10px] font-mono uppercase tracking-widest text-ink-500 dark:text-white/40">{{ item.brand_name }}</p>
                    }
                    <a [routerLink]="['/product', item.product_id]" class="font-semibold text-base md:text-lg text-ink-950 dark:text-white hover:underline">
                      {{ item.product_name }}
                    </a>
                    <p class="text-xs text-ink-500 dark:text-white/50 mt-1 font-mono">
                      Talla {{ item.size }} · {{ item.color }} · {{ item.sku }}
                    </p>
                    <div class="flex items-center gap-4 mt-4">
                      <div class="flex items-center gap-2 border border-ink-200 dark:border-white/20 rounded-lg">
                        <button (click)="cart.changeQty(i, -1)"
                                class="w-9 h-9 grid place-items-center hover:bg-ink-100 dark:hover:bg-white/10 rounded-l-lg">
                          <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <span class="w-8 text-center font-bold">{{ item.quantity }}</span>
                        <button (click)="cart.changeQty(i, 1)" [disabled]="item.quantity >= item.max_stock"
                                class="w-9 h-9 grid place-items-center hover:bg-ink-100 dark:hover:bg-white/10 rounded-r-lg disabled:opacity-30">
                          <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                      </div>
                      <button (click)="cart.remove(i)"
                              class="text-rose-500 hover:text-rose-700 text-sm flex items-center gap-1">
                        <i class="fa-solid fa-trash text-xs"></i> Quitar
                      </button>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-display text-xl font-bold text-ink-950 dark:text-white">
                      \${{ (item.unit_price * item.quantity).toFixed(2) }}
                    </p>
                    @if (item.quantity > 1) {
                      <p class="text-xs text-ink-500 dark:text-white/40 mt-1">
                        \${{ item.unit_price.toFixed(2) }} c/u
                      </p>
                    }
                  </div>
                </li>
              }
            </ul>
          </div>

          <!-- Resumen -->
          <aside class="lg:sticky lg:top-24 self-start">
            <div class="editorial-card p-6">
              <h2 class="font-display font-bold text-xl mb-4 text-ink-950 dark:text-white">Resumen</h2>

              <div class="space-y-2 pb-4 border-b border-ink-200 dark:border-white/10">
                <div class="flex justify-between text-sm">
                  <span class="text-ink-700 dark:text-white/70">{{ cart.itemCount() }} artículos</span>
                  <span class="text-ink-950 dark:text-white font-semibold">\${{ cart.subtotal().toFixed(2) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-ink-700 dark:text-white/70">Envío</span>
                  <span class="text-ink-500 dark:text-white/50">A calcular</span>
                </div>
              </div>

              <div class="flex justify-between items-baseline pt-4 pb-6">
                <span class="font-bold text-ink-950 dark:text-white">TOTAL</span>
                <span class="font-display text-3xl font-bold text-ink-950 dark:text-white">
                  \${{ cart.subtotal().toFixed(2) }}
                </span>
              </div>

              <a routerLink="/checkout" class="w-full btn-accent text-sm uppercase tracking-widest py-4 block text-center">
                Proceder al pago <i class="fa-solid fa-arrow-right text-xs"></i>
              </a>
              <a routerLink="/shop" class="block text-center mt-3 text-xs uppercase tracking-widest text-ink-700 dark:text-white/70 hover:text-ink-950 dark:hover:text-white">
                <i class="fa-solid fa-arrow-left text-[10px]"></i> Seguir comprando
              </a>
            </div>

            <p class="text-xs text-ink-500 dark:text-white/40 mt-4 text-center">
              <i class="fa-solid fa-shield-halved text-emerald-500"></i> Pago seguro con PayPhone
            </p>
          </aside>
        </div>
      }
    </section>
  `,
})
export class CartPageComponent {
  cart = inject(CartService);

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
