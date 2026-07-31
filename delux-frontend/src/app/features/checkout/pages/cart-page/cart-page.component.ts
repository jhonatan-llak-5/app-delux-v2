import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '@features/checkout/services/cart.service';

@Component({
  selector: 'dlx-cart-page',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1200px] mx-auto px-6 md:px-10 pt-32 pb-24 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Carrito</p>
      <h1 class="display-xl text-5xl md:text-6xl mt-4 mb-12 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Tu carrito
      </h1>

      @if (cart.lines().length === 0) {
        <dlx-empty-state variant="store" icon="fa-cart-arrow-down" title="Tu carrito está vacío">
          <a routerLink="/shop" class="btn-accent text-sm font-semibold px-8 py-4">
            <i class="fa-solid fa-arrow-left text-xs"></i> Explorar catálogo
          </a>
        </dlx-empty-state>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <!-- Items agrupados por sucursal -->
          <div class="space-y-4">
            @if (cart.branchCount() > 1) {
              <div class="flex items-start gap-2.5 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-4 py-3">
                <i class="fa-solid fa-circle-info text-sky-600 dark:text-sky-400 mt-0.5"></i>
                <p class="text-[13px] text-ink-700 dark:text-white/75 leading-snug">
                  Tu pedido contiene productos de <strong>diferentes sucursales</strong>. Se procesará en paquetes separados.
                </p>
              </div>
            }

            @for (g of cart.groups(); track g.branch_id) {
              <div class="editorial-card overflow-hidden">
                <div class="flex items-center gap-2 px-5 py-3.5 border-b border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-white/[0.03]">
                  <i class="fa-solid fa-store text-accent-600 dark:text-accent-400 text-sm"></i>
                  <h3 class="font-semibold text-ink-950 dark:text-white text-sm">Productos en {{ g.branch_name }}</h3>
                </div>
                <ul>
                  @for (row of g.lines; track row.item.variant_id) {
                    <li class="flex gap-4 p-5 border-b border-ink-200 dark:border-white/10 last:border-0">
                      <a [routerLink]="['/product', row.item.product_id]"
                         class="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-ink-100 dark:bg-white/5 shrink-0">
                        <img [src]="row.item.product_image" [alt]="row.item.product_name"
                             class="w-full h-full object-cover"
 dlxImgFallback />
                      </a>
                      <div class="flex-1 min-w-0">
                        @if (row.item.brand_name) {
                          <p class="text-[10px] font-mono uppercase tracking-widest text-ink-500 dark:text-white/40">{{ row.item.brand_name }}</p>
                        }
                        <a [routerLink]="['/product', row.item.product_id]" class="font-semibold text-base md:text-lg text-ink-950 dark:text-white hover:underline">
                          {{ row.item.product_name }}
                        </a>
                        <p class="text-xs text-ink-500 dark:text-white/50 mt-1 font-mono">
                          Talla {{ row.item.size }} · {{ row.item.color }} · {{ row.item.sku }}
                        </p>
                        <div class="flex items-center gap-4 mt-4">
                          <div class="flex items-center gap-2 border border-ink-200 dark:border-white/20 rounded-lg">
                            <button (click)="cart.changeQty(row.index, -1)"
                                    class="w-9 h-9 grid place-items-center hover:bg-ink-100 dark:hover:bg-white/10 rounded-l-lg">
                              <i class="fa-solid fa-minus text-xs"></i>
                            </button>
                            <span class="w-8 text-center font-bold">{{ row.item.quantity }}</span>
                            <button (click)="cart.changeQty(row.index, 1)" [disabled]="row.item.quantity >= row.item.max_stock"
                                    class="w-9 h-9 grid place-items-center hover:bg-ink-100 dark:hover:bg-white/10 rounded-r-lg disabled:opacity-30">
                              <i class="fa-solid fa-plus text-xs"></i>
                            </button>
                          </div>
                          <button (click)="cart.remove(row.index)"
                                  class="text-rose-500 hover:text-rose-700 text-sm flex items-center gap-1">
                            <i class="fa-solid fa-trash text-xs"></i> Quitar
                          </button>
                        </div>
                      </div>
                      <div class="text-right">
                        <p class="font-display text-xl font-bold text-ink-950 dark:text-white">
                          \${{ (row.item.unit_price * row.item.quantity).toFixed(2) }}
                        </p>
                        @if (row.item.quantity > 1) {
                          <p class="text-xs text-ink-500 dark:text-white/40 mt-1">
                            \${{ row.item.unit_price.toFixed(2) }} c/u
                          </p>
                        }
                      </div>
                    </li>
                  }
                </ul>
                <div class="flex justify-between items-center px-5 py-3.5 bg-ink-50 dark:bg-white/[0.03]">
                  <span class="text-sm text-ink-700 dark:text-white/70">Subtotal · {{ g.branch_name }}</span>
                  <span class="font-display font-bold text-ink-950 dark:text-white">\${{ g.subtotal.toFixed(2) }}</span>
                </div>
              </div>
            }
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

              <a routerLink="/checkout" class="w-full btn-accent text-sm font-semibold py-4 block text-center">
                Proceder al pago <i class="fa-solid fa-arrow-right text-xs"></i>
              </a>
              <a routerLink="/shop" class="block text-center mt-3 text-xs uppercase tracking-widest text-ink-700 dark:text-white/70 hover:text-ink-950 dark:hover:text-white">
                <i class="fa-solid fa-arrow-left text-[10px]"></i> Seguir comprando
              </a>
            </div>

          </aside>
        </div>
      }
    </section>
  `,
})
export class CartPageComponent {
  cart = inject(CartService);

}
