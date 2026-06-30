import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { ParsedApiError } from '@shared/utils/api-error.util';
import { Brand, BrandPayload } from '@features/superadmin/services/brand.service';
import { ProductService } from '@features/superadmin/services/product.service';

@Component({
  selector: 'dlx-brand-form-modal',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="680"
               [title]="brand ? 'Editar marca' : 'Nueva marca'"
               (closed)="cancel.emit()">
      <form (ngSubmit)="submit()" class="space-y-5">
          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {{ error() }}
            </div>
          }

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Nombre *</span>
            <input required [(ngModel)]="form.name" name="name" placeholder="Nike" maxlength="80"
                   class="eg-input" [class.!border-rose-400]="fe('name')" />
            <dlx-field-error [error]="fe(\'name\')" />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Descripción</span>
            <textarea [(ngModel)]="form.description" name="description" rows="3"
                      class="eg-input"
                      placeholder="Descripción breve de la marca"></textarea>
          </label>

          <div class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Logo (opcional)</span>
            <div class="flex items-center gap-3 mt-1.5">
              <div class="logo-frame h-16 w-16 rounded-xl grid place-items-center shrink-0 overflow-hidden p-2">
                @if (form.logo_url) {
                  <img [src]="form.logo_url" alt="logo" class="max-h-full max-w-full object-contain" (error)="onLogoErr($event)" />
                } @else {
                  <i class="fa-solid fa-image text-slate-300"></i>
                }
              </div>
              <div class="flex-1 min-w-0 space-y-2">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="eg-btn-secondary text-sm" (click)="logoInput.click()" [disabled]="uploadingLogo()">
                    <i class="fa-solid" [class.fa-spinner]="uploadingLogo()" [class.fa-spin]="uploadingLogo()" [class.fa-upload]="!uploadingLogo()"></i>
                    {{ uploadingLogo() ? 'Subiendo...' : 'Subir imagen' }}
                  </button>
                  @if (form.logo_url) {
                    <button type="button" class="eg-btn-secondary text-sm" (click)="form.logo_url = ''"><i class="fa-solid fa-xmark"></i> Quitar</button>
                  }
                </div>
                <input #logoInput type="file" accept="image/*" hidden (change)="onLogoFile($event)" />
                <input [(ngModel)]="form.logo_url" name="logo_url" class="eg-input" placeholder="…o pega una URL https://" autocomplete="off" />
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-6 pt-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="form.is_active" name="is_active" class="w-4 h-4" />
              <span class="text-sm">Activa</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="form.is_featured" name="is_featured" class="w-4 h-4" />
              <span class="text-sm">Destacada (aparece en home)</span>
            </label>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" (click)="cancel.emit()" class="btn-secondary">Cancelar</button>
            <button type="submit" [disabled]="saving()" class="btn-primary">
              <i class="fa-solid" [class.fa-spinner]="saving()" [class.fa-spin]="saving()"
                 [class.fa-floppy-disk]="!saving()"></i>
              {{ saving() ? 'Guardando...' : (brand ? 'Actualizar' : 'Crear marca') }}
            </button>
          </div>
        </form>
    </dlx-modal>
  `,
})
export class BrandFormModalComponent {
  @Input() brand: Brand | null = null;
  @Output() save = new EventEmitter<BrandPayload>();
  @Output() cancel = new EventEmitter<void>();

  private products = inject(ProductService);
  saving = signal(false);
  error = signal<string | null>(null);
  uploadingLogo = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  form: BrandPayload = {
    name: '', slug: '', logo_url: '', logo_dark_url: '', description: '',
    country_of_origin: '', website: '', founded_year: null,
    is_active: true, is_featured: false, sort_order: 0,
  };

  ngOnInit() {
    if (this.brand) {
      this.form = {
        name: this.brand.name, slug: this.brand.slug,
        logo_url: this.brand.logo_url, logo_dark_url: this.brand.logo_dark_url,
        description: this.brand.description,
        country_of_origin: this.brand.country_of_origin,
        website: this.brand.website, founded_year: this.brand.founded_year,
        is_active: this.brand.is_active, is_featured: this.brand.is_featured,
        sort_order: this.brand.sort_order,
      };
    }
  }

  submit() {
    this.error.set(null);
    const errs: Record<string, string> = {};
    if (!this.form.name?.trim()) errs['name'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    this.form.logo_dark_url = this.form.logo_url || '';
    this.saving.set(true);
    this.save.emit(this.form);
  }

  /** Llamado por el padre cuando termina (éxito o error) */
  done(err?: string) {
    this.saving.set(false);
    if (err) this.error.set(err);
  }
  /** Recibe el error parseado del API: errores por campo + mensaje general. */
  setErrors(parsed: ParsedApiError) {
    this.saving.set(false);
    this.fieldErrors.set(parsed.fieldErrors || {});
    this.error.set(Object.keys(parsed.fieldErrors || {}).length ? null : (parsed.message || null));
  }

  onLogoErr(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.style.display = 'none';
  }

  onLogoFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingLogo.set(true);
    this.error.set(null);
    this.products.uploadImage(file).subscribe({
      next: r => { this.form.logo_url = r.url; this.uploadingLogo.set(false); },
      error: () => { this.error.set('No se pudo subir el logo.'); this.uploadingLogo.set(false); },
    });
    input.value = '';
  }
}
