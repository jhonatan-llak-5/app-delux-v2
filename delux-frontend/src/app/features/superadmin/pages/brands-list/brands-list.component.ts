import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Brand, BrandPayload, BrandService } from '@features/superadmin/services/brand.service';
import { BrandFormModalComponent } from '@features/superadmin/components/brand-form-modal/brand-form-modal.component';
import { Subject, debounceTime } from 'rxjs';

@Component({
  selector: 'dlx-brands-list',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Marcas</h1>
        <p class="text-slate-500 text-sm mt-1">
          Gestión global de las marcas comercializadas en la plataforma.
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary" (click)="reload()">
          <i class="fa-solid fa-arrows-rotate"></i> Recargar
        </button>
        <button class="btn-primary" (click)="openCreate()">
          <i class="fa-solid fa-plus"></i> Nueva marca
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar marca por nombre, slug o país..."
               [ngModel]="search()" (ngModelChange)="onSearch($event)"
               class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-transparent
                      focus:bg-white focus:border-slate-300 focus:outline-none text-sm" />
      </div>
      <select [ngModel]="statusFilter()" (ngModelChange)="onStatus($event)"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none text-sm">
        <option value="">Todas</option>
        <option value="active">Activas</option>
        <option value="inactive">Inactivas</option>
        <option value="featured">Destacadas</option>
      </select>
      <select [ngModel]="ordering()" (ngModelChange)="onOrder($event)"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none text-sm">
        <option value="sort_order">Orden personalizado</option>
        <option value="name">Nombre A-Z</option>
        <option value="-name">Nombre Z-A</option>
        <option value="-products_count">+ Productos</option>
        <option value="-created_at">+ Recientes</option>
      </select>
    </div>

    <!-- Grid de cards -->
    @if (loading()) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
        <p>Cargando marcas...</p>
      </div>
    } @else if (brands().length === 0) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-tags text-4xl opacity-30 mb-3"></i>
        <p class="font-semibold">No hay marcas registradas</p>
        <p class="text-sm mt-1">Crea la primera para empezar a construir el catálogo.</p>
        <button class="btn-primary mt-4" (click)="openCreate()">
          <i class="fa-solid fa-plus"></i> Nueva marca
        </button>
      </div>
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        @for (b of brands(); track b.id) {
          <article class="card p-5 hover:shadow-md transition group relative
                          flex flex-col"
                   [class.opacity-50]="!b.is_active">
            <!-- Badges -->
            <div class="absolute top-3 right-3 flex gap-1">
              @if (b.is_featured) {
                <span class="text-[9px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <i class="fa-solid fa-star"></i> Destacada
                </span>
              }
              @if (!b.is_active) {
                <span class="text-[9px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Inactiva
                </span>
              }
            </div>

            <!-- Logo -->
            <div class="h-20 grid place-items-center mb-4">
              @if (b.logo_url) {
                <img [src]="b.logo_url" [alt]="b.name"
                     class="max-h-16 max-w-full object-contain"
                     (error)="onImgError($event)" />
              } @else {
                <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-cyan-100
                            grid place-items-center text-2xl font-display font-extrabold text-slate-700">
                  {{ b.name[0] }}
                </div>
              }
            </div>

            <!-- Info -->
            <h3 class="font-display font-bold text-lg text-center">{{ b.name }}</h3>
            <p class="text-xs font-mono text-slate-400 text-center mt-0.5">/{{ b.slug }}</p>

            @if (b.country_of_origin || b.founded_year) {
              <p class="text-xs text-slate-500 text-center mt-2">
                @if (b.country_of_origin) { <span>{{ b.country_of_origin }}</span> }
                @if (b.country_of_origin && b.founded_year) { <span> · </span> }
                @if (b.founded_year) { <span>est. {{ b.founded_year }}</span> }
              </p>
            }

            <!-- Stats -->
            <div class="mt-4 grid grid-cols-2 gap-2 text-center">
              <div class="rounded-lg bg-slate-50 p-2">
                <div class="text-lg font-bold">{{ b.products_count }}</div>
                <div class="text-[10px] uppercase tracking-widest text-slate-500">Productos</div>
              </div>
              <div class="rounded-lg bg-slate-50 p-2">
                <div class="text-lg font-bold text-emerald-600">{{ b.active_products_count }}</div>
                <div class="text-[10px] uppercase tracking-widest text-slate-500">Publicados</div>
              </div>
            </div>

            <!-- Actions -->
            <div class="mt-auto pt-4 flex gap-1 justify-center">
              <button (click)="toggleActive(b)"
                      [title]="b.is_active ? 'Desactivar' : 'Activar'"
                      class="w-9 h-9 rounded-lg hover:bg-slate-100 transition">
                <i class="fa-solid text-sm"
                   [class.fa-toggle-on]="b.is_active" [class.text-emerald-600]="b.is_active"
                   [class.fa-toggle-off]="!b.is_active" [class.text-slate-400]="!b.is_active"></i>
              </button>
              <button (click)="toggleFeatured(b)" title="Destacar"
                      class="w-9 h-9 rounded-lg hover:bg-slate-100 transition">
                <i class="fa-solid fa-star text-sm" [class.text-amber-500]="b.is_featured"
                   [class.text-slate-300]="!b.is_featured"></i>
              </button>
              <button (click)="openEdit(b)" title="Editar"
                      class="w-9 h-9 rounded-lg hover:bg-slate-100 transition">
                <i class="fa-solid fa-pen text-sm text-slate-600"></i>
              </button>
              <button (click)="confirmDelete(b)" title="Eliminar"
                      class="w-9 h-9 rounded-lg hover:bg-rose-50 transition">
                <i class="fa-solid fa-trash text-sm text-rose-500"></i>
              </button>
            </div>
          </article>
        }
      </div>
    }

    <!-- Modal de form -->
    @if (showModal()) {
      <dlx-brand-form-modal
        [brand]="editing()"
        (save)="onSave($event)"
        (cancel)="closeModal()" />
    }

    <!-- Confirm delete -->
    @if (deleting()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6">
          <h3 class="font-display font-bold text-lg">¿Eliminar marca?</h3>
          <p class="text-sm text-slate-500 mt-2">
            Esta acción eliminará permanentemente la marca
            <strong>{{ deleting()!.name }}</strong>. Si tiene productos asociados,
            la eliminación fallará.
          </p>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="deleting.set(null)" class="btn-secondary">Cancelar</button>
            <button (click)="doDelete()" class="btn-primary bg-rose-600 hover:bg-rose-700 text-white">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BrandsListComponent implements OnInit {
  private brandSvc = inject(BrandService);

  brands = signal<Brand[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  ordering = signal('sort_order');

  showModal = signal(false);
  editing = signal<Brand | null>(null);
  deleting = signal<Brand | null>(null);

  private search$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.reload();
  }

  reload() {
    this.loading.set(true);
    const opts: any = { search: this.search(), ordering: this.ordering() };
    const st = this.statusFilter();
    if (st === 'active') opts.is_active = true;
    if (st === 'inactive') opts.is_active = false;
    if (st === 'featured') opts.is_featured = true;
    this.brandSvc.list(opts).subscribe({
      next: r => { this.brands.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }
  onStatus(v: string) { this.statusFilter.set(v); this.reload(); }
  onOrder(v: string)  { this.ordering.set(v); this.reload(); }

  openCreate() { this.editing.set(null); this.showModal.set(true); }
  openEdit(b: Brand) { this.editing.set(b); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editing.set(null); }

  onSave(payload: BrandPayload) {
    const edit = this.editing();
    const obs = edit
      ? this.brandSvc.update(edit.slug, payload)
      : this.brandSvc.create(payload);
    obs.subscribe({
      next: () => { this.closeModal(); this.reload(); },
      error: (e) => {
        const msg = e?.error?.error?.detail
                 ?? Object.values(e?.error?.error?.detail ?? {})[0]?.toString()
                 ?? 'Error al guardar la marca.';
        alert(msg);
      },
    });
  }

  toggleActive(b: Brand) {
    this.brandSvc.toggleActive(b.slug).subscribe(r => {
      this.brands.update(list => list.map(x => x.id === b.id ? { ...x, is_active: r.is_active } : x));
    });
  }

  toggleFeatured(b: Brand) {
    this.brandSvc.toggleFeatured(b.slug).subscribe(r => {
      this.brands.update(list => list.map(x => x.id === b.id ? { ...x, is_featured: r.is_featured } : x));
    });
  }

  confirmDelete(b: Brand) { this.deleting.set(b); }

  doDelete() {
    const b = this.deleting();
    if (!b) return;
    this.brandSvc.remove(b.slug).subscribe({
      next: () => { this.deleting.set(null); this.reload(); },
      error: (e) => alert(e?.error?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }

  onImgError(ev: Event) {
    (ev.target as HTMLImageElement).style.display = 'none';
  }
}
