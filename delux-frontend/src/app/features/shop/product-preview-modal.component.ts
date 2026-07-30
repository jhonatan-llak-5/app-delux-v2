import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import {
  PublicCatalogService,
  PublicProduct,
  PublicProductDetail,
} from '@shared/services/public-catalog.service';

/**
 * Vista previa (lightbox) de un producto del catálogo.
 * Recibe la lista de productos visibles y el índice actual, y permite
 * navegar prev/next dentro de esa lista. Enriquece la ficha con la
 * descripción y la galería del detalle (getProduct) de forma perezosa.
 */
@Component({
  selector: 'dlx-product-preview-modal',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center"
         role="dialog" aria-modal="true">
      <!-- Overlay -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></div>

      @if (product(); as p) {
        <!-- Flecha anterior -->
        <button type="button" (click)="prev()" [disabled]="!canPrev()" aria-label="Anterior"
                class="hidden sm:grid place-items-center absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 text-slate-700 shadow-lg hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed dark:bg-[#1e293b]/90 dark:text-slate-200 dark:hover:bg-[#1e293b]">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <!-- Flecha siguiente -->
        <button type="button" (click)="next()" [disabled]="!canNext()" aria-label="Siguiente"
                class="hidden sm:grid place-items-center absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 text-slate-700 shadow-lg hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed dark:bg-[#1e293b]/90 dark:text-slate-200 dark:hover:bg-[#1e293b]">
          <i class="fa-solid fa-chevron-right"></i>
        </button>

        <!-- Panel -->
        <div class="relative z-10 w-full h-full sm:h-auto sm:max-h-[92vh] sm:w-[min(1000px,94vw)] sm:rounded-2xl bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden flex flex-col">
          <!-- Barra superior: contador + cerrar -->
          <div class="flex items-center justify-between px-4 h-14 shrink-0 border-b border-slate-200 dark:border-[#1e293b]">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {{ current() + 1 }} de {{ total() }}
            </span>
            <div class="flex items-center gap-1.5 sm:hidden">
              <button type="button" (click)="prev()" [disabled]="!canPrev()" aria-label="Anterior"
                      class="w-9 h-9 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-[#1e293b]">
                <i class="fa-solid fa-chevron-left text-sm"></i>
              </button>
              <button type="button" (click)="next()" [disabled]="!canNext()" aria-label="Siguiente"
                      class="w-9 h-9 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-[#1e293b]">
                <i class="fa-solid fa-chevron-right text-sm"></i>
              </button>
            </div>
            <button type="button" (click)="close.emit()" aria-label="Cerrar"
                    class="w-9 h-9 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1e293b]">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          <!-- Cuerpo -->
          <div class="grid md:grid-cols-2 min-h-0 flex-1 overflow-y-auto">
            <!-- Imagen / galería -->
            <div class="flex flex-col bg-slate-100 dark:bg-[#0b1120]">
              <div class="relative flex-1 min-h-[280px] sm:min-h-[420px] grid place-items-center p-4">
                <div class="relative max-w-full max-h-[52vh] overflow-hidden touch-none select-none"
                     [ngClass]="zoomActive() ? 'cursor-zoom-out' : 'cursor-zoom-in'"
                     (wheel)="onImageWheel($event)"
                     (mousemove)="onImageMouseMove($event)"
                     (mouseleave)="onImageLeave()"
                     (dblclick)="toggleZoom()">
                  <img [src]="activeImage() || placeholder" [alt]="p.name" draggable="false"
                       class="max-w-full max-h-[52vh] w-auto h-auto object-contain transition-transform duration-100 ease-out will-change-transform"
                       [style.transform]="'scale(' + zoomLevel() + ')'"
                       [style.transform-origin]="originX() + '% ' + originY() + '%'"
                       dlxImgFallback />
                </div>
                <!-- Botón de zoom -->
                <button type="button" (click)="toggleZoom()"
                        [attr.aria-label]="zoomActive() ? 'Alejar' : 'Acercar'"
                        class="absolute bottom-3 right-3 z-10 w-10 h-10 grid place-items-center rounded-full bg-white/90 text-slate-700 shadow-lg hover:bg-white transition dark:bg-[#1e293b]/90 dark:text-slate-200 dark:hover:bg-[#1e293b]">
                  <i class="fa-solid" [ngClass]="zoomActive() ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'"></i>
                </button>
                @if (isPromo(p)) {
                  <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-rose-600 text-white shadow">
                    Oferta -{{ discount(p) }}%
                  </span>
                }
                @if (soldOut(p)) {
                  <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-ink-950/80 text-white">Agotado</span>
                }
              </div>
              @if (images().length > 1) {
                <div class="flex gap-2 p-3 overflow-x-auto flex-nowrap border-t border-slate-200 dark:border-[#1e293b]">
                  @for (img of images(); track img; let i = $index) {
                    <button type="button" (click)="selectImage(img)"
                            class="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition"
                            [ngClass]="activeImage() === img ? 'border-emerald-500' : 'border-transparent opacity-70 hover:opacity-100'">
                      <img [src]="img" [alt]="p.name + ' ' + (i + 1)" class="w-full h-full object-cover" dlxImgFallback />
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Información -->
            <div class="p-5 sm:p-6 flex flex-col gap-4">
              <div>
                <p class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{{ p.brand_name }}</p>
                <h2 class="text-xl sm:text-2xl font-bold tracking-tight leading-snug mt-0.5">{{ p.name }}</h2>
                @if (p.category_name) {
                  <p class="text-xs text-slate-400 mt-1">{{ p.category_name }}</p>
                }
              </div>

              <div class="flex items-baseline gap-3">
                <span class="text-3xl font-black text-emerald-600 dark:text-emerald-400">\${{ money(p.base_price) }}</span>
                @if (isPromo(p)) {
                  <span class="text-base text-slate-400 line-through">\${{ money(p.compare_at_price) }}</span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">-{{ discount(p) }}%</span>
                }
              </div>

              <!-- Disponibilidad -->
              <p class="text-sm flex items-center gap-2 font-semibold"
                 [ngClass]="(p.total_stock ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">
                <i class="fa-solid text-xs" [ngClass]="(p.total_stock ?? 0) > 0 ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
                {{ (p.total_stock ?? 0) > 0 ? (p.total_stock + ' disponibles') : 'Sin stock' }}
              </p>

              <!-- Tallas -->
              @if (p.sizes?.length) {
                <div>
                  <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Tallas</p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (s of p.sizes!; track s) {
                      <span class="px-2.5 h-7 inline-flex items-center rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 dark:bg-[#1e293b] dark:border-[#334155] dark:text-slate-200">{{ s }}</span>
                    }
                  </div>
                </div>
              }

              <!-- Colores -->
              @if (p.colors?.length) {
                <div>
                  <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Colores</p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (c of p.colors!; track c) {
                      <span class="px-2.5 h-7 inline-flex items-center rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 dark:bg-[#1e293b] dark:border-[#334155] dark:text-slate-200">{{ c }}</span>
                    }
                  </div>
                </div>
              }

              <!-- Descripción -->
              <div class="mt-1">
                <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Descripción</p>
                @if (loadingDetail()) {
                  <p class="text-sm text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Cargando…</p>
                } @else if (description()) {
                  <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{{ description() }}</p>
                } @else {
                  <p class="text-sm text-slate-400 italic">Sin descripción disponible.</p>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProductPreviewModalComponent implements OnInit, OnDestroy {
  private catalog = inject(PublicCatalogService);

  placeholder = IMG_PLACEHOLDER;

  @Input() products: PublicProduct[] = [];
  @Input() set index(v: number) {
    const i = Number(v) || 0;
    this.current.set(i);
    this.syncCurrent();
  }

  @Output() close = new EventEmitter<void>();

  current = signal(0);
  detail = signal<PublicProductDetail | null>(null);
  loadingDetail = signal(false);
  activeImage = signal<string>('');

  // --- Zoom ---
  zoomLevel = signal(1);
  originX = signal(50);
  originY = signal(50);
  zoomActive = computed(() => this.zoomLevel() > this.minZoom);
  private readonly minZoom = 1;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.5;

  product = computed<PublicProduct | null>(() => this.products[this.current()] ?? null);
  total = computed(() => this.products.length);
  canPrev = computed(() => this.current() > 0);
  canNext = computed(() => this.current() < this.products.length - 1);

  images = computed<string[]>(() => {
    const d = this.detail();
    const p = this.product();
    if (d && Array.isArray(d.images) && d.images.length) return d.images;
    const main = p?.main_image_url || p?.thumb_url || '';
    return main ? [main] : [];
  });

  description = computed<string>(() => {
    const d = this.detail();
    if (!d) return '';
    return (d.description || d.short_description || '').trim();
  });

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
    this.syncCurrent();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close.emit(); }

  @HostListener('document:keydown.arrowLeft')
  onArrowLeft(): void { this.prev(); }

  @HostListener('document:keydown.arrowRight')
  onArrowRight(): void { this.next(); }

  prev(): void { if (this.canPrev()) { this.current.set(this.current() - 1); this.syncCurrent(); } }
  next(): void { if (this.canNext()) { this.current.set(this.current() + 1); this.syncCurrent(); } }

  /** Selecciona una miniatura de la galería y reinicia el zoom. */
  selectImage(img: string): void {
    this.activeImage.set(img);
    this.resetZoom();
  }

  /** Reinicia el zoom a 1x y centra el origen. */
  resetZoom(): void {
    this.zoomLevel.set(1);
    this.originX.set(50);
    this.originY.set(50);
  }

  /** Alterna entre zoom (2x) y sin zoom. Usado por el botón, doble click y tap en móvil. */
  toggleZoom(): void {
    if (this.zoomLevel() > this.minZoom) {
      this.resetZoom();
    } else {
      this.zoomLevel.set(2);
    }
  }

  /** Zoom con la rueda del mouse; solo previene el scroll cuando actúa sobre la imagen. */
  onImageWheel(e: WheelEvent): void {
    e.preventDefault();
    this.updateOrigin(e);
    const next = this.zoomLevel() + (e.deltaY < 0 ? this.zoomStep : -this.zoomStep);
    const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, Math.round(next * 100) / 100));
    this.zoomLevel.set(clamped);
  }

  /** Pan: la imagen sigue al cursor mientras hay zoom activo. */
  onImageMouseMove(e: MouseEvent): void {
    if (this.zoomLevel() <= this.minZoom) return;
    this.updateOrigin(e);
  }

  /** Al salir del área, recentra el origen sin desactivar el zoom. */
  onImageLeave(): void {
    if (this.zoomLevel() <= this.minZoom) return;
    this.originX.set(50);
    this.originY.set(50);
  }

  /** Calcula el transform-origin (%) a partir de la posición del cursor. */
  private updateOrigin(e: MouseEvent | WheelEvent): void {
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    this.originX.set(Math.min(100, Math.max(0, x)));
    this.originY.set(Math.min(100, Math.max(0, y)));
  }

  isPromo(p: PublicProduct): boolean {
    return !!p.compare_at_price && Number(p.compare_at_price) > Number(p.base_price);
  }
  soldOut(p: PublicProduct): boolean { return (p.total_stock ?? 0) <= 0; }
  discount(p: PublicProduct): number {
    const b = Number(p.base_price) || 0;
    const c = Number(p.compare_at_price) || 0;
    if (c <= b || c <= 0) return 0;
    return Math.round((1 - b / c) * 100);
  }
  money(v: string | number | null | undefined): string {
    return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  }

  /** Sincroniza galería/descripción con el producto actual y carga el detalle. */
  private syncCurrent(): void {
    const p = this.product();
    this.detail.set(null);
    this.resetZoom();
    if (!p) { this.activeImage.set(''); return; }
    this.activeImage.set(p.main_image_url || p.thumb_url || '');
    this.loadDetail(p.id);
  }

  private loadDetail(id: number): void {
    this.loadingDetail.set(true);
    this.catalog.getProduct(id).subscribe({
      next: d => {
        this.loadingDetail.set(false);
        // Solo aplica si seguimos en el mismo producto.
        if (this.product()?.id === id) {
          this.detail.set(d);
          if (Array.isArray(d.images) && d.images.length) {
            this.activeImage.set(d.images[0]);
            this.resetZoom();
          }
        }
      },
      error: () => this.loadingDetail.set(false),
    });
  }
}
