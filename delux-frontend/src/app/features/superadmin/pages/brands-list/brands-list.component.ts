import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';

import { Brand, BrandPayload, BrandService } from '@features/superadmin/services/brand.service';
import { BrandFormModalComponent } from '@features/superadmin/components/brand-form-modal/brand-form-modal.component';
import { NotifyService } from '@shared/services/notify.service';

import {
  DlxPageHeaderComponent,
  DlxButtonComponent,
  DlxCardComponent,
  DlxInputComponent,
  DlxSelectComponent,
  DlxEmptyStateComponent,
  DlxActionBtnComponent,
  DlxConfirmDialogComponent,
} from '@shared/ui';

@Component({
  selector: 'dlx-brands-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    BrandFormModalComponent,
    DlxPageHeaderComponent, DlxButtonComponent, DlxCardComponent,
    DlxInputComponent, DlxSelectComponent, DlxEmptyStateComponent,
    DlxActionBtnComponent, DlxConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brands-list.component.html',
})
export class BrandsListComponent implements OnInit {
  private brandSvc = inject(BrandService);
  private notify = inject(NotifyService);

  brands = signal<Brand[]>([]);
  loading = signal(true);
  search = signal('');
  statusFilter = signal('');
  ordering = signal('sort_order');

  showModal = signal(false);
  editing = signal<Brand | null>(null);
  deleting = signal<Brand | null>(null);
  deletingLoading = signal(false);

  readonly statusOptions = [
    { value: '',         label: 'Todas' },
    { value: 'active',   label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
    { value: 'featured', label: 'Destacadas' },
  ];
  readonly orderOptions = [
    { value: 'sort_order',      label: 'Orden personalizado' },
    { value: 'name',            label: 'Nombre A-Z' },
    { value: '-name',           label: 'Nombre Z-A' },
    { value: '-products_count', label: '+ Productos' },
    { value: '-created_at',     label: '+ Recientes' },
  ];

  private search$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.reload();
  }

  reload() {
    this.loading.set(true);
    const opts: any = { search: this.search(), ordering: this.ordering() };
    const st = this.statusFilter();
    if (st === 'active')   opts.is_active = true;
    if (st === 'inactive') opts.is_active = false;
    if (st === 'featured') opts.is_featured = true;
    this.brandSvc.list(opts).subscribe({
      next: r => { this.brands.set(r.results); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.fromServerError(e); },
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }
  onStatus(v: string) { this.statusFilter.set(v ?? ''); this.reload(); }
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
      next: () => {
        this.closeModal();
        this.reload();
        this.notify.success(edit ? 'Marca actualizada' : 'Marca creada');
      },
      error: e => this.notify.fromServerError(e, 'No se pudo guardar la marca.'),
    });
  }

  toggleActive(b: Brand) {
    this.brandSvc.toggleActive(b.slug).subscribe({
      next: r => {
        this.brands.update(list => list.map(x => x.id === b.id ? { ...x, is_active: r.is_active } : x));
        this.notify.success(r.is_active ? 'Marca activada' : 'Marca desactivada');
      },
      error: e => this.notify.fromServerError(e),
    });
  }

  toggleFeatured(b: Brand) {
    this.brandSvc.toggleFeatured(b.slug).subscribe({
      next: r => {
        this.brands.update(list => list.map(x => x.id === b.id ? { ...x, is_featured: r.is_featured } : x));
        this.notify.success(r.is_featured ? 'Marca destacada' : 'Sin destacar');
      },
      error: e => this.notify.fromServerError(e),
    });
  }

  confirmDelete(b: Brand) { this.deleting.set(b); }

  doDelete() {
    const b = this.deleting();
    if (!b) return;
    this.deletingLoading.set(true);
    this.brandSvc.remove(b.slug).subscribe({
      next: () => {
        this.brands.update(list => list.filter(x => x.id !== b.id));
        this.deleting.set(null);
        this.deletingLoading.set(false);
        this.notify.success('Marca eliminada');
      },
      error: (e: any) => {
        this.deletingLoading.set(false);
        this.notify.fromServerError(e, 'No se pudo eliminar (¿tiene productos asociados?).');
      },
    });
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).style.display = 'none';
  }
}
