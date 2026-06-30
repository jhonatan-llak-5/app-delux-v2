import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { AdminBranch } from '@features/superadmin/services/admin.service';
import { ParsedApiError } from '@shared/utils/api-error.util';

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
  kiosk_pin: string;
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
              <input [(ngModel)]="form.code" name="code" required maxlength="10"
                     class="eg-input font-mono" [class.!border-rose-400]="fe('code')" placeholder="CENTRO" />
              @if (fe('code')) { <p class="text-xs text-rose-600 mt-1">{{ fe('code') }}</p> }
            </div>
            <div class="md:col-span-2">
              <label class="eg-label">Nombre *</label>
              <input [(ngModel)]="form.name" name="name" required maxlength="80"
                     class="eg-input" [class.!border-rose-400]="fe('name')" placeholder="Delux Centro" />
              @if (fe('name')) { <p class="text-xs text-rose-600 mt-1">{{ fe('name') }}</p> }
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Ciudad *</label>
              <input [(ngModel)]="form.city" name="city" required maxlength="80"
                     class="eg-input" [class.!border-rose-400]="fe('city')" placeholder="Quito" />
              @if (fe('city')) { <p class="text-xs text-rose-600 mt-1">{{ fe('city') }}</p> }
            </div>
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="form.phone" name="phone" maxlength="30"
                     class="eg-input" [class.!border-rose-400]="fe('phone')" placeholder="+593 ..." />
              @if (fe('phone')) { <p class="text-xs text-rose-600 mt-1">{{ fe('phone') }}</p> }
            </div>
          </div>

          <div>
            <label class="eg-label">Dirección *</label>
            <input [(ngModel)]="form.address" name="address" required maxlength="200"
                   class="eg-input" [class.!border-rose-400]="fe('address')" placeholder="Av. Amazonas y Colón" />
            @if (fe('address')) { <p class="text-xs text-rose-600 mt-1">{{ fe('address') }}</p> }
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Email</label>
              <input [(ngModel)]="form.email" name="email" type="email"
                     class="eg-input" [class.!border-rose-400]="fe('email')" placeholder="sucursal@delux.com" />
              @if (fe('email')) { <p class="text-xs text-rose-600 mt-1">{{ fe('email') }}</p> }
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
              <input [(ngModel)]="form.latitude" name="lat" type="number" step="any" min="-90" max="90"
                     class="eg-input font-mono" [class.!border-rose-400]="fe('latitude')" placeholder="-0.1807" />
              @if (fe('latitude')) { <p class="text-xs text-rose-600 mt-1">{{ fe('latitude') }}</p> }
            </div>
            <div>
              <label class="eg-label">Longitud</label>
              <input [(ngModel)]="form.longitude" name="lng" type="number" step="any" min="-180" max="180"
                     class="eg-input font-mono" [class.!border-rose-400]="fe('longitude')" placeholder="-78.4678" />
              @if (fe('longitude')) { <p class="text-xs text-rose-600 mt-1">{{ fe('longitude') }}</p> }
            </div>
          </div>
          <p class="text-[11px] text-slate-400">Las coordenadas se usan para el mapa de seguimiento de envíos.</p>

          <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-4 space-y-3">
            <p class="text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-qrcode text-[#1e40af]"></i> Kiosko de consulta</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="eg-label">PIN de acceso (opcional)</label>
                <input [(ngModel)]="form.kiosk_pin" name="kiosk_pin" maxlength="8" inputmode="numeric"
                       class="eg-input font-mono" [class.!border-rose-400]="fe('kiosk_pin')" placeholder="Ej. 1234 (vacío = sin PIN)" />
                @if (fe('kiosk_pin')) { <p class="text-xs text-rose-600 mt-1">{{ fe('kiosk_pin') }}</p> }
                <p class="text-[11px] text-slate-400 mt-1">Si lo defines, el kiosko pedirá este PIN para acceder.</p>
              </div>
              @if (branch && kioskUrl()) {
                <div>
                  <label class="eg-label">Enlace del kiosko</label>
                  <div class="flex gap-2">
                    <input [value]="kioskUrl()" readonly class="eg-input font-mono text-xs" />
                    <button type="button" (click)="copyKioskUrl()" class="eg-btn-secondary shrink-0" title="Copiar">
                      <i class="fa-solid fa-copy"></i>
                    </button>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-1">Abre este enlace en la tablet de la sucursal.</p>
                </div>
              }
            </div>
          </div>

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
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  form: BranchPayload = {
    code: '', name: '', city: '', address: '', phone: '', email: '',
    latitude: null, longitude: null, opening_hours: '',
    allows_pickup: true, is_active: true, kiosk_pin: '',
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
        kiosk_pin: b.kiosk_pin || '',
      };
    }
  }

  private round8(v: number | null): number | null {
    if (v === null || v === undefined || (v as any) === '') return null;
    const n = +v;
    return isNaN(n) ? null : Math.round(n * 1e8) / 1e8;
  }
  submit() {
    this.error.set(null);
    const errs: Record<string, string> = {};
    if (!this.form.code?.trim()) errs['code'] = 'Este campo es obligatorio.';
    if (!this.form.name?.trim()) errs['name'] = 'Este campo es obligatorio.';
    if (!this.form.city?.trim()) errs['city'] = 'Este campo es obligatorio.';
    if (!this.form.address?.trim()) errs['address'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    this.saving.set(true);
    this.save.emit({
      ...this.form,
      latitude: this.round8(this.form.latitude),
      longitude: this.round8(this.form.longitude),
    });
  }
  /** Recibe el error parseado del API: errores por campo + mensaje general. */
  setErrors(parsed: ParsedApiError) {
    this.fieldErrors.set(parsed.fieldErrors || {});
    this.error.set(Object.keys(parsed.fieldErrors || {}).length ? null : (parsed.message || null));
    this.saving.set(false);
  }

  kioskUrl(): string {
    const t = (this.branch as any)?.kiosk_token;
    return (t && typeof window !== 'undefined') ? `${window.location.origin}/kiosko/${t}` : '';
  }

  copyKioskUrl(): void {
    const url = this.kioskUrl();
    if (url && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  setSaving(v: boolean) { this.saving.set(v); }
  setError(msg: string) { this.error.set(msg); this.saving.set(false); }
}
