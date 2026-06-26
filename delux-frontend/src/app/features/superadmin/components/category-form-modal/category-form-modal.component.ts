import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, CategoryPayload, CategoryService } from '@features/superadmin/services/category.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { DlxModalComponent } from '@shared/ui/modal.component';

interface FlatOption { id: number; label: string; depth: number; }

@Component({
  selector: 'dlx-category-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="560"
               [title]="category ? 'Editar categoría' : 'Nueva categoría'"
               (closed)="close.emit()">
      <form (ngSubmit)="submit()" #form="ngForm" class="space-y-4">
          <div>
            <label class="eg-label">Nombre *</label>
            <input [(ngModel)]="payload.name" name="name" required maxlength="80"
                   class="eg-input"
                   placeholder="ej. Zapatillas" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Slug</label>
              <input [(ngModel)]="payload.slug" name="slug" maxlength="80"
                     class="eg-input font-mono"
                     placeholder="auto" />
              <p class="text-[10px] text-slate-400 mt-1">Se genera automáticamente si está vacío.</p>
            </div>
            <div>
              <label class="eg-label">Orden</label>
              <input type="number" [(ngModel)]="payload.sort_order" name="sort_order" min="0" max="999"
                     class="eg-input" />
            </div>
          </div>

          <div>
            <label class="eg-label">Categoría padre</label>
            <select [(ngModel)]="payload.parent" name="parent"
                    class="eg-input">
              <option [ngValue]="null">— Categoría raíz —</option>
              @for (opt of parentOptions(); track opt.id) {
                <option [ngValue]="opt.id">{{ opt.label }}</option>
              }
            </select>
          </div>

          <div>
            <label class="eg-label">Ícono FontAwesome</label>
            <div class="flex gap-2">
              <div class="w-11 h-11 grid place-items-center rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                @if (payload.icon) {
                  <i class="fa-solid {{ payload.icon }} text-slate-700"></i>
                } @else {
                  <i class="fa-solid fa-shapes text-slate-400"></i>
                }
              </div>
              <input [(ngModel)]="payload.icon" name="icon" maxlength="40"
                     class="eg-input font-mono flex-1"
                     placeholder="fa-shoe-prints" />
            </div>
            <p class="text-[10px] text-slate-400 mt-1">
              Cualquier ícono solid de FontAwesome 7. Ej: fa-shoe-prints, fa-shirt, fa-bag-shopping
            </p>
          </div>

          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition">
            <input type="checkbox" [(ngModel)]="payload.is_active" name="is_active"
                   class="w-4 h-4 accent-emerald-500" />
            <div>
              <p class="text-sm font-semibold">Activa</p>
              <p class="text-xs text-slate-500">Visible en el catálogo público</p>
            </div>
          </label>

          @if (error()) {
            <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" (click)="close.emit()" class="btn-secondary text-sm">Cancelar</button>
            <button type="submit" [disabled]="!form.valid || saving()"
                    class="px-5 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold
                           hover:bg-ink-900 disabled:opacity-50 transition">
              @if (saving()) {
                <i class="fa-solid fa-spinner fa-spin"></i> Guardando...
              } @else {
                {{ category ? 'Guardar cambios' : 'Crear categoría' }}
              }
            </button>
          </div>
      </form>
    </dlx-modal>
  `,
})
export class CategoryFormModalComponent implements OnInit {
  private service = inject(CategoryService);

  @Input() category: Category | null = null;
  @Input() defaultParent: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Category>();

  payload: CategoryPayload = {
    name: '', slug: '', parent: null, icon: '',
    sort_order: 0, is_active: true,
  };

  saving = signal(false);
  error = signal<string | null>(null);
  parentOptions = signal<FlatOption[]>([]);

  ngOnInit(): void {
    if (this.category) {
      this.payload = {
        name: this.category.name,
        slug: this.category.slug,
        parent: this.category.parent,
        icon: this.category.icon,
        sort_order: this.category.sort_order,
        is_active: this.category.is_active,
      };
    } else if (this.defaultParent) {
      this.payload.parent = this.defaultParent;
    }
    this.loadParents();
  }

  loadParents(): void {
    this.service.tree().subscribe(r => {
      const flat: FlatOption[] = [];
      const walk = (nodes: any[], depth = 0) => {
        for (const n of nodes) {
          if (this.category && n.id === this.category.id) continue;
          flat.push({ id: n.id, label: '— '.repeat(depth) + n.name, depth });
          if (n.children?.length) walk(n.children, depth + 1);
        }
      };
      walk(r.results);
      this.parentOptions.set(flat);
    });
  }

  submit(): void {
    if (!this.payload.name) return;
    this.saving.set(true);
    this.error.set(null);
    const obs = this.category
      ? this.service.update(this.category.id, this.payload)
      : this.service.create(this.payload);
    obs.subscribe({
      next: cat => { this.saving.set(false); this.saved.emit(cat); },
      error: e => {
        this.saving.set(false);
        const detail = parseApiError(e).message || 'Error al guardar';
        this.error.set(detail);
      },
    });
  }

  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close.emit();
  }
}
