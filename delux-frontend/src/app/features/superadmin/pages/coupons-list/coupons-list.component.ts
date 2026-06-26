import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Coupon, CouponService } from '@features/superadmin/services/coupon.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { CouponFormModalComponent } from '@features/superadmin/components/coupon-form-modal/coupon-form-modal.component';

@Component({
  selector: 'dlx-coupons-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CouponFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-ticket"></i>
          <span class="uppercase tracking-widest font-semibold">Marketing</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Cupones</h1>
        <p class="text-slate-500 text-sm mt-1">Descuentos por código para canalizar campañas.</p>
      </div>
      <button (click)="openCreate()"
              class="px-4 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900 flex items-center gap-2">
        <i class="fa-solid fa-plus"></i> Nuevo cupón
      </button>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total</p>
        <p class="text-2xl font-bold mt-1">{{ coupons().length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">Activos</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ activeCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-violet-600 font-semibold">Vigentes</p>
        <p class="text-2xl font-bold text-violet-600 mt-1">{{ validCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total usos</p>
        <p class="text-2xl font-bold mt-1">{{ totalUses() }}</p>
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar por código..." [(ngModel)]="search" (ngModelChange)="reload()"
               class="eg-input has-icon-left pr-3 border-transparent" />
      </div>
      <select [(ngModel)]="typeFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent text-sm">
        <option value="">Todos los tipos</option>
        <option value="PERCENT">Porcentaje</option>
        <option value="FIXED">Monto fijo</option>
      </select>
    </div>

    @if (loading()) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    } @else if (coupons().length === 0) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-ticket text-3xl mb-3"></i>
        <p>Aún no hay cupones creados.</p>
      </div>
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (c of coupons(); track c.id) {
          <div class="card overflow-hidden relative">
            <!-- Cinta superior según tipo -->
            <div class="h-2"
                 [class.bg-violet-500]="c.type === 'PERCENT'"
                 [class.bg-emerald-500]="c.type === 'FIXED'"></div>
            <div class="p-5">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{{ c.type_label }}</p>
                  <h3 class="font-mono text-lg font-bold mt-0.5 tracking-tight">{{ c.code }}</h3>
                </div>
                <div class="text-right">
                  <p class="font-display text-3xl font-bold leading-none"
                     [class.text-violet-600]="c.type === 'PERCENT'"
                     [class.text-emerald-600]="c.type === 'FIXED'">
                    @if (c.type === 'PERCENT') { {{ c.value }}% } @else { \${{ c.value }} }
                  </p>
                </div>
              </div>

              <ul class="text-xs text-slate-500 space-y-1 mt-3">
                @if (+c.min_purchase > 0) {
                  <li><i class="fa-solid fa-cart-shopping w-4"></i> Compra mínima \${{ c.min_purchase }}</li>
                }
                @if (c.usage_limit) {
                  <li>
                    <i class="fa-solid fa-hashtag w-4"></i>
                    Usos: <span class="font-bold">{{ c.times_used }}/{{ c.usage_limit }}</span>
                  </li>
                } @else {
                  <li><i class="fa-solid fa-infinity w-4"></i> Usos: {{ c.times_used }} (sin límite)</li>
                }
                @if (c.ends_at) {
                  <li>
                    <i class="fa-solid fa-calendar-xmark w-4"></i>
                    Vence {{ c.ends_at | date:'mediumDate' }}
                  </li>
                }
              </ul>

              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                @if (c.is_valid) {
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Vigente
                  </span>
                } @else if (c.is_active) {
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Expirado
                  </span>
                } @else {
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    Inactivo
                  </span>
                }
                <div class="flex gap-1">
                  <button (click)="copyCode(c)" title="Copiar código"
                          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500">
                    <i class="fa-solid fa-copy text-xs"></i>
                  </button>
                  <button (click)="openEdit(c)" title="Editar"
                          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-sky-100 hover:text-sky-700 text-slate-500">
                    <i class="fa-solid fa-pen text-xs"></i>
                  </button>
                  <button (click)="toggle(c)" [title]="c.is_active ? 'Desactivar' : 'Activar'"
                          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-100 hover:text-amber-700 text-slate-500">
                    <i class="fa-solid" [class.fa-eye]="c.is_active" [class.fa-eye-slash]="!c.is_active"></i>
                  </button>
                  <button (click)="remove(c)" title="Eliminar"
                          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose-100 hover:text-rose-700 text-slate-500">
                    <i class="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }

    @if (showModal()) {
      <dlx-coupon-form-modal [coupon]="editing()" (close)="closeModal()" (saved)="onSaved()" />
    }
  `,
})
export class CouponsListComponent implements OnInit {
  private svc = inject(CouponService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);

  coupons = signal<Coupon[]>([]);
  loading = signal(true);
  search = '';
  typeFilter = '';
  showModal = signal(false);
  editing = signal<Coupon | null>(null);

  ngOnInit() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.svc.list({
      search: this.search || undefined,
      type: this.typeFilter || undefined,
    }).subscribe({
      next: r => { this.coupons.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  activeCount() { return this.coupons().filter(c => c.is_active).length; }
  validCount() { return this.coupons().filter(c => c.is_valid).length; }
  totalUses() { return this.coupons().reduce((s, c) => s + c.times_used, 0); }

  openCreate() { this.editing.set(null); this.showModal.set(true); }
  openEdit(c: Coupon) { this.editing.set(c); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editing.set(null); }
  onSaved() { this.closeModal(); this.notify.success('Cupón guardado'); this.reload(); }

  copyCode(c: Coupon) { navigator.clipboard?.writeText(c.code); }
  toggle(c: Coupon) {
    this.svc.toggleActive(c.id).subscribe({
      next: () => { this.notify.success('Cupón actualizado'); this.reload(); },
      error: e => this.notify.fromServerError(e),
    });
  }
  async remove(c: Coupon) {
    const ok = await this.confirm.ask({
      title: 'Eliminar cupón',
      message: `¿Eliminar el cupón ${c.code}? Esta acción no se puede deshacer.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.svc.delete(c.id).subscribe({
      next: () => { this.notify.success('Cupón eliminado'); this.reload(); },
      error: e => this.notify.fromServerError(e, 'No se pudo eliminar el cupón.'),
    });
  }
}
