import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { Customer, CustomerPayload, CustomerService } from '@features/superadmin/services/customer.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-customer-form-modal',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="480"
               [title]="customer ? 'Editar cliente' : 'Nuevo cliente'"
               (closed)="close.emit()">
      <form (ngSubmit)="save()" #f="ngForm" class="space-y-4">
          <div>
            <label class="eg-label">Nombre completo *</label>
            <input [(ngModel)]="payload.full_name" name="full_name" required maxlength="160"
                   class="eg-input" [class.!border-rose-400]="fe('full_name')" />
            <dlx-field-error [error]="fe(\'full_name\')" />
          </div>
          <div>
            <label class="eg-label">Email *</label>
            <input [(ngModel)]="payload.email" name="email" type="email" required
                   class="eg-input" [class.!border-rose-400]="fe('email')" />
            <dlx-field-error [error]="fe(\'email\')" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="payload.phone" name="phone" maxlength="30"
                     class="eg-input" [class.!border-rose-400]="fe('phone')" />
              <dlx-field-error [error]="fe(\'phone\')" />
            </div>
            <div>
              <label class="eg-label">Cédula</label>
              <input [(ngModel)]="payload.document_id" name="document_id" maxlength="30"
                     class="eg-input font-mono" [class.!border-rose-400]="fe('document_id')" />
              <dlx-field-error [error]="fe(\'document_id\')" />
            </div>
          </div>
          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
            <input type="checkbox" [(ngModel)]="payload.accepts_marketing" name="accepts_marketing" class="w-4 h-4 accent-emerald-500" />
            <div>
              <p class="text-sm font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-envelope text-emerald-500 text-xs"></i> Acepta marketing
              </p>
              <p class="text-xs text-slate-500">Recibirá emails de drops y promociones</p>
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
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { {{ customer ? 'Guardar' : 'Crear' }} }
            </button>
          </div>
        </form>
    </dlx-modal>
  `,
})
export class CustomerFormModalComponent implements OnInit {
  private svc = inject(CustomerService);

  @Input() customer: Customer | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Customer>();

  payload: CustomerPayload = {
    full_name: '', email: '', phone: '', document_id: '',
    accepts_marketing: false, tags: [],
  };
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  ngOnInit() {
    if (this.customer) {
      this.payload = {
        full_name: this.customer.full_name,
        email: this.customer.email,
        phone: this.customer.phone,
        document_id: this.customer.document_id,
        accepts_marketing: this.customer.accepts_marketing,
        tags: this.customer.tags || [],
      };
    }
  }

  save() {
    this.fieldErrors.set({});
    this.saving.set(true);
    this.error.set(null);
    const obs = this.customer
      ? this.svc.update(this.customer.id, this.payload)
      : this.svc.create(this.payload);
    obs.subscribe({
      next: c => { this.saving.set(false); this.saved.emit(c); },
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
