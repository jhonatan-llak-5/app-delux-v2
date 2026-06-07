import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MeService, WishlistEntry } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-wishlist-tab',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editorial-card p-6">
      <h2 class="font-display font-bold text-2xl text-ink-950 dark:text-white mb-2">Favoritos</h2>
      <p class="text-sm text-ink-700 dark:text-white/60 mb-6">{{ items().length }} productos guardados.</p>

      @if (loading()) {
        <div class="text-center py-10">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-ink-400 dark:text-white/40"></i>
        </div>
      } @else if (items().length === 0) {
        <div class="text-center py-12">
          <i class="fa-regular fa-heart text-5xl text-ink-300 dark:text-white/30 mb-3"></i>
          <p class="text-ink-700 dark:text-white/70 mb-4">Aún no tienes favoritos.</p>
          <a routerLink="/shop" class="btn-accent text-sm font-semibold px-6 py-3">
            Descubrir productos
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          @for (w of items(); track w.id) {
            <div class="group">
              <a [routerLink]="['/product', w.product_id]" class="block">
                <div class="relative aspect-square rounded-xl overflow-hidden bg-ink-100 dark:bg-white/5">
                  <img [src]="w.main_image_url" [alt]="w.name"
                       class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                       loading="lazy" crossorigin="anonymous" (error)="onImgErr($event)" />
                  <button (click)="remove(w, $event)"
                          class="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 dark:bg-ink-950/90 backdrop-blur grid place-items-center hover:bg-rose-500 hover:text-white transition"
                          aria-label="Quitar de favoritos">
                    <i class="fa-solid fa-heart text-rose-500 group-hover:hidden text-xs"></i>
                    <i class="fa-solid fa-xmark hidden group-hover:block text-xs"></i>
                  </button>
                </div>
                <div class="mt-3">
                  <p class="font-mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/40 truncate">{{ w.brand_name }}</p>
                  <p class="font-semibold text-sm text-ink-950 dark:text-white truncate mt-0.5">{{ w.name }}</p>
                  <div class="flex items-baseline gap-2 mt-1">
                    <span class="font-display font-bold text-ink-950 dark:text-white">\${{ w.base_price }}</span>
                    @if (w.compare_at_price) {
                      <span class="text-xs text-ink-400 dark:text-white/40 line-through">\${{ w.compare_at_price }}</span>
                    }
                  </div>
                </div>
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WishlistTabComponent implements OnInit {
  private me = inject(MeService);
  items = signal<WishlistEntry[]>([]);
  loading = signal(true);

  ngOnInit() { this.reload(); }
  reload() {
    this.me.wishlist().subscribe({
      next: r => { this.items.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  remove(w: WishlistEntry, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    this.me.toggleWishlist(w.product_id).subscribe(() => this.reload());
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
