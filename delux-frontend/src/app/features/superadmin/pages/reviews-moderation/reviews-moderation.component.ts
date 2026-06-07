import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewsService, Review } from '@shared/services/reviews.service';
import { StarRatingComponent } from '@shared/components/star-rating/star-rating.component';

@Component({
  selector: 'dlx-reviews-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-comment-dots"></i>
          <span class="uppercase tracking-widest font-semibold">Moderación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Reseñas</h1>
        <p class="text-slate-500 text-sm mt-1">Aprueba o rechaza reseñas para publicarlas en el catálogo.</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-amber-600 font-semibold">Pendientes</p>
        <p class="text-2xl font-bold text-amber-600 mt-1">{{ countBy('PENDING') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">Aprobadas</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ countBy('APPROVED') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-rose-600 font-semibold">Rechazadas</p>
        <p class="text-2xl font-bold text-rose-600 mt-1">{{ countBy('REJECTED') }}</p>
      </div>
    </div>

    <div class="card p-4 mb-4 flex gap-2 items-center flex-wrap">
      <select [(ngModel)]="statusFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent text-sm">
        <option value="">Todos los estados</option>
        <option value="PENDING">Pendientes</option>
        <option value="APPROVED">Aprobadas</option>
        <option value="REJECTED">Rechazadas</option>
      </select>
      <select [(ngModel)]="ratingFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent text-sm">
        <option [ngValue]="undefined">Todas las estrellas</option>
        @for (n of [5,4,3,2,1]; track n) { <option [ngValue]="n">{{ n }} estrellas</option> }
      </select>
    </div>

    <div class="space-y-3">
      @for (r of items(); track r.id) {
        <div class="card p-5">
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <dlx-star-rating [value]="r.rating" size="sm" />
                @if (r.verified_purchase) {
                  <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <i class="fa-solid fa-circle-check"></i> Compra verificada
                  </span>
                }
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                      [ngClass]="statusBadge(r.status)">
                  {{ statusLabel(r.status) }}
                </span>
              </div>
              <p class="text-xs text-slate-500">{{ r.created_at | date:'medium' }}</p>
              @if (r.title) { <h3 class="font-bold mt-2">{{ r.title }}</h3> }
              <p class="text-sm text-slate-600 mt-1">{{ r.comment }}</p>
              <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <i class="fa-solid fa-user"></i> {{ r.customer_name }} · <i class="fa-solid fa-box ml-1"></i> {{ r.product_name }}
              </div>
            </div>
            <div class="flex flex-col gap-1">
              @if (r.status !== 'APPROVED') {
                <button (click)="approve(r)" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold">
                  <i class="fa-solid fa-check"></i> Aprobar
                </button>
              }
              @if (r.status !== 'REJECTED') {
                <button (click)="reject(r)" class="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold">
                  <i class="fa-solid fa-xmark"></i> Rechazar
                </button>
              }
              <button (click)="remove(r)" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      }
      @if (items().length === 0) {
        <div class="card p-12 text-center text-slate-400">
          <i class="fa-regular fa-comment-dots text-3xl mb-3"></i>
          <p>No hay reseñas con esos filtros.</p>
        </div>
      }
    </div>
  `,
})
export class ReviewsModerationComponent implements OnInit {
  private svc = inject(ReviewsService);
  items = signal<Review[]>([]);
  statusFilter = '';
  ratingFilter?: number;

  ngOnInit() { this.reload(); }

  reload() {
    this.svc.list({ status: this.statusFilter, rating: this.ratingFilter }).subscribe(r => this.items.set(r.results));
  }

  countBy(s: string) { return this.items().filter(r => r.status === s).length; }
  statusLabel(s: string) { return ({ PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' } as any)[s]; }
  statusBadge(s: string) {
    return ({
      PENDING: 'bg-amber-100 text-amber-700',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
    } as any)[s];
  }
  approve(r: Review) { this.svc.approve(r.id).subscribe(() => this.reload()); }
  reject(r: Review) { this.svc.reject(r.id).subscribe(() => this.reload()); }
  remove(r: Review) {
    if (!confirm('¿Eliminar reseña?')) return;
    this.svc.delete(r.id).subscribe(() => this.reload());
  }
}
