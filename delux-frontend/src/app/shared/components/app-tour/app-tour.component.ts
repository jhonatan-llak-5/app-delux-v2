import {
  ChangeDetectionStrategy, Component, HostListener, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from './tour.service';

interface Box { top: number; left: number; width: number; height: number; }

@Component({
  selector: 'dlx-app-tour',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tour.active(); as _a) {
      <div class="dlx-tour fixed inset-0 z-[9999]" role="dialog" aria-modal="true">

        <!-- Overlay + spotlight -->
        @if (box(); as b) {
          <div class="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out"
               [style.top.px]="b.top" [style.left.px]="b.left"
               [style.width.px]="b.width" [style.height.px]="b.height"
               style="box-shadow: 0 0 0 9999px rgba(2,6,23,0.66);
                      outline: 2px solid rgba(59,130,246,0.9); outline-offset: 4px;"></div>
        } @else {
          <div class="absolute inset-0 bg-[#020617]/70 backdrop-blur-[1px]"
               (click)="tour.skip()"></div>
        }

        <!-- Popover -->
        <div class="dlx-tour-card absolute w-[340px] max-w-[calc(100vw-2rem)]
                    bg-white dark:bg-[#0f172a]
                    border border-slate-200 dark:border-white/10
                    rounded-2xl shadow-2xl shadow-black/30
                    overflow-hidden animate-tour-pop"
             [style.top.px]="cardTop()" [style.left.px]="cardLeft()">

          <!-- Barra de progreso -->
          <div class="h-1 bg-slate-100 dark:bg-white/10">
            <div class="h-full bg-gradient-to-r from-[#1e40af] to-[#3b82f6] transition-all duration-300"
                 [style.width.%]="progress()"></div>
          </div>

          <div class="p-5">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 shrink-0 rounded-xl bg-[#1e40af]/10 dark:bg-[#3b82f6]/15
                          grid place-items-center text-[#1e40af] dark:text-[#60a5fa]">
                <i class="fa-solid {{ tour.current()?.icon || 'fa-circle-info' }}"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] uppercase tracking-widest font-semibold
                          text-slate-400 dark:text-white/40">
                  Paso {{ tour.index() + 1 }} de {{ tour.total() }}
                </p>
                <h3 class="font-bold text-[16px] leading-tight text-ink-950 dark:text-white mt-0.5">
                  {{ tour.current()?.title }}
                </h3>
              </div>
              <button (click)="tour.skip()" aria-label="Cerrar"
                      class="w-7 h-7 -mr-1 -mt-1 grid place-items-center rounded-lg
                             text-slate-400 hover:text-ink-950 dark:hover:text-white
                             hover:bg-slate-100 dark:hover:bg-white/10 transition">
                <i class="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <p class="text-[13.5px] leading-relaxed text-slate-600 dark:text-white/65 mt-3">
              {{ tour.current()?.body }}
            </p>

            <!-- Dots -->
            <div class="flex items-center gap-1.5 mt-4">
              @for (s of tour.steps(); track $index) {
                <button (click)="tour.goTo($index)" [attr.aria-label]="'Ir al paso ' + ($index + 1)"
                        class="h-1.5 rounded-full transition-all"
                        [class.w-5]="$index === tour.index()"
                        [class.w-1.5]="$index !== tour.index()"
                        [style.background]="$index === tour.index() ? '#3b82f6' : 'rgba(148,163,184,0.4)'"></button>
              }
            </div>

            <!-- Acciones -->
            <div class="flex items-center justify-between mt-5">
              <button (click)="tour.skip()"
                      class="text-[12.5px] font-medium text-slate-400 hover:text-slate-600
                             dark:hover:text-white/70 transition">
                Saltar tour
              </button>
              <div class="flex items-center gap-2">
                @if (!tour.isFirst()) {
                  <button (click)="tour.prev()"
                          class="h-9 px-3.5 rounded-lg text-[13px] font-semibold
                                 text-slate-600 dark:text-white/70
                                 hover:bg-slate-100 dark:hover:bg-white/10 transition">
                    Atrás
                  </button>
                }
                <button (click)="tour.next()"
                        class="h-9 px-4 rounded-lg text-[13px] font-semibold text-white
                               bg-[#1e40af] hover:bg-[#1d4ed8] transition
                               inline-flex items-center gap-2">
                  {{ tour.isLast() ? 'Finalizar' : 'Siguiente' }}
                  <i class="fa-solid {{ tour.isLast() ? 'fa-check' : 'fa-arrow-right' }} text-[11px]"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes tour-pop {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .animate-tour-pop { animation: tour-pop .22s cubic-bezier(.16,1,.3,1); }
  `],
})
export class AppTourComponent {
  tour = inject(TourService);

  box = signal<Box | null>(null);
  cardTop = signal(0);
  cardLeft = signal(0);

  private readonly GAP = 14;
  private readonly CARD_W = 340;
  private readonly CARD_H = 230;

  constructor() {
    // Recalcula posición cada vez que cambia el paso o se (des)activa el tour.
    effect(() => {
      const active = this.tour.active();
      const step = this.tour.current();
      if (!active || !step) { this.box.set(null); return; }
      // Espera a que el DOM/scroll se asiente.
      setTimeout(() => this.layout(), 30);
    });
  }

  progress(): number {
    const t = this.tour.total();
    return t ? ((this.tour.index() + 1) / t) * 100 : 0;
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.tour.active()) this.layout();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (!this.tour.active()) return;
    if (ev.key === 'Escape') this.tour.skip();
    else if (ev.key === 'ArrowRight' || ev.key === 'Enter') this.tour.next();
    else if (ev.key === 'ArrowLeft') this.tour.prev();
  }

  private layout(): void {
    const step = this.tour.current();
    if (!step) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!step.target) {
      this.box.set(null);
      this.cardLeft.set(Math.max(16, (vw - this.CARD_W) / 2));
      this.cardTop.set(Math.max(16, (vh - this.CARD_H) / 2));
      return;
    }

    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) { this.box.set(null); return; }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    this.box.set({ top: r.top, left: r.left, width: r.width, height: r.height });

    const place = step.placement ?? 'bottom';
    let top = 0, left = 0;

    switch (place) {
      case 'right':
        left = r.right + this.GAP;
        top = r.top + r.height / 2 - this.CARD_H / 2;
        break;
      case 'left':
        left = r.left - this.CARD_W - this.GAP;
        top = r.top + r.height / 2 - this.CARD_H / 2;
        break;
      case 'top':
        top = r.top - this.CARD_H - this.GAP;
        left = r.left + r.width / 2 - this.CARD_W / 2;
        break;
      case 'bottom':
      default:
        top = r.bottom + this.GAP;
        left = r.left + r.width / 2 - this.CARD_W / 2;
        break;
    }

    // Si no cabe a la derecha, intenta debajo.
    if (left + this.CARD_W > vw - 12 && place === 'right') {
      left = r.left;
      top = r.bottom + this.GAP;
    }

    // Clamp al viewport.
    left = Math.min(Math.max(12, left), vw - this.CARD_W - 12);
    top = Math.min(Math.max(12, top), vh - this.CARD_H - 12);

    this.cardLeft.set(left);
    this.cardTop.set(top);
  }
}
