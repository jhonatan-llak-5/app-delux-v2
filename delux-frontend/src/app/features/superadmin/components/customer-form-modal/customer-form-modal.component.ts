import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer, CustomerPayload, CustomerService } from '@features/superadmin/services/customer.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-customer-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="onBackdrop($event)">
      <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-bold tracking-tight">
            {{ customer ? 'Editar cliente' : 'Nuevo cliente' }}
          </h2>
          <button (click)="close.emit()" class="w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form (ngSubmit)="save()" #f="ngForm" class="px-6 py-5 space-y-4">
          <div>
            <label class="eg-label">Nombre completo *</label>
            <input [(ngModel)]="payload.full_name" name="full_name" required maxlength="160"
                   class="eg-input" />
          </div>
          <div>
            <label class="eg-label">Email *</label>
            <input [(ngModel)]="payload.email" name="email" type="email" required
                   class="eg-input" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="payload.phone" name="phone" maxlength="30"
                     class="eg-input" />
            </div>
            <div>
              <label class="eg-label">Cédula</label>
              <input [(ngModel)]="payload.document_id" name="document_id" maxlength="30"
                     class="eg-input font-mono" />
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
      </div>
    </div>
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
    this.saving.set(true);
    this.error.set(null);
    const obs = this.customer
      ? this.svc.update(this.customer.id, this.payload)
      : this.svc.create(this.payload);
    obs.subscribe({
      next: c => { this.saving.set(false); this.saved.emit(c); },
      error: e => { this.saving.set(false); this.error.set(parseApiError(e).message || 'Error al guardar'); },
    });
  }

  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.close.emit(); }
}
