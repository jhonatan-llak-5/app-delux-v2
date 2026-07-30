import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZoneService } from '@shared/services/zone.service';

@Component({
  selector: 'dlx-zone-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (zone.pickerOpen()) {
      <div class="fixed inset-0 z-[9998] flex items-center justify-center p-4"
           (click)="onBackdrop()">
        <div class="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"></div>

        <div class="relative w-full max-w-lg bg-white dark:bg-[#0f172a]
                    border border-ink-200 dark:border-white/10
                    rounded-3xl shadow-2xl overflow-hidden animate-slide-down"
             (click)="$event.stopPropagation()">

          <div class="p-6 pb-4 border-b border-ink-100 dark:border-white/10">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="w-11 h-11 rounded-2xl bg-[#0095f6]/10 grid place-items-center mb-3">
                  <i class="fa-solid fa-location-dot text-[#0095f6] text-lg"></i>
                </div>
                <h2 class="font-bold text-xl text-ink-950 dark:text-white">Elige tu provincia</h2>
                <p class="text-sm text-ink-500 dark:text-white/55 mt-1">
                  Te mostramos solo los productos disponibles en tu provincia.
                </p>
              </div>
              @if (zone.hasProvince()) {
                <button (click)="zone.closePicker()" aria-label="Cerrar"
                        class="w-8 h-8 grid place-items-center rounded-lg text-ink-400
                               hover:bg-ink-100 dark:hover:bg-white/10 transition">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              }
            </div>

            <button (click)="locate()" [disabled]="locating()"
                    class="mt-4 w-full h-11 rounded-xl border border-ink-200 dark:border-white/15
                           text-sm font-semibold text-ink-700 dark:text-white/80
                           hover:bg-ink-50 dark:hover:bg-white/5 transition
                           inline-flex items-center justify-center gap-2 disabled:opacity-50">
              @if (locating()) {
                <i class="fa-solid fa-spinner fa-spin"></i> Detectando...
              } @else {
                <i class="fa-solid fa-crosshairs text-[#0095f6]"></i> Usar mi ubicación
              }
            </button>
            @if (geoError()) {
              <p class="text-xs text-rose-500 mt-2 text-center">{{ geoError() }}</p>
            }
          </div>

          <div class="p-4 max-h-[50vh] overflow-y-auto">
            @if (zone.provinces().length === 0) {
              <p class="text-center text-ink-400 py-8 text-sm">No hay provincias disponibles.</p>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                @for (p of zone.provinces(); track p.province) {
                  <button (click)="zone.setProvince(p.province)"
                          class="text-left p-4 rounded-2xl border transition group"
                          [class.border-ink-200]="zone.province() !== p.province"
                          [class.dark:border-white/10]="zone.province() !== p.province"
                          [class.hover:border-[#0095f6]]="zone.province() !== p.province"
                          [style.border-color]="zone.province() === p.province ? '#0095f6' : ''"
                          [style.background]="zone.province() === p.province ? 'rgba(0,149,246,0.12)' : ''">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-ink-950 dark:text-white">{{ p.province }}</span>
                      <i class="fa-solid fa-arrow-right text-[#0095f6] text-xs
                                opacity-0 group-hover:opacity-100 transition"></i>
                    </div>
                    <p class="text-xs text-ink-500 dark:text-white/50 mt-1">
                      {{ p.branches.length }} sucursal{{ p.branches.length === 1 ? '' : 'es' }}
                      @if (p.count > 0) { · {{ p.count }} productos }
                    </p>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ZonePickerComponent {
  zone = inject(ZoneService);
  locating = signal(false);
  geoError = signal<string | null>(null);

  onBackdrop(): void {
    // Solo permite cerrar tocando fuera si ya hay una provincia elegida.
    if (this.zone.hasProvince()) this.zone.closePicker();
  }

  async locate(): Promise<void> {
    this.geoError.set(null);
    this.locating.set(true);
    const province = await this.zone.useGeolocation();
    this.locating.set(false);
    if (!province) this.geoError.set('No pudimos detectar tu provincia. Elígela manualmente.');
  }
}
