import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AdminBranch, AdminTenant } from '@features/superadmin/services/admin.service';
import { BranchFormModalComponent, BranchPayload } from '@features/superadmin/components/branch-form-modal/branch-form-modal.component';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-tenant-branches',
  standalone: true,
  imports: [CommonModule, RouterLink, BranchFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <a routerLink="/app/admin/tenants"
           class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink-900 mb-2">
          <i class="fa-solid fa-arrow-left text-xs"></i> Tiendas
        </a>
        @if (tenant()) {
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ tenant()!.name }} — Sucursales</h1>
          <p class="text-slate-500 text-sm mt-1">
            {{ branches().length }} sucursal(es) · cada una con su propio catálogo y stock.
          </p>
        }
      </div>
      <button (click)="openCreate()" class="eg-btn-primary">
        <i class="fa-solid fa-plus"></i> Nueva sucursal
      </button>
    </div>

    <div class="flex gap-2 mb-4">
      @for (f of filters; track f.key) {
        <button (click)="filter.set(f.key)"
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                [class.bg-ink-950]="filter() === f.key" [class.text-white]="filter() === f.key"
                [class.dark:bg-white]="filter() === f.key" [class.dark:text-ink-950]="filter() === f.key"
                [class.border-ink-200]="filter() !== f.key" [class.dark:border-white/15]="filter() !== f.key"
                [class.text-slate-600]="filter() !== f.key" [class.dark:text-white/70]="filter() !== f.key">
          {{ f.label }}
        </button>
      }
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @if (loading()) {
        <div class="card p-6 text-slate-400 col-span-full">Cargando sucursales...</div>
      } @else if (branches().length === 0) {
        <div class="card p-6 text-slate-400 col-span-full">
          Esta tienda aún no tiene sucursales.
          <button (click)="openCreate()" class="ml-2 text-[#1e40af] font-semibold hover:underline">Crear la primera</button>
        </div>
      } @else if (visibleBranches().length === 0) {
        <div class="card p-6 text-slate-400 col-span-full">No hay sucursales con ese filtro.</div>
      } @else {
        @for (b of visibleBranches(); track b.id) {
          <div class="card p-5 hover:shadow-md transition group relative">
            <div class="absolute top-3 right-3 flex gap-1">
              <button (click)="toggleActive(b)" [title]="b.is_active ? 'Desactivar' : 'Activar'"
                      class="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                      [class.hover:text-amber-600]="b.is_active" [class.hover:text-emerald-600]="!b.is_active">
                <i class="fa-solid text-xs" [class.fa-toggle-on]="b.is_active" [class.fa-toggle-off]="!b.is_active"></i>
              </button>
              <button (click)="openEdit(b)" title="Editar"
                      class="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#1e40af]">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button (click)="onDelete(b)" title="Eliminar"
                      class="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>

            <div class="pr-16">
              <p class="text-[10px] tracking-widest uppercase text-slate-400 font-semibold">{{ b.code }}</p>
              <h3 class="text-lg font-semibold mt-0.5">{{ b.name }}</h3>
              <p class="text-sm text-slate-500">{{ b.city }}</p>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-2"
                  [class.bg-emerald-100]="b.is_active" [class.text-emerald-700]="b.is_active"
                  [class.bg-rose-100]="!b.is_active"   [class.text-rose-700]="!b.is_active">
              {{ b.is_active ? 'Activa' : 'Inactiva' }}
            </span>

            <div class="mt-4 space-y-2 text-sm text-slate-600 dark:text-white/70">
              <div class="flex items-start gap-2">
                <i class="fa-solid fa-location-dot text-slate-400 mt-1 w-4 text-center"></i>
                {{ b.address }}
              </div>
              @if (b.phone) {
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-phone text-slate-400 w-4 text-center"></i>
                  {{ b.phone }}
                </div>
              }
            </div>

            <div class="mt-5 flex items-center justify-between">
              <div class="inline-flex items-center gap-2 text-sm">
                <i class="fa-solid fa-box text-accent-500"></i>
                <span class="font-bold">{{ b.products_count }}</span>
                <span class="text-slate-500">producto(s)</span>
              </div>
              <a [routerLink]="['/app/admin/branches', b.id, 'catalog']"
                 class="inline-flex items-center gap-1 text-xs font-semibold text-ink-900 dark:text-white hover:underline">
                Ver catálogo
                <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              </a>
            </div>
          </div>
        }
      }
    </div>

    @if (showForm()) {
      <dlx-branch-form-modal #modal [branch]="editing()"
                             (save)="onSave($event)" (cancel)="closeForm()" />
    }
  `,
})
export class TenantBranchesComponent implements OnInit {
  slug = input.required<string>();
  private admin = inject(AdminService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);

  @ViewChild('modal') modal?: BranchFormModalComponent;

  tenant = signal<AdminTenant | null>(null);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);
  showForm = signal(false);
  editing = signal<AdminBranch | null>(null);
  filter = signal<'all' | 'active' | 'inactive'>('all');
  readonly filters = [
    { key: 'all' as const, label: 'Todas' },
    { key: 'active' as const, label: 'Activas' },
    { key: 'inactive' as const, label: 'Inactivas' },
  ];
  visibleBranches = computed(() => {
    const f = this.filter();
    return this.branches().filter(b =>
      f === 'all' ? true : f === 'active' ? b.is_active : !b.is_active);
  });

  ngOnInit(): void {
    this.admin.getTenant(this.slug()).subscribe(t => this.tenant.set(t));
    this.reload();
  }

  private reload() {
    this.loading.set(true);
    this.admin.listBranches(this.slug()).subscribe({
      next: (r) => { this.branches.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate() { this.editing.set(null); this.showForm.set(true); }
  openEdit(b: AdminBranch) { this.editing.set(b); this.showForm.set(true); }
  closeForm() { this.showForm.set(false); this.editing.set(null); }

  onSave(payload: BranchPayload) {
    const editing = this.editing();
    const req = editing
      ? this.admin.updateBranch(editing.id, payload)
      : this.admin.createBranch({ ...payload, tenant_slug: this.slug() });
    req.subscribe({
      next: () => {
        this.notify.success(editing ? 'Sucursal actualizada' : 'Sucursal creada');
        this.closeForm();
        this.reload();
      },
      error: (e) => {
        const parsed = parseApiError(e);
        this.modal?.setErrors(parsed);
        if (parsed.message && !Object.keys(parsed.fieldErrors).length) {
          this.notify.error(parsed.message);
        }
      },
    });
  }

  async onDelete(b: AdminBranch) {
    const usage = await new Promise<{ products_count: number; staff_count: number; orders_count: number } | null>(
      resolve => this.admin.branchUsage(b.id).subscribe({ next: u => resolve(u), error: () => resolve(null) }));

    // Si tiene pedidos, no se puede borrar (se perdería historial): ofrecer desactivar.
    if (usage && usage.orders_count > 0) {
      if (!b.is_active) {
        this.notify.warning('No se puede eliminar: tiene ' + usage.orders_count + ' pedido(s). Ya está desactivada.');
        return;
      }
      const ok = await this.confirm.ask({
        title: '"' + b.name + '" tiene pedidos',
        message: 'No se puede eliminar porque tiene ' + usage.orders_count + ' pedido(s) (se perderia el historial).\n\n'
          + 'Puedes desactivarla: dejara de aparecer en la tienda y el checkout, pero conservaras su informacion e historial.',
        variant: 'warning', confirmText: 'Desactivar sucursal',
      });
      if (!ok) return;
      this.admin.updateBranch(b.id, { is_active: false }).subscribe({
        next: () => { this.notify.success('Sucursal desactivada'); this.reload(); },
        error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo desactivar.'),
      });
      return;
    }

    const parts: string[] = [];
    if (usage) {
      if (usage.products_count) parts.push(usage.products_count + ' producto(s) con stock');
      if (usage.staff_count) parts.push(usage.staff_count + ' usuario(s) asignado(s)');
    }
    const detail = parts.length
      ? 'Esta sucursal tiene ' + parts.join(', ') + '.'
      : 'Esta sucursal no tiene productos ni personal asignado.';

    const ok = await this.confirm.ask({
      title: 'Eliminar "' + b.name + '"',
      message: detail + '\n\n¿Seguro que deseas eliminarla? Esta accion no se puede deshacer.',
      variant: 'danger', confirmText: 'Si, eliminar',
    });
    if (!ok) return;
    this.admin.deleteBranch(b.id).subscribe({
      next: () => { this.notify.success('Sucursal eliminada'); this.reload(); },
      error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo eliminar (puede tener pedidos asociados).'),
    });
  }

  toggleActive(b: AdminBranch) {
    const next = !b.is_active;
    this.admin.updateBranch(b.id, { is_active: next }).subscribe({
      next: () => { this.notify.success(next ? 'Sucursal activada' : 'Sucursal desactivada'); this.reload(); },
      error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo actualizar.'),
    });
  }
}
