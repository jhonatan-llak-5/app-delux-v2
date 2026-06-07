import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewsService, ProductReviewsResp } from '@shared/services/reviews.service';
import { StarRatingComponent } from '@shared/components/star-rating/star-rating.component';

@Component({
  selector: 'dlx-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as d) {
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Resumen -->
        <div class="lg:col-span-1">
          <div class="editorial-card p-6 text-center">
            <p class="display-xl text-6xl text-ink-950 dark:text-white">{{ d.average | number:'1.1-1' }}</p>
            <dlx-star-rating [value]="Math.round(d.average)" size="lg" />
            <p class="text-sm text-ink-700 dark:text-white/60 mt-2">{{ d.total }} reseña(s)</p>

            <div class="mt-6 space-y-1.5">
              @for (n of [5,4,3,2,1]; track n) {
                <div class="flex items-center gap-2 text-xs">
                  <span class="w-3 text-ink-700 dark:text-white/60">{{ n }}</span>
                  <i class="fa-solid fa-star text-amber-400 text-[10px]"></i>
                  <div class="flex-1 h-2 bg-ink-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-amber-400 rounded-full"
                         [style.width.%]="d.total ? (d.distribution[n] / d.total * 100) : 0"></div>
                  </div>
                  <span class="w-8 text-right text-ink-500 dark:text-white/40">{{ d.distribution[n] || 0 }}</span>
                </div>
              }
            </div>

            <button (click)="showForm.set(!showForm())"
                    class="btn-accent text-xs uppercase tracking-widest px-6 py-3 mt-6 w-full">
              <i class="fa-solid fa-pen"></i> {{ showForm() ? 'Cancelar' : 'Escribir reseña' }}
            </button>
          </div>

          @if (showForm()) {
            <div class="editorial-card p-6 mt-3">
              <h3 class="font-bold text-ink-950 dark:text-white mb-3">Tu reseña</h3>
              <div class="mb-3">
                <p class="eyebrow mb-1.5">Tu calificación</p>
                <dlx-star-rating [value]="myRating" [interactive]="true" size="lg" (rated)="myRating = $event" />
              </div>
              <input [(ngModel)]="myTitle" placeholder="Título (opcional)" maxlength="120"
                     class="w-full px-3 py-2.5 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm mb-2 focus:outline-none" />
              <textarea [(ngModel)]="myComment" placeholder="Cuéntanos qué tal te pareció" rows="4"
                        class="w-full px-3 py-2.5 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none"></textarea>
              @if (error()) {
                <p class="text-rose-600 text-xs mt-2"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
              }
              @if (submitted()) {
                <p class="text-emerald-600 text-xs mt-2"><i class="fa-solid fa-circle-check"></i> Reseña enviada, en revisión.</p>
              }
              <button (click)="submit()" [disabled]="myRating < 1 || saving()"
                      class="btn-outline text-xs uppercase tracking-widest px-5 py-3 mt-3 w-full">
                @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { Enviar }
              </button>
            </div>
          }
        </div>

        <!-- Lista -->
        <div class="lg:col-span-2 space-y-4">
          @if (d.results.length === 0) {
            <div class="editorial-card p-10 text-center text-ink-500 dark:text-white/50">
              <i class="fa-regular fa-comment-dots text-3xl mb-3"></i>
              <p>Aún no hay reseñas. ¡Sé el primero!</p>
            </div>
          } @else {
            @for (r of d.results; track r.id) {
              <article class="editorial-card p-6">
                <div class="flex items-start gap-3 mb-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-brand-violet grid place-items-center text-white font-bold text-sm">
                    {{ r.customer_initials }}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-semibold text-ink-950 dark:text-white">{{ r.customer_name }}</p>
                      @if (r.verified_purchase) {
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          <i class="fa-solid fa-circle-check"></i> Compra verificada
                        </span>
                      }
                    </div>
                    <dlx-star-rating [value]="r.rating" size="sm" />
                  </div>
                  <p class="text-xs text-ink-500 dark:text-white/50">{{ r.created_at | date:'mediumDate' }}</p>
                </div>
                @if (r.title) {
                  <h4 class="font-bold text-ink-950 dark:text-white mb-1">{{ r.title }}</h4>
                }
                <p class="text-sm text-ink-700 dark:text-white/70 leading-relaxed">{{ r.comment }}</p>
              </article>
            }
          }
        </div>
      </div>
    }
  `,
})
export class ProductReviewsComponent implements OnChanges {
  private svc = inject(ReviewsService);
  Math = Math;

  @Input({ required: true }) productId!: number;
  data = signal<ProductReviewsResp | null>(null);

  showForm = signal(false);
  myRating = 0;
  myTitle = '';
  myComment = '';
  saving = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges) {
    if (this.productId) this.load();
  }

  load() {
    this.svc.forProduct(this.productId).subscribe(d => this.data.set(d));
  }

  submit() {
    this.saving.set(true);
    this.error.set(null);
    this.svc.postReview(this.productId, this.myRating, this.myTitle, this.myComment).subscribe({
      next: () => {
        this.saving.set(false);
        this.submitted.set(true);
        this.myRating = 0; this.myTitle = ''; this.myComment = '';
        setTimeout(() => { this.submitted.set(false); this.showForm.set(false); }, 2500);
        this.load();
      },
      error: e => {
        this.saving.set(false);
        this.error.set(e?.error?.detail || 'Debes iniciar sesión para reseñar.');
      },
    });
  }
}
