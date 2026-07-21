import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxToggleComponent } from '@shared/ui/toggle.component';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { InventoryService, Supplier, SupplierProduct } from '@features/superadmin/services/inventory.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { DlxConfirmDialogComponent } from '@shared/ui/confirm-dialog.component';

interface SupplierForm {
  name: string; contact_name: string; phone: string;
  email: string; tax_id: string; notes: string; is_active: boolean;
}

@Component({
  selector: 'dlx-suppliers-list',
  standalone: true,
  imports: [DlxEmptyStateComponent, DlxSearchInputComponent, DlxFieldErrorComponent, CommonModule, FormsModule, DlxConfirmDialogComponent, DlxToggleComponent, DlxExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Proveedores</h1>
        <p class="text-slate-500 text-sm mt-1">Quién te entrega la mercadería. Se usan en la recepción de productos.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-sm" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
        <dlx-export-menu [columns]="exportColumns" [rows]="suppliers()" filename="proveedores" title="Proveedores" />
        <button class="eg-btn-primary text-sm" (click)="openCreate()"><i class="fa-solid fa-plus"></i> Nuevo proveedor</button>
      </div>
    </div>

    <div class="card p-3 mb-4">
      <dlx-search-input [fluid]="true" [value]="search" (valueChange)="search = $event; search$.next($event)" placeholder="Buscar por nombre, RUC, teléfono o contacto…" class="max-w-md" />
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (suppliers().length === 0) {
      <dlx-empty-state icon="fa-truck-field" title="Aún no tienes proveedores registrados.">
        <button class="eg-btn-primary" (click)="openCreate()"><i class="fa-solid fa-plus"></i> Agregar el primero</button>
      </dlx-empty-state>
    } @else {
      <!-- Tabla desktop -->
      <div class="card overflow-hidden hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
              <tr class="text-left">
                <th class="px-4 py-3 font-semibold">Proveedor</th>
                <th class="px-4 py-3 font-semibold">Contacto</th>
                <th class="px-4 py-3 font-semibold">Teléfono</th>
                <th class="px-4 py-3 font-semibold">RUC / NIF</th>
                <th class="px-4 py-3 font-semibold text-center">Estado</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (s of suppliers(); track s.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5">
                    <div class="font-medium">{{ s.name }}</div>
                    @if (s.email) { <div class="text-xs text-slate-400">{{ s.email }}</div> }
                  </td>
                  <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">{{ s.contact_name || '—' }}</td>
                  <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">{{ s.phone || '—' }}</td>
                  <td class="px-4 py-2.5 font-mono text-xs">{{ s.tax_id || '—' }}</td>
                  <td class="px-4 py-2.5 text-center">
                    @if (s.is_active) { <span class="eg-badge eg-badge-success">Activo</span> }
                    @else { <span class="eg-badge eg-badge-neutral">Inactivo</span> }
                  </td>
                  <td class="px-4 py-2.5 text-right whitespace-nowrap">
                    <button class="text-slate-400 hover:text-sky-600 mr-3" (click)="openProducts(s)" title="Productos que surte">
                      <i class="fa-solid fa-box text-xs"></i>
                    </button>
                    @if (s.phone) {
                      <a [href]="waLink(s.phone)" target="_blank" rel="noopener" class="text-slate-400 hover:text-[#25D366] mr-3" title="WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></a>
                      <a [href]="'tel:' + s.phone" class="text-slate-400 hover:text-emerald-600 mr-3" title="Llamar"><i class="fa-solid fa-phone text-xs"></i></a>
                    }
                    @if (s.email) {
                      <a [href]="'mailto:' + s.email" class="text-slate-400 hover:text-amber-600 mr-3" title="Email"><i class="fa-solid fa-envelope text-xs"></i></a>
                    }
                    <button class="text-slate-400 hover:text-[var(--dash-primary)] mr-3" (click)="openEdit(s)" title="Editar">
                      <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button class="text-rose-500 hover:text-rose-700" (click)="askDelete(s)" title="Eliminar">
                      <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cards móvil -->
      <div class="md:hidden space-y-2">
        @for (s of suppliers(); track s.id) {
          <div class="card p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ s.name }}</p>
                <p class="text-xs text-slate-400">{{ s.contact_name || '—' }}@if (s.phone) { · {{ s.phone }} }</p>
                @if (s.tax_id) { <p class="text-xs font-mono text-slate-400">{{ s.tax_id }}</p> }
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <button (click)="openProducts(s)" class="text-slate-400"><i class="fa-solid fa-box text-xs"></i></button>
                @if (s.phone) { <a [href]="waLink(s.phone)" target="_blank" rel="noopener" class="text-[#25D366]"><i class="fa-brands fa-whatsapp text-sm"></i></a> }
                <button (click)="openEdit(s)" class="text-slate-400"><i class="fa-solid fa-pen text-xs"></i></button>
                <button (click)="askDelete(s)" class="text-rose-500"><i class="fa-solid fa-trash text-xs"></i></button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Modal crear/editar -->
    @if (showModal()) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <h2 class="font-bold text-lg">{{ editing() ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
            <button class="text-slate-400 hover:text-slate-600" (click)="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <form (ngSubmit)="save()" class="p-5 space-y-4">
            @if (formError()) {
              <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{{ formError() }}</div>
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
            <dlx-toggle [(ngModel)]="form.is_active" name="is_active" text="Activo (aparece para seleccionar en recepción)" />
            <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="eg-btn-primary" [disabled]="saving()">
                <i class="fa-solid" [class.fa-spinner]="saving()" [class.fa-spin]="saving()" [class.fa-floppy-disk]="!saving()"></i>
                {{ saving() ? 'Guardando...' : (editing() ? 'Actualizar' : 'Crear proveedor') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (productsModal(); as sp) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm" (click)="productsModal.set(null)">
        <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <div>
              <h2 class="font-bold text-lg">{{ sp.name }}</h2>
              <p class="text-xs text-slate-400">Productos que te surte</p>
            </div>
            <button class="text-slate-400 hover:text-slate-600" (click)="productsModal.set(null)"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-100 dark:border-white/10">
            @if (sp.phone) {
              <a [href]="waLink(sp.phone)" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#128C4B] text-sm font-semibold"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
              <a [href]="'tel:' + sp.phone" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold"><i class="fa-solid fa-phone"></i> {{ sp.phone }}</a>
            }
            @if (sp.email) {
              <a [href]="'mailto:' + sp.email" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-semibold"><i class="fa-solid fa-envelope"></i> Email</a>
            }
            @if (!sp.phone && !sp.email) { <span class="text-xs text-slate-400">Sin datos de contacto registrados.</span> }
          </div>
          <div class="p-5 max-h-[60vh] overflow-y-auto">
            @if (loadingProducts()) {
              <div class="py-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i></div>
            } @else if (!supplierProducts().length) {
              <p class="text-sm text-slate-400 text-center py-6">Aún no hay productos recibidos de este proveedor.</p>
            } @else {
              <div class="divide-y divide-slate-100 dark:divide-white/10">
                @for (pr of supplierProducts(); track pr.product_id) {
                  <div class="flex items-center justify-between py-2.5">
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate">{{ pr.product }}</p>
                      @if (pr.last_received) { <p class="text-xs text-slate-400">Última recepción: {{ pr.last_received }}</p> }
                    </div>
                    <span class="text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ pr.qty }} u.</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }

    <dlx-confirm-dialog
      [open]="!!deleting()"
      title="¿Eliminar proveedor?"
      [message]="deleting() ? 'Se eliminará ' + deleting()!.name + '. Las recepciones pasadas no se modifican.' : ''"
      variant="danger" icon="fa-trash-can" confirmText="Eliminar" [loading]="deletingLoading()"
      (confirmed)="doDelete()" (cancelled)="deleting.set(null)" />
  `,
})
export class SuppliersListComponent implements OnInit {
  private inv = inject(InventoryService);
  private notify = inject(NotifyService);

  suppliers = signal<Supplier[]>([]);
  exportColumns: ExportColumn<Supplier>[] = [
    { header: 'Proveedor', key: 'name' },
    { header: 'Contacto', key: 'contact_name' },
    { header: 'Teléfono', key: 'phone' },
    { header: 'Email', key: 'email' },
    { header: 'RUC / ID', key: 'tax_id' },
    { header: 'Activo', key: s => (s.is_active ? 'Sí' : 'No') },
  ];
  loading = signal(true);
  search = '';
  search$ = new Subject<string>();

  showModal = signal(false);
  editing = signal<Supplier | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  form: SupplierForm = this.blank();

  deleting = signal<Supplier | null>(null);
  deletingLoading = signal(false);

  productsModal = signal<Supplier | null>(null);
  supplierProducts = signal<SupplierProduct[]>([]);
  loadingProducts = signal(false);

  openProducts(s: Supplier): void {
    this.productsModal.set(s);
    this.supplierProducts.set([]);
    this.loadingProducts.set(true);
    this.inv.supplierProducts(s.id).subscribe({
      next: r => { this.supplierProducts.set(r); this.loadingProducts.set(false); },
      error: () => this.loadingProducts.set(false),
    });
  }
  waLink(phone: string): string {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    const full = digits.startsWith('0') ? '593' + digits.slice(1) : digits;
    return 'https://wa.me/' + full;
  }

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.reload();
  }

  private blank(): SupplierForm {
    return { name: '', contact_name: '', phone: '', email: '', tax_id: '', notes: '', is_active: true };
  }

  reload(): void {
    this.loading.set(true);
    this.inv.listSuppliers(this.search.trim()).subscribe({
      next: r => { this.suppliers.set(r.results); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.error(parseApiError(e).message || 'No se pudieron cargar los proveedores.'); },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.blank();
    this.formError.set(null);
    this.showModal.set(true);
  }

  openEdit(s: Supplier): void {
    this.editing.set(s);
    this.form = {
      name: s.name, contact_name: s.contact_name, phone: s.phone,
      email: s.email, tax_id: s.tax_id, notes: s.notes, is_active: s.is_active,
    };
    this.formError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editing.set(null); }

  save(): void {
    this.formError.set(null);
    const errs: Record<string, string> = {};
    if (!this.form.name.trim()) errs['name'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    this.saving.set(true);
    const payload = { ...this.form, name: this.form.name.trim() };
    const edit = this.editing();
    const obs = edit ? this.inv.updateSupplier(edit.id, payload) : this.inv.createSupplier(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.reload();
        this.notify.success(edit ? 'Proveedor actualizado' : 'Proveedor creado');
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        this.formError.set(Object.keys(p.fieldErrors).length ? null : (p.message || 'No se pudo guardar.'));
      },
    });
  }

  askDelete(s: Supplier): void { this.deleting.set(s); }

  doDelete(): void {
    const s = this.deleting();
    if (!s) return;
    this.deletingLoading.set(true);
    this.inv.deleteSupplier(s.id).subscribe({
      next: () => {
        this.suppliers.update(list => list.filter(x => x.id !== s.id));
        this.deleting.set(null);
        this.deletingLoading.set(false);
        this.notify.success('Proveedor eliminado');
      },
      error: e => {
        this.deletingLoading.set(false);
        this.notify.error(parseApiError(e).message || 'No se pudo eliminar el proveedor.');
      },
    });
  }
}
