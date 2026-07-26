import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { BrandingService } from '@core/services/branding.service';
import { PublicCatalogService, PublicProduct } from '@shared/services/public-catalog.service';

interface Section { title: string; promo: boolean; items: PublicProduct[]; }

@Component({
  selector: 'dlx-catalog-page',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 text-ink-950">
      <!-- Header -->
      <header class="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <img [src]="branding.logoUrl()" alt="logo" class="h-8 w-auto" dlxImgFallback />
            <span class="hidden sm:block text-sm text-slate-400 border-l border-slate-200 pl-3">Catálogo</span>
          </div>
          <button type="button" (click)="share()"
                  class="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-ink-950 text-white text-sm font-semibold hover:bg-black">
            <i class="fa-solid fa-share-nodes"></i>
            <span class="hidden sm:inline">Compartir</span>
          </button>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 py-8">
        @if (loading()) {
          <div class="py-24 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-3xl"></i></div>
        } @else if (all().length === 0) {
          <div class="py-24 text-center text-slate-400">
            <i class="fa-solid fa-box-open text-4xl mb-3"></i>
            <p>Aún no hay productos en el catálogo.</p>
          </div>
        } @else {
          <div class="mb-8">
            <h1 class="text-3xl md:text-4xl font-black tracking-tight">{{ branding.siteName() }}</h1>
            <p class="text-slate-500 mt-1">{{ all().length }} productos · {{ sections().length }} categorías</p>
          </div>

          <!-- Índice de categorías -->
          <div class="flex flex-wrap gap-2 mb-10">
            @for (s of sections(); track s.title) {
              <button type="button" (click)="scrollTo(s.title)"
                 class="px-3 h-9 inline-flex items-center rounded-full text-xs font-semibold border"
                 [ngClass]="s.promo ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'">
                {{ s.title }} ({{ s.items.length }})
              </button>
            }
          </div>

          @for (s of sections(); track s.title) {
            <section [id]="'sec-' + slug(s.title)" class="mb-12 scroll-mt-20">
              <div class="flex items-center gap-3 mb-5">
                <h2 class="text-xl font-bold tracking-tight"
                    [ngClass]="s.promo ? 'text-rose-600' : ''">
                  @if (s.promo) { <i class="fa-solid fa-fire mr-1.5"></i> }{{ s.title }}
                </h2>
                <span class="h-px flex-1 bg-slate-200"></span>
                <span class="text-xs text-slate-400">{{ s.items.length }}</span>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                @for (p of s.items; track p.id) {
                  <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                    <div class="relative aspect-square bg-slate-100">
                      <img [src]="p.thumb_url || p.main_image_url || placeholder" [alt]="p.name"
                           class="w-full h-full object-cover" loading="lazy" dlxImgFallback
                           [class.opacity-60]="soldOut(p)" />
                      @if (isPromo(p)) {
                        <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-600 text-white">Oferta</span>
                      }
                      @if (soldOut(p)) {
                        <span class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-ink-950/80 text-white">Agotado</span>
                      }
                      <button type="button" (click)="copyProduct(p)" title="Copiar información"
                              class="absolute bottom-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-white/90 hover:bg-white shadow text-slate-700">
                        <i class="fa-solid text-xs" [class.fa-copy]="copiedId() !== p.id" [class.fa-check]="copiedId() === p.id" [class.text-emerald-600]="copiedId() === p.id"></i>
                      </button>
                    </div>
                    <div class="p-3.5 flex flex-col gap-1 flex-1">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">{{ p.brand_name }}</p>
                      <p class="font-semibold text-sm leading-snug line-clamp-2">{{ p.name }}</p>
                      <div class="flex items-baseline gap-2 mt-0.5">
                        <span class="text-lg font-bold text-emerald-600">\${{ money(p.base_price) }}</span>
                        @if (isPromo(p)) {
                          <span class="text-xs text-slate-400 line-through">\${{ money(p.compare_at_price) }}</span>
                        }
                      </div>
                      @if (p.sizes?.length) {
                        <p class="text-[11px] text-slate-500 mt-1"><span class="font-semibold text-slate-600">Tallas:</span> {{ p.sizes!.join(', ') }}</p>
                      }
                      @if (p.colors?.length) {
                        <p class="text-[11px] text-slate-500"><span class="font-semibold text-slate-600">Colores:</span> {{ p.colors!.join(', ') }}</p>
                      }
                      <p class="text-[11px] mt-auto pt-1.5"
                         [ngClass]="(p.total_stock ?? 0) > 0 ? 'text-emerald-600' : 'text-rose-500'">
                        {{ (p.total_stock ?? 0) > 0 ? (p.total_stock + ' disponibles') : 'Sin stock' }}
                      </p>
                    </div>
                  </article>
                }
              </div>
            </section>
          }

          <footer class="text-center text-xs text-slate-400 py-10 border-t border-slate-200">
            Catálogo generado por {{ branding.siteName() }}
          </footer>
        }
      </main>
    </div>
  `,
})
export class CatalogPageComponent implements OnInit {
  protected branding = inject(BrandingService);
  private catalog = inject(PublicCatalogService);

  placeholder = IMG_PLACEHOLDER;
  loading = signal(true);
  all = signal<PublicProduct[]>([]);
  copiedId = signal<number | null>(null);

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

  ngOnInit(): void {
    this.branding.load();
    this.catalog.listProducts({ page_size: 200, sort: 'featured' }).subscribe({
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
    if (typeof window !== 'undefined') parts.push(window.location.origin + '/catalogo');
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
