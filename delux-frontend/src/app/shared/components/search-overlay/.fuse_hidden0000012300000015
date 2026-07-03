import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { CatalogService, AutocompleteResp } from '@shared/services/catalog.service';

@Component({
  selector: 'dlx-search-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[60] bg-white/95 dark:bg-ink-950/95 backdrop-blur-xl animate-fade-in"
         (click)="onBackdrop($event)">
      <div class="max-w-4xl mx-auto pt-24 px-6">
        <div class="flex items-center gap-3 mb-8">
          <i class="fa-solid fa-magnifying-glass text-2xl text-ink-500 dark:text-white/50"></i>
          <input #input [(ngModel)]="query" (ngModelChange)="onTyping($event)"
                 (keydown.enter)="submit()"
                 placeholder="Buscar productos, marcas, categorías..."
                 class="flex-1 bg-transparent text-2xl md:text-3xl font-display tracking-tight
                        text-ink-950 dark:text-white placeholder:text-ink-400 dark:placeholder:text-white/40
                        outline-none border-0 py-2"
                 autofocus />
          <button (click)="close.emit()" aria-label="Cerrar"
                  class="w-10 h-10 rounded-full grid place-items-center text-ink-700 dark:text-white/70 hover:bg-ink-100 dark:hover:bg-white/10">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <div class="reveal-line mb-8"></div>

        @if (loading()) {
          <p class="text-ink-500 dark:text-white/50 text-sm"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</p>
        } @else if (results(); as r) {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Productos -->
            <div class="md:col-span-2">
              <p class="eyebrow mb-3">Productos</p>
              @if (r.products.length === 0) {
                <p class="text-ink-500 dark:text-white/40 text-sm">Sin resultados.</p>
              } @else {
                <ul class="space-y-2">
                  @for (p of r.products; track p.id) {
                    <li>
                      <a [routerLink]="['/product', p.id]" (click)="close.emit()"
                         class="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-white/5 transition">
                        <img [src]="p.main_image_url" [alt]="p.name"
                             class="w-14 h-14 rounded-lg object-cover bg-ink-100 dark:bg-white/5"
                             crossorigin="anonymous" (error)="onImgErr($event)" />
                        <div class="flex-1 min-w-0">
                          <p class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/40 truncate">{{ p.brand_name }}</p>
                          <p class="font-semibold text-ink-950 dark:text-white truncate">{{ p.name }}</p>
                        </div>
                        <span class="font-display font-bold text-ink-950 dark:text-white">\${{ p.base_price }}</span>
                      </a>
                    </li>
                  }
                </ul>
              }
            </div>

            <div class="space-y-6">
              <div>
                <p class="eyebrow mb-3">Marcas</p>
                <ul class="space-y-1">
                  @for (b of r.brands; track b.id) {
                    <li>
                      <a [routerLink]="['/shop']" [queryParams]="{ brand: b.id }" (click)="close.emit()"
                         class="block px-2 py-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-white/5 text-sm text-ink-700 dark:text-white/70 hover:text-ink-950 dark:hover:text-white">
                        <i class="fa-solid fa-tag text-xs mr-1.5"></i> {{ b.name }}
                      </a>
                    </li>
                  }
                  @if (r.brands.length === 0) { <p class="text-ink-400 text-xs">—</p> }
                </ul>
              </div>
              <div>
                <p class="eyebrow mb-3">Categorías</p>
                <ul class="space-y-1">
                  @for (c of r.categories; track c.id) {
                    <li>
                      <a [routerLink]="['/shop']" [queryParams]="{ category: c.slug }" (click)="close.emit()"
                         class="block px-2 py-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-white/5 text-sm text-ink-700 dark:text-white/70 hover:text-ink-950 dark:hover:text-white">
                        <i class="fa-solid {{ c.icon || 'fa-folder' }} text-xs mr-1.5"></i> {{ c.name }}
                      </a>
                    </li>
                  }
                  @if (r.categories.length === 0) { <p class="text-ink-400 text-xs">—</p> }
                </ul>
              </div>
            </div>
          </div>
        } @else {
          <div class="text-center py-12 text-ink-500 dark:text-white/40">
            <i class="fa-solid fa-magnifying-glass text-3xl mb-3"></i>
            <p>Empieza a escribir para buscar...</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class SearchOverlayComponent {
  private svc = inject(CatalogService);
  private router = inject(Router);

  @Output() close = new EventEmitter<void>();
  query = '';
  loading = signal(false);
  results = signal<AutocompleteResp | null>(null);
  private q$ = new Subject<string>();

  constructor() {
    this.q$.pipe(
      debounceTime(250),
      switchMap(q => {
        this.loading.set(true);
        return this.svc.autocomplete(q);
      })
    ).subscribe(r => {
      this.results.set(r);
      this.loading.set(false);
    });
  }

  onTyping(v: string) {
    if (v.trim().length < 2) {
      this.results.set(null);
      return;
    }
    this.q$.next(v);
  }

  submit() {
    if (this.query) {
      this.router.navigate(['/shop'], { queryParams: { q: this.query } });
      this.close.emit();
    }
  }

  onBackdrop(ev: MouseEvent) {
    if (ev.target === ev.currentTarget) this.close.emit();
  }
  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
