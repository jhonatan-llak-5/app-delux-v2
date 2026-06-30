import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '@core/services/branding.service';
import { imgOrPlaceholder, onImageError } from '@shared/utils/img-placeholder';
import { KioskSearchItem } from '../kiosk.service';

/**
 * Tarjeta reutilizable de resultado de búsqueda del kiosko.
 * Modo grid (tarjeta) o compacto (fila para el popup de búsqueda).
 */
@Component({
  selector: 'dlx-kiosk-result-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button (click)="select.emit(item)" class="w-full text-left transition flex items-center gap-4"
            [ngClass]="compact
              ? 'p-3 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-50 dark:border-white/5'
              : 'rounded-2xl p-4 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121826] hover:border-[#1e40af] dark:hover:border-[#3b82f6] hover:shadow-lg'">
      <div class="rounded-xl shrink-0 grid place-items-center overflow-hidden bg-slate-100 dark:bg-white/5"
           [ngClass]="compact ? 'w-14 h-14' : 'w-20 h-20'">
        <img [src]="imgSrc()" [alt]="item.name" class="w-full h-full object-cover" (error)="onErr($event)" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[11px] uppercase tracking-wider text-slate-400 dark:text-white/40 font-semibold truncate">{{ item.brand }}</p>
        <p class="font-bold truncate">{{ item.name }}</p>
        <div class="flex items-center gap-3 mt-1">
          <span class="font-extrabold text-[#1e40af] dark:text-[#7aa2ff]">{{ money(priceWithIva()) }}</span>
          @if (!compact) {
            <span class="text-sm text-slate-500 dark:text-white/50">{{ item.total_available }} disp.</span>
          }
        </div>
        @if (item.in_branch === false && (item.other_branches?.length || 0) > 0) {
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1 truncate">
            <i class="fa-solid fa-store"></i> En otra sucursal: {{ item.other_branches?.join(', ') }}
          </p>
        }
      </div>
    </button>
  `,
})
export class KioskResultCardComponent {
  private branding = inject(BrandingService);

  @Input({ required: true }) item!: KioskSearchItem;
  @Input() compact = false;
  @Output() select = new EventEmitter<KioskSearchItem>();

  imgSrc(): string { return imgOrPlaceholder(this.item?.image); }
  onErr(ev: Event): void { onImageError(ev); }

  priceWithIva(): number {
    const n = +(this.item?.base_price ?? 0) || 0;
    return n * (1 + (+this.branding.taxRate() || 0) / 100);
  }
  money(v: number): string {
    return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2);
  }
}
