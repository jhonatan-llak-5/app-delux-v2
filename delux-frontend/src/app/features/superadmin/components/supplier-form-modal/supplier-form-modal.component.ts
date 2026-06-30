import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService, Supplier } from '@features/superadmin/services/inventory.service';
import { parseApiError } from '@shared/utils/api-error.util';

interface SupplierForm {
  name: string; contact_name: string; phone: string;
  email: string; tax_id: string; notes: string; is_active: boolean;
}

@Component({
  selector: 'dlx-supplier-form-modal',
  standalone: true,
  imports: [DlxFieldErrorComponent, DlxModalComponent, CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="540"
               [title]="supplier ? 'Editar proveedor' : 'Nuevo proveedor'"
               (closed)="cancel.emit()">
        <form (ngSubmit)="submit()" class="space-y-4">
          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{{ error() }}</div>
          }
          <div>
            <label class="eg-label">Nombre *</label>
            <input [(ngModel)]="form.name" name="name" maxlength="160" class="eg-input" [class.!border-rose-400]="fe('name')" placeholder="Importadora XYZ" autocomplete="off" />
            <dlx-field-error [error]="fe(\'name\')" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Persona de contacto</label>
              <input [(ngModel)]="form.contact_name" name="contact_name" maxlength="120" class="eg-input" [class.!border-rose-400]="fe('contact_name')" placeholder="Juan Pérez" autocomplete="off" />
              <dlx-field-error [error]="fe(\'contact_name\')" />
            </div>
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="form.phone" name="phone" maxlength="40" class="eg-input" [class.!border-rose-400]="fe('phone')" placeholder="099..." autocomplete="off" />
              <dlx-field-error [error]="fe(\'phone\')" />
            </div>
            <div>
              <label class="eg-label">Email</label>
              <input [(ngModel)]="form.email" name="email" type="email" class="eg-input" [class.!border-rose-400]="fe('email')" placeholder="proveedor@mail.com" autocomplete="off" />
              <dlx-field-error [error]="fe(\'email\')" />
            </div>
            <div>
              <label class="eg-label">RUC / NIF</label>
              <input [(ngModel)]="form.tax_id" name="tax_id" maxlength="40" class="eg-input" [class.!border-rose-400]="fe('tax_id')" placeholder="1790000000001" autocomplete="off" />
              <dlx-field-error [error]="fe(\'tax_id\')" />
            </div>
          </div>
          <div>
            <label class="eg-label">Notas</label>
            <textarea [(ngModel)]="form.notes" name="notes" rows="2" maxlength="400" class="eg-input" placeholder="Datos de contacto, condiciones, etc."></textarea>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" [(ngModel)]="form.is_active" name="is_active" class="w-4 h-4 accent-[#1e40af]" />
            <span class="text-sm">Activo (aparece para seleccionar en recepción)</span>
          </label>
          <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
            <button type="button" class="btn-secondary" (click)="cancel.emit()">Cancelar</button>
            <button type="submit" class="eg-btn-primary" [disabled]="saving()">
              <i class="fa-solid" [class.fa-spinner]="saving()" [class.fa-spin]="saving()" [class.fa-floppy-disk]="!saving()"></i>
              {{ saving() ? 'Guardando...' : (supplier ? 'Actualizar' : 'Crear proveedor') }}
            </button>
          </div>
        </form>
    </dlx-modal>
  `,
})
export class SupplierFormModalComponent implements OnInit {
  @Input() supplier: Supplier | null = null;
  @Input() initialName = '';
  @Output() saved = new EventEmitter<Supplier>();
  @Output() cancel = new EventEmitter<void>();

  private inv = inject(InventoryService);
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  form: SupplierForm = { name: '', contact_name: '', phone: '', email: '', tax_id: '', notes: '', is_active: true };

  ngOnInit(): void {
    if (this.supplier) {
      const s = this.supplier;
      this.form = {
        name: s.name, contact_name: s.contact_name, phone: s.phone,
        email: s.email, tax_id: s.tax_id, notes: s.notes, is_active: s.is_active,
      };
    } else if (this.initialName) {
      this.form.name = this.initialName;
    }
  }

  submit(): void {
    this.error.set(null);
    const errs: Record<string, string> = {};
    if (!this.form.name.trim()) errs['name'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    this.saving.set(true);
    const payload = { ...this.form, name: this.form.name.trim() };
    const obs = this.supplier
      ? this.inv.updateSupplier(this.supplier.id, payload)
      : this.inv.createSupplier(payload);
    obs.subscribe({
      next: (s) => { this.saving.set(false); this.saved.emit(s); },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        this.error.set(Object.keys(p.fieldErrors).length ? null : (p.message || 'No se pudo guardar.'));
      },
    });
  }
}
