import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { Coupon, CouponPayload, CouponService } from '@features/superadmin/services/coupon.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-coupon-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="480"
               [title]="coupon ? 'Editar cupón' : 'Nuevo cupón'"
               (closed)="close.emit()">
      <form (ngSubmit)="save()" #f="ngForm" class="space-y-4">
          <div>
            <label class="eg-label">Código *</label>
            <input [(ngModel)]="payload.code" name="code" required maxlength="40"
                   class="eg-input font-mono uppercase" [class.!border-rose-400]="fe('code')"
                   placeholder="VERANO2026" />
            @if (fe('code')) { <p class="text-xs text-rose-600 mt-1">{{ fe('code') }}</p> }
            <p class="text-[10px] text-slate-400 mt-1">Los clientes ingresarán este código al pagar.</p>
          </div>

          <div>
            <label class="eg-label">Tipo de descuento *</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="payload.type = 'PERCENT'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition"
                      [ngClass]="payload.type === 'PERCENT'
                        ? 'bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/40 dark:text-violet-300'
                        : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'">
                <i class="fa-solid fa-percent block mb-1"></i> Porcentaje
              </button>
              <button type="button" (click)="payload.type = 'FIXED'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition"
                      [ngClass]="payload.type === 'FIXED'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'">
                <i class="fa-solid fa-dollar-sign block mb-1"></i> Monto fijo
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eg-label">
                Valor * {{ payload.type === 'PERCENT' ? '(%)' : '($)' }}
              </label>
              <input type="number" [(ngModel)]="payload.value" name="value" required min="0" step="0.01"
                     [max]="payload.type === 'PERCENT' ? 100 : null"
                     class="eg-input" [class.!border-rose-400]="fe('value')" />
              @if (fe('value')) { <p class="text-xs text-rose-600 mt-1">{{ fe('value') }}</p> }
            </div>
            <div>
              <label class="eg-label">Compra mínima ($)</label>
              <input type="number" [(ngModel)]="payload.min_purchase" name="min_purchase" min="0" step="0.01"
                     class="eg-input" />
            </div>
          </div>

          <div>
            <label class="eg-label">Límite de usos</label>
            <input type="number" [(ngModel)]="payload.usage_limit" name="usage_limit" min="1"
                   class="eg-input" [class.!border-rose-400]="fe('usage_limit')"
                   placeholder="Vacío = sin límite" />
            @if (fe('usage_limit')) { <p class="text-xs text-rose-600 mt-1">{{ fe('usage_limit') }}</p> }
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eg-label">Inicio</label>
              <input type="datetime-local" [(ngModel)]="payload.starts_at" name="starts_at"
                     class="eg-input text-xs" />
            </div>
            <div>
              <label class="eg-label">Fin</label>
              <input type="datetime-local" [(ngModel)]="payload.ends_at" name="ends_at"
                     class="eg-input text-xs" />
            </div>
          </div>

          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:border dark:border-emerald-500/25">
            <input type="checkbox" [(ngModel)]="payload.is_active" name="is_active" class="w-4 h-4 accent-emerald-500" />
            <div>
              <p class="text-sm font-semibold">Activo</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Disponible para canjear</p>
            </div>
          </label>

          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
            <button type="button" (click)="close.emit()" class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 text-sm font-semibold">Cancelar</button>
            <button type="submit" [disabled]="!f.valid || saving()"
                    class="px-5 py-2.5 rounded-lg bg-[#1e40af] text-white text-sm font-semibold hover:bg-[#1e3a8a] disabled:opacity-50">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { {{ coupon ? 'Guardar' : 'Crear' }} }
            </button>
          </div>
        </form>
    </dlx-modal>
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
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

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
    this.fieldErrors.set({});
    const obs = this.coupon
      ? this.svc.update(this.coupon.id, this.payload)
      : this.svc.create(this.payload);
    obs.subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        this.error.set(Object.keys(p.fieldErrors).length ? null : (p.message || 'Error al guardar'));
      },
    });
  }

  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.close.emit(); }
}
