import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { AdminBranch } from '@features/superadmin/services/admin.service';

export interface BranchPayload {
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: string;
  allows_pickup: boolean;
  is_active: boolean;
}

@Component({
  selector: 'dlx-branch-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="680"
               [title]="branch ? 'Editar sucursal' : 'Nueva sucursal'"
               (closed)="cancel.emit()">
      <form (ngSubmit)="submit()" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="eg-label">Código *</label>
              <input [(ngModel)]="form.code" name="code" required maxlength="20"
                     class="eg-input font-mono" placeholder="CENTRO" />
            </div>
            <div class="md:col-span-2">
              <label class="eg-label">Nombre *</label>
              <input [(ngModel)]="form.name" name="name" required maxlength="120"
                     class="eg-input" placeholder="Delux Centro" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Ciudad *</label>
              <input [(ngModel)]="form.city" name="city" required maxlength="80"
                     class="eg-input" placeholder="Quito" />
            </div>
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="form.phone" name="phone" maxlength="30"
                     class="eg-input" placeholder="+593 ..." />
            </div>
          </div>

          <div>
            <label class="eg-label">Dirección *</label>
            <input [(ngModel)]="form.address" name="address" required maxlength="200"
                   class="eg-input" placeholder="Av. Amazonas y Colón" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Email</label>
              <input [(ngModel)]="form.email" name="email" type="email"
                     class="eg-input" placeholder="sucursal@delux.com" />
            </div>
            <div>
              <label class="eg-label">Horario</label>
              <input [(ngModel)]="form.opening_hours" name="opening_hours" maxlength="120"
                     class="eg-input" placeholder="Lun-Sáb 10:00-20:00" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Latitud</label>
              <input [(ngModel)]="form.latitude" name="lat" type="number" step="any"
                     class="eg-input font-mono" placeholder="-0.1807" />
            </div>
            <div>
              <label class="eg-label">Longitud</label>
              <input [(ngModel)]="form.longitude" name="lng" type="number" step="any"
                     class="eg-input font-mono" placeholder="-78.4678" />
            </div>
          </div>
          <p class="text-[11px] text-slate-400">Las coordenadas se usan para el mapa de seguimiento de envíos.</p>

          <div class="flex flex-wrap gap-6 pt-2">
            <label class="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-white/80">
              <input type="checkbox" [(ngModel)]="form.allows_pickup" name="pickup" class="w-4 h-4 accent-blue-600" />
              Permite retiro en tienda
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-white/80">
              <input type="checkbox" [(ngModel)]="form.is_active" name="active" class="w-4 h-4 accent-emerald-500" />
              Sucursal activa
            </label>
          </div>

          @if (error()) {
            <p class="text-sm text-rose-600"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
          }

          <div class="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
            <button type="button" (click)="cancel.emit()" class="eg-btn-secondary">Cancelar</button>
            <button type="submit" [disabled]="saving()" class="eg-btn-primary">
              <i class="fa-solid" [class.fa-spinner]="saving()" [class.fa-spin]="saving()" [class.fa-floppy-disk]="!saving()"></i>
              {{ saving() ? 'Guardando...' : (branch ? 'Actualizar' : 'Crear sucursal') }}
            </button>
          </div>
        </form>
    </dlx-modal>
  `,
})
export class BranchFormModalComponent {
  @Input() branch: AdminBranch | null = null;
  @Output() save = new EventEmitter<BranchPayload>();
  @Output() cancel = new EventEmitter<void>();

  saving = signal(false);
  error = signal<string | null>(null);

  form: BranchPayload = {
    code: '', name: '', city: '', address: '', phone: '', email: '',
    latitude: null, longitude: null, opening_hours: '',
    allows_pickup: true, is_active: true,
  };

  ngOnInit() {
    if (this.branch) {
      const b = this.branch as any;
      this.form = {
        code: b.code, name: b.name, city: b.city, address: b.address,
        phone: b.phone || '', email: b.email || '',
        latitude: b.latitude ?? null, longitude: b.longitude ?? null,
        opening_hours: b.opening_hours || '',
        allows_pickup: b.allows_pickup ?? true,
        is_active: b.is_active ?? true,
      };
    }
  }

  submit() {
    if (!this.form.code || !this.form.name || !this.form.city || !this.form.address) {
      this.error.set('Código, nombre, ciudad y dirección son obligatorios.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    this.save.emit({ ...this.form });
  }

  setSaving(v: boolean) { this.saving.set(v); }
  setError(msg: string) { this.error.set(msg); this.saving.set(false); }
}
