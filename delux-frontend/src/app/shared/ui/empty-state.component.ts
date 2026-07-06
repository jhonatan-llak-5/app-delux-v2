import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Estado vacío reutilizable. Dos estilos:
 *  - variant="panel" (default): tarjeta del panel admin (colores slate).
 *  - variant="store": estilo tienda (colores ink), para páginas de cliente.
 * El botón de acción (opcional) va como contenido proyectado.
 *
 *   <dlx-empty-state icon="fa-inbox" title="No hay datos" />
 *   <dlx-empty-state variant="store" icon="fa-cart-arrow-down" title="Tu carrito está vacío">
 *     <a routerLink="/shop" class="btn-accent">Explorar catálogo</a>
 *   </dlx-empty-state>
 */
@Component({
  selector: 'dlx-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant === 'store') {
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto rounded-full bg-ink-100 dark:bg-white/[0.05] grid place-items-center mb-5">
          <i class="fa-solid {{ icon }} text-ink-400 dark:text-white/30 text-[20px]"></i>
        </div>
        <h3 class="font-bold text-[20px] text-ink-950 dark:text-white mb-2">{{ title }}</h3>
        @if (description) {
          <p class="text-ink-600 dark:text-white/55 text-[14px] mb-6 max-w-md mx-auto">{{ description }}</p>
        }
        <ng-content />
      </div>
    } @else {
      <div class="eg-card-padded text-center py-12">
        <div class="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-4">
          <i class="fa-solid {{ icon }} text-slate-400 dark:text-white/35 text-[20px]"></i>
        </div>
        <h3 class="font-bold text-[16px] text-slate-900 dark:text-white mb-2">{{ title }}</h3>
        @if (description) {
          <p class="text-sm text-slate-500 dark:text-white/55 max-w-md mx-auto">{{ description }}</p>
        }
        <div class="mt-5"><ng-content /></div>
      </div>
    }
  `,
})
export class DlxEmptyStateComponent {
  @Input() icon = 'fa-inbox';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() variant: 'panel' | 'store' = 'panel';
}
