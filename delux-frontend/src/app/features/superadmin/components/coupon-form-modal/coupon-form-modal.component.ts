import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Coupon, CouponPayload, CouponService } from '@features/superadmin/services/coupon.service';

@Component({
  selector: 'dlx-coupon-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="onBackdrop($event)">
      <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-bold tracking-tight">
            <i class="fa-solid fa-ticket text-violet-500"></i>
            {{ coupon ? 'Editar cupón' : 'Nuevo cupón' }}
          </h2>
          <button (click)="close.emit()" class="w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form (ngSubmit)="save()" #f="ngForm" class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Código *</label>
            <input [(ngModel)]="payload.code" name="code" required maxlength="40"
                   class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-sm font-mono uppercase"
                   placeholder="VERANO2026" />
            <p class="text-[10px] text-slate-400 mt-1">Los clientes ingresarán este código al pagar.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Tipo de descuento *</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="payload.type = 'PERCENT'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition"
                      [class.bg-violet-100]="payload.type === 'PERCENT'"
                      [class.border-violet-400]="payload.type === 'PERCENT'"
                      [class.text-violet-700]="payload.type === 'PERCENT'"
                      [class.border-slate-200]="payload.type !== 'PERCENT'"
                      [class.text-slate-600]="payload.type !== 'PERCENT'">
                <i class="fa-solid fa-percent block mb-1"></i> Porcentaje
              </button>
              <button type="button" (click)="payload.type = 'FIXED'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition"
                      [class.bg-emerald-100]="payload.type === 'FIXED'"
                      [class.border-emerald-400]="payload.type === 'FIXED'"
                      [class.text-emerald-700]="payload.type === 'FIXED'"
                      [class.border-slate-200]="payload.type !== 'FIXED'"
                      [class.text-slate-600]="payload.type !== 'FIXED'">
                <i class="fa-solid fa-dollar-sign block mb-1"></i> Monto fijo
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Valor * {{ payload.type === 'PERCENT' ? '(%)' : '($)' }}
              </label>
              <input type="number" [(ngModel)]="payload.value" name="value" required min="0" step="0.01"
                     [max]="payload.type === 'PERCENT' ? 100 : null"
                     class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Compra mínima ($)</label>
              <input type="number" [(ngModel)]="payload.min_purchase" name="min_purchase" min="0" step="0.01"
                     class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Límite de usos</label>
            <input type="number" [(ngModel)]="payload.usage_limit" name="usage_limit" min="1"
                   class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-sm"
                   placeholder="Vacío = sin límite" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Inicio</label>
              <input type="datetime-local" [(ngModel)]="payload.starts_at" name="starts_at"
                     class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-xs" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Fin</label>
              <input type="datetime-local" [(ngModel)]="payload.ends_at" name="ends_at"
                     class="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-xs" />
            </div>
          </div>

          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100">
            <input type="checkbox" [(ngModel)]="payload.is_active" name="is_active" class="w-4 h-4 accent-emerald-500" />
            <div>
              <p class="text-sm font-semibold">Activo</p>
              <p class="text-xs text-slate-500">Disponible para canjear</p>
            </div>
          </label>

          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" (click)="close.emit()" class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">Cancelar</button>
            <button type="submit" [disabled]="!f.valid || saving()"
                    class="px-5 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900 disabled:opacity-50">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { {{ coupon ? 'Guardar' : 'Crear' }} }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CouponFormModalComponent implements OnInit {
  private svc = inject(CouponService);

  @Input() coupon: Coupon | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  payload: CouponPayload = {
    code: '', type: 'PERCENT', value: 10, min_purchase: 0,
    usage_limit: null, starts_at: null, ends_at: null, is_active: true,
  };
  saving = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    if (this.coupon) {
      this.payload = {
        code: this.coupon.code,
        type: this.coupon.type,
        value: this.coupon.value,
        min_purchase: this.coupon.min_purchase,
        usage_limit: this.coupon.usage_limit,
        starts_at: this.coupon.starts_at ? this.coupon.starts_at.slice(0, 16) : null,
        ends_at: this.coupon.ends_at ? this.coupon.ends_at.slice(0, 16) : null,
        is_active: this.coupon.is_active,
      };
    }
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    const obs = this.coupon
      ? this.svc.update(this.coupon.id, this.payload)
      : this.svc.create(this.payload);
    obs.subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: e => {
        this.saving.set(false);
        this.error.set(e?.error?.detail || JSON.stringify(e?.error || {}) || 'Error al guardar');
      },
    });
  }

  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.close.emit(); }
}
