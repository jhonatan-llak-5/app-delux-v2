import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  title: string;
  text: string;
  verified: boolean;
  helpful: number;
}

@Component({
  selector: 'dlx-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-8">
      <!-- Resumen -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b" style="border-color: rgba(var(--text), 0.08);">
        <div>
          <p class="font-display text-6xl font-bold leading-none">{{ avg().toFixed(1) }}</p>
          <div class="flex gap-0.5 text-accent-400 mt-3">
            @for (s of [1,2,3,4,5]; track s) {
              <i class="fa-solid fa-star text-sm" [class.opacity-30]="s > Math.round(avg())"></i>
            }
          </div>
          <p class="text-sm text-ink-700 dark:text-white/70 mt-2">{{ reviews().length }} reseñas verificadas</p>
        </div>

        <!-- Bars -->
        <div class="md:col-span-2 space-y-2">
          @for (r of [5,4,3,2,1]; track r) {
            <div class="flex items-center gap-3 text-sm">
              <span class="w-3 text-ink-700 dark:text-white/70">{{ r }}</span>
              <i class="fa-solid fa-star text-accent-400 text-xs"></i>
              <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: rgba(var(--text), 0.08);">
                <div class="h-full bg-accent-400 transition-all" [style.width.%]="ratingPercent(r)"></div>
              </div>
              <span class="text-xs text-ink-500 dark:text-white/50 w-8 text-right">{{ ratingCount(r) }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Toolbar + escribir reseña -->
      <div class="flex items-center justify-between">
        <h3 class="font-display font-bold text-2xl">Reseñas ({{ reviews().length }})</h3>
        <button (click)="showForm.set(!showForm())" class="btn-outline text-xs">
          <i class="fa-solid fa-pen"></i> Escribir reseña
        </button>
      </div>

      <!-- Form -->
      @if (showForm()) {
        <form (ngSubmit)="submit()" class="editorial-card p-6 space-y-4 animate-slide-down">
          <div class="flex items-center gap-2">
            <span class="text-xs text-ink-700 dark:text-white/70 mr-2">Tu calificación:</span>
            @for (s of [1,2,3,4,5]; track s) {
              <button type="button" (click)="newRating.set(s)" class="text-2xl"
                      [class.text-accent-400]="s <= newRating()"
                      [class.text-ink-500 dark:text-white/50]="s > newRating()">
                <i class="fa-solid fa-star"></i>
              </button>
            }
          </div>
          <input [(ngModel)]="newTitle" name="title" placeholder="Título de tu reseña *"
                 class="w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm"
                 style="border-color: rgba(var(--text), 0.1);" />
          <textarea [(ngModel)]="newText" name="text" rows="4" placeholder="Comparte tu experiencia... *"
                    class="w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm"
                    style="border-color: rgba(var(--text), 0.1);"></textarea>
          <div class="flex gap-3 justify-end">
            <button type="button" (click)="showForm.set(false)" class="btn-outline text-xs">Cancelar</button>
            <button type="submit" class="btn-accent text-xs">Publicar reseña</button>
          </div>
        </form>
      }

      <!-- Lista -->
      <div class="space-y-6">
        @for (r of reviews(); track r.id) {
          <article class="pb-6 border-b" style="border-color: rgba(var(--text), 0.08);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-violet to-accent-400
                            grid place-items-center text-white font-bold text-sm">
                  {{ initials(r.name) }}
                </div>
                <div>
                  <p class="font-semibold text-sm">{{ r.name }}
                    @if (r.verified) {
                      <span class="text-[10px] text-emerald-400 ml-1">
                        <i class="fa-solid fa-check-circle"></i> verificado
                      </span>
                    }
                  </p>
                  <p class="text-xs text-ink-500 dark:text-white/50">{{ r.date }}</p>
                </div>
              </div>
              <div class="flex gap-0.5 text-accent-400">
                @for (s of [1,2,3,4,5]; track s) {
                  <i class="fa-solid fa-star text-xs" [class.opacity-30]="s > r.rating"></i>
                }
              </div>
            </div>
            <h4 class="font-semibold mt-2">{{ r.title }}</h4>
            <p class="text-sm text-ink-700 dark:text-white/70 mt-2 leading-relaxed">{{ r.text }}</p>
            <button class="text-xs text-ink-500 dark:text-white/50 hover:text-base mt-3">
              <i class="fa-regular fa-thumbs-up"></i> Útil ({{ r.helpful }})
            </button>
          </article>
        }
      </div>
    </section>
  `,
})
export class ReviewsComponent {
  @Input() productId?: string;
  Math = Math;

  showForm = signal(false);
  newRating = signal(5);
  newTitle = signal('');
  newText = signal('');

  reviews = signal<Review[]>([
    { id: '1', name: 'María Solís', rating: 5, date: 'Hace 2 días',
      title: '¡Excelente calidad!', verified: true, helpful: 12,
      text: 'Pedí mi par un viernes y lo tenía el sábado. Calidad impecable, talla justa y el unboxing fue una experiencia premium. Definitivamente regresaré.' },
    { id: '2', name: 'Andrés Vera', rating: 4, date: 'Hace 1 semana',
      title: 'Muy cómodas', verified: true, helpful: 8,
      text: 'El producto es excelente, justo lo que esperaba. Solo un detalle menor con el color que se ve ligeramente diferente a las fotos, pero nada que afecte la experiencia.' },
    { id: '3', name: 'Lucía Pérez', rating: 5, date: 'Hace 2 semanas',
      title: 'Recomendado al 100%', verified: true, helpful: 15,
      text: 'La atención al cliente fue increíble. Tuve una consulta sobre tallas y me respondieron en menos de 30 minutos. El producto llegó en perfectas condiciones.' },
    { id: '4', name: 'Carlos Mendez', rating: 5, date: 'Hace 3 semanas',
      title: 'Worth every penny', verified: true, helpful: 6,
      text: 'Materiales de primera, terminados impecables. Se nota que es producto auténtico. Ya pedí otro par para regalo.' },
  ]);

  avg = computed(() => {
    const rs = this.reviews();
    if (!rs.length) return 0;
    return rs.reduce((s, r) => s + r.rating, 0) / rs.length;
  });

  ratingCount(r: number) { return this.reviews().filter(x => x.rating === r).length; }
  ratingPercent(r: number) {
    const total = this.reviews().length;
    return total ? (this.ratingCount(r) / total) * 100 : 0;
  }

  initials(name: string) {
    return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  }

  submit() {
    if (!this.newTitle() || !this.newText()) return;
    this.reviews.update(list => [{
      id: String(Date.now()),
      name: 'Tú',
      rating: this.newRating(),
      date: 'Ahora',
      title: this.newTitle(),
      text: this.newText(),
      verified: false,
      helpful: 0,
    }, ...list]);
    this.newTitle.set(''); this.newText.set(''); this.newRating.set(5);
    this.showForm.set(false);
  }
}
