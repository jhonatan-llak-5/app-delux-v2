import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { BrandingService } from '@core/services/branding.service';
import { PublicCatalogService, PublicProduct } from '@shared/services/public-catalog.service';
import { PublicBranchesService } from '@shared/services/public-branches.service';
import { ProductPreviewModalComponent } from './product-preview-modal.component';

interface Section { title: string; promo: boolean; items: PublicProduct[]; }

@Component({
  selector: 'dlx-catalog-page',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective, ProductPreviewModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 text-ink-950 dark:bg-[#0b1120] dark:text-slate-100">
      <!-- Header -->
      <header class="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 dark:bg-[#0f172a]/90 dark:border-[#1e293b]">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <img [src]="branding.logoUrl()" alt="logo" class="h-8 w-auto shrink-0" dlxImgFallback />
            <div class="hidden sm:flex flex-col border-l border-slate-200 dark:border-[#1e293b] pl-3 min-w-0">
              <span class="text-sm font-semibold truncate">{{ branding.siteName() }}</span>
              <span class="text-[11px] text-slate-400 leading-tight">
                Catálogo@if (branchName()) { <span> · {{ branchName() }}</span> }
              </span>
            </div>
          </div>
          <button type="button" (click)="share()"
                  class="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-ink-950 text-white text-sm font-semibold hover:bg-black dark:bg-white dark:text-ink-950 dark:hover:bg-slate-200">
            <i class="fa-solid fa-share-nodes"></i>
            <span class="hidden sm:inline">Compartir</span>
          </button>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 py-8">
        @if (loading()) {
          <div class="py-24 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-3xl"></i></div>
        } @else if (all().length === 0) {
          <div class="py-24 flex flex-col items-center text-center">
            <div class="w-20 h-20 rounded-full grid place-items-center bg-slate-100 dark:bg-[#1e293b] mb-4">
              <i class="fa-solid fa-box-open text-3xl text-slate-400"></i>
            </div>
            <h2 class="text-lg font-bold tracking-tight">Aún no hay productos</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs">
              @if (branchName()) { Esta sucursal todavía no tiene productos publicados. }
              @else { Pronto encontrarás aquí nuestro catálogo. }
            </p>
          </div>
        } @else {
          <!-- Hero -->
          <div class="mb-8">
            @if (branchName()) {
              <span class="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 dark:bg-[#0f172a] dark:border-[#1e293b] dark:text-slate-300 mb-3">
                <i class="fa-solid fa-store text-slate-400"></i> Sucursal: {{ branchName() }}
              </span>
            }
            <h1 class="text-3xl md:text-5xl font-black tracking-tight">{{ branding.siteName() }}</h1>
            <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">
              {{ all().length }} {{ all().length === 1 ? 'producto' : 'productos' }} · {{ sections().length }} {{ sections().length === 1 ? 'categoría' : 'categorías' }}
            </p>
          </div>

          <!-- Índice de categorías (sticky bajo el header) -->
          <div class="sticky top-16 z-30 -mx-4 px-4 py-3 mb-10 bg-slate-50/90 backdrop-blur border-b border-slate-200 shadow-sm dark:bg-[#0b1120]/90 dark:border-[#1e293b]">
            <div class="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible">
              @for (s of sections(); track s.title) {
                <button type="button" (click)="scrollTo(s.title)"
                   class="shrink-0 px-3 h-9 inline-flex items-center whitespace-nowrap rounded-full text-xs font-semibold border transition"
                   [ngClass]="s.promo ? 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:bg-[#0f172a] dark:border-[#1e293b] dark:text-slate-300 dark:hover:bg-[#1e293b]'">
                  {{ s.title }} <span class="ml-1 opacity-60">{{ s.items.length }}</span>
                </button>
              }
            </div>
          </div>

          @for (s of sections(); track s.title) {
            <section [id]="'sec-' + slug(s.title)" class="mb-14 scroll-mt-24">
              <div class="flex items-center gap-3 mb-6">
                <h2 class="text-xl md:text-2xl font-bold tracking-tight"
                    [ngClass]="s.promo ? 'text-rose-600 dark:text-rose-400' : ''">
                  @if (s.promo) { <i class="fa-solid fa-fire mr-1.5"></i> }{{ s.title }}
                </h2>
                <span class="h-px flex-1 bg-slate-200 dark:bg-[#1e293b]"></span>
                <span class="text-xs text-slate-400">{{ s.items.length }}</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                @for (p of s.items; track p.id) {
                  <article (click)="openPreview(p)" (keydown.enter)="openPreview(p)" role="button" tabindex="0"
                           class="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#0f172a] dark:border-[#1e293b]">
                    <div class="relative aspect-square bg-slate-100 dark:bg-[#1e293b] overflow-hidden">
                      <img [src]="p.thumb_url || p.main_image_url || placeholder" [alt]="p.name"
                           class="w-full h-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" dlxImgFallback
                           [class.opacity-50]="soldOut(p)" />
                      @if (isPromo(p)) {
                        <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-600 text-white shadow">Oferta</span>
                      }
                      @if (soldOut(p)) {
                        <span class="absolute inset-0 grid place-items-center">
                          <span class="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-ink-950/80 text-white">Agotado</span>
                        </span>
                      }
                      <button type="button" (click)="$event.stopPropagation(); copyProduct(p)" title="Copiar información"
                              class="absolute bottom-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-white/90 hover:bg-white shadow text-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition">
                        <i class="fa-solid text-xs" [class.fa-copy]="copiedId() !== p.id" [class.fa-check]="copiedId() === p.id" [class.text-emerald-600]="copiedId() === p.id"></i>
                      </button>
                    </div>
                    <div class="p-3.5 flex flex-col gap-1 flex-1">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">{{ p.brand_name }}</p>
                      <p class="font-semibold text-sm leading-snug line-clamp-2">{{ p.name }}</p>
                      <div class="flex items-baseline gap-2 mt-0.5">
                        <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">\${{ money(p.base_price) }}</span>
                        @if (isPromo(p)) {
                          <span class="text-xs text-slate-400 line-through">\${{ money(p.compare_at_price) }}</span>
                        }
                      </div>
                      @if (p.sizes?.length) {
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span class="font-semibold text-slate-600 dark:text-slate-300">Tallas:</span> {{ p.sizes!.join(', ') }}</p>
                      }
                      @if (p.colors?.length) {
                        <p class="text-[11px] text-slate-500 dark:text-slate-400"><span class="font-semibold text-slate-600 dark:text-slate-300">Colores:</span> {{ p.colors!.join(', ') }}</p>
                      }
                      <p class="text-[11px] mt-auto pt-1.5 flex items-center gap-1.5"
                         [ngClass]="(p.total_stock ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">
                        <i class="fa-solid text-[9px]" [ngClass]="(p.total_stock ?? 0) > 0 ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
                        {{ (p.total_stock ?? 0) > 0 ? (p.total_stock + ' disponibles') : 'Sin stock' }}
                      </p>
                    </div>
                  </article>
                }
              </div>
            </section>
          }

          <footer class="text-center text-xs text-slate-400 py-10 border-t border-slate-200 dark:border-[#1e293b]">
            Catálogo generado por {{ branding.siteName() }}
          </footer>
        }
      </main>

      @if (previewIndex() !== null) {
        <dlx-product-preview-modal
          [products]="flatItems()"
          [index]="previewIndex()!"
          (close)="previewIndex.set(null)" />
      }
    </div>
  `,
})
export class CatalogPageComponent implements OnInit {
  protected branding = inject(BrandingService);
  private catalog = inject(PublicCatalogService);
  private branchesSvc = inject(PublicBranchesService);
  private route = inject(ActivatedRoute);

  placeholder = IMG_PLACEHOLDER;
  loading = signal(true);
  all = signal<PublicProduct[]>([]);
  copiedId = signal<number | null>(null);
  branchId = signal<number | null>(null);
  branchName = signal<string>('');
  previewIndex = signal<number | null>(null);

  sections = computed<Section[]>(() => {
    const list = this.all();
    const out: Section[] = [];
    const promos = list.filter(p => this.isPromo(p));
    if (promos.length) out.push({ title: 'Promociones', promo: true, items: promos });
    const byCat = new Map<string, PublicProduct[]>();
    for (const p of list) {
      const k = p.category_name || 'Otros';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(p);
    }
    [...byCat.keys()].sort((a, b) => a.localeCompare(b))
      .forEach(k => out.push({ title: k, promo: false, items: byCat.get(k)! }));
    return out;
  });

  // Lista plana en el mismo orden en que se ve el grid (para navegar en el modal).
  flatItems = computed<PublicProduct[]>(() => this.sections().flatMap(s => s.items));

  openPreview(p: PublicProduct): void {
    const i = this.flatItems().indexOf(p);
    this.previewIndex.set(i >= 0 ? i : 0);
  }

  ngOnInit(): void {
    this.branding.load();

    // Filtro por sucursal desde el query param ?sucursal=<id>
    const raw = this.route.snapshot.queryParamMap.get('sucursal');
    const bId = raw != null && raw !== '' && !isNaN(Number(raw)) ? Number(raw) : null;
    this.branchId.set(bId);

    if (bId != null) {
      this.branchesSvc.list().subscribe({
        next: r => { this.branchName.set((r.results || []).find(b => b.id === bId)?.name ?? ''); },
        error: () => {},
      });
    }

    const params: { page_size: number; sort: 'featured'; branch?: number } = { page_size: 200, sort: 'featured' };
    if (bId != null) params.branch = bId;
    this.catalog.listProducts(params).subscribe({
      next: r => { this.all.set(r.results || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isPromo(p: PublicProduct): boolean {
    return !!p.compare_at_price && Number(p.compare_at_price) > Number(p.base_price);
  }
  soldOut(p: PublicProduct): boolean { return (p.total_stock ?? 0) <= 0; }
  money(v: string | number | null | undefined): string {
    return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  }
  slug(s: string): string { return (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'); }
  scrollTo(title: string): void {
    if (typeof document === 'undefined') return;
    document.getElementById('sec-' + this.slug(title))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  copyProduct(p: PublicProduct): void {
    const price = '$' + this.money(p.base_price) + (this.isPromo(p) ? ' (antes $' + this.money(p.compare_at_price) + ')' : '');
    const parts = [p.name + ' — ' + p.brand_name, 'Precio: ' + price];
    if (p.sizes?.length) parts.push('Tallas: ' + p.sizes.join(', '));
    if (p.colors?.length) parts.push('Colores: ' + p.colors.join(', '));
    parts.push('Stock: ' + ((p.total_stock ?? 0) > 0 ? (p.total_stock + ' disponibles') : 'agotado'));
    if (typeof window !== 'undefined') parts.push(window.location.href);
    navigator.clipboard?.writeText(parts.join('\n')).then(() => {
      this.copiedId.set(p.id);
      setTimeout(() => { if (this.copiedId() === p.id) this.copiedId.set(null); }, 2000);
    }).catch(() => {});
  }
  share(): void {
    const url = (typeof window !== 'undefined' ? window.location.href : '');
    const nav = navigator as any;
    if (nav.share) { nav.share({ title: this.branding.siteName(), text: 'Mira nuestro catálogo', url }).catch(() => {}); }
    else { navigator.clipboard?.writeText(url); }
  }
}
