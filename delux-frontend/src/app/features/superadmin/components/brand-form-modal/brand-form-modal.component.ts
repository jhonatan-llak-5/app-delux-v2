import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Brand, BrandPayload } from '@features/superadmin/services/brand.service';

@Component({
  selector: 'dlx-brand-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm
                p-4 animate-fade-in" (click)="cancel.emit()">
      <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
           (click)="$event.stopPropagation()">
        <!-- Header -->
        <header class="sticky top-0 bg-white border-b border-slate-200 px-6 py-4
                       flex items-center justify-between z-10">
          <h2 class="font-display font-bold text-xl">
            {{ brand ? 'Editar marca' : 'Nueva marca' }}
          </h2>
          <button (click)="cancel.emit()" class="w-9 h-9 grid place-items-center
                                                   rounded-lg hover:bg-slate-100" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <!-- Body -->
        <form (ngSubmit)="submit()" class="p-6 space-y-5">
          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {{ error() }}
            </div>
          }

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Nombre *</span>
              <input required [(ngModel)]="form.name" name="name" placeholder="Nike"
                     class="dlx-input" />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Slug</span>
              <input [(ngModel)]="form.slug" name="slug" placeholder="nike"
                     class="dlx-input" />
              <span class="text-[10px] text-slate-400 mt-1 block">Si vacío, se genera del nombre.</span>
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Descripción</span>
            <textarea [(ngModel)]="form.description" name="description" rows="3"
                      class="dlx-input"
                      placeholder="Descripción breve de la marca"></textarea>
          </label>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">URL del logo</span>
              <input [(ngModel)]="form.logo_url" name="logo_url"
                     class="dlx-input"
                     placeholder="https://..." />
              @if (form.logo_url) {
                <img [src]="form.logo_url" alt="preview"
                     class="mt-2 h-12 object-contain"
                     (error)="onLogoErr($event)" />
              }
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">URL logo dark</span>
              <input [(ngModel)]="form.logo_dark_url" name="logo_dark_url"
                     class="dlx-input"
                     placeholder="https://..." />
              @if (form.logo_dark_url) {
                <img [src]="form.logo_dark_url" alt="preview"
                     class="mt-2 h-12 object-contain bg-ink-900 p-2 rounded"
                     (error)="onLogoErr($event)" />
              }
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">País de origen</span>
              <input [(ngModel)]="form.country_of_origin" name="country" placeholder="Estados Unidos"
                     class="dlx-input" />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Año fundación</span>
              <input type="number" [(ngModel)]="form.founded_year" name="founded_year"
                     placeholder="1964" class="dlx-input" />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Orden</span>
              <input type="number" [(ngModel)]="form.sort_order" name="sort_order" placeholder="0"
                     class="dlx-input" />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-600">Sitio web</span>
            <input [(ngModel)]="form.website" name="website" placeholder="https://nike.com"
                   class="dlx-input" />
          </label>

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
      </div>
    </div>
  `,
  styles: [`
    .dlx-input {
      @apply mt-1 w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200
             text-sm text-slate-900 placeholder:text-slate-400
             focus:outline-none focus:border-slate-400 focus:bg-white transition;
    }
  `],
})
export class BrandFormModalComponent {
  @Input() brand: Brand | null = null;
  @Output() save = new EventEmitter<BrandPayload>();
  @Output() cancel = new EventEmitter<void>();

  saving = signal(false);
  error = signal<string | null>(null);

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
    if (!this.form.name) {
      this.error.set('El nombre es requerido.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    this.save.emit(this.form);
  }

  /** Llamado por el padre cuando termina (éxito o error) */
  done(err?: string) {
    this.saving.set(false);
    if (err) this.error.set(err);
  }

  onLogoErr(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
