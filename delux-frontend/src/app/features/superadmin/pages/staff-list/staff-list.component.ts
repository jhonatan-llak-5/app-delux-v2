import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { StaffService, StaffUser } from '@features/superadmin/services/staff.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-staff-list',
  standalone: true,
  imports: [DlxSearchInputComponent, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-user-tie"></i>
          <span class="uppercase tracking-widest font-semibold">Operación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Equipo</h1>
        <p class="text-slate-500 text-sm mt-1">
          Gerentes y vendedores por sucursal. {{ staff().length }} miembros en pantalla.
        </p>
      </div>
      <a routerLink="/app/admin/staff/new"
         class="px-4 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900 transition flex items-center gap-2">
        <i class="fa-solid fa-user-plus"></i> Nuevo miembro
      </a>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total equipo</p>
        <p class="text-2xl font-bold mt-1">{{ staff().length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-violet-600 font-semibold">Gerentes</p>
        <p class="text-2xl font-bold text-violet-600 mt-1">{{ countByRole('BRANCH_MANAGER') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-sky-600 font-semibold">Vendedores</p>
        <p class="text-2xl font-bold text-sky-600 mt-1">{{ countByRole('SALESPERSON') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">Activos</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ activeCount() }}</p>
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por nombre, email, teléfono..." class="flex-1 min-w-[200px]" />
      <select [(ngModel)]="branchFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option [ngValue]="null">Todas las sucursales</option>
        @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
      </select>
      <select [(ngModel)]="roleFilter" (change)="reload()"
              class="eg-input border-transparent">
        <option value="">Todos los roles</option>
        <option value="BRANCH_MANAGER">Gerentes</option>
        <option value="SALESPERSON">Vendedores</option>
      </select>
    </div>

    @if (loading()) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    } @else if (staff().length === 0) {
      <div class="card p-12 text-center text-slate-400">
        <i class="fa-solid fa-users text-3xl mb-3"></i>
        <p>No hay miembros del equipo.</p>
      </div>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        @for (s of staff(); track s.id) {
          <div class="card p-5 hover:shadow-lg transition group">
            <div class="flex items-start justify-between mb-3">
              <div class="w-12 h-12 rounded-full grid place-items-center text-white font-bold text-base"
                   [style.background]="avatarColor(s)">
                {{ initials(s.full_name) }}
              </div>
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                    [ngClass]="roleBadge(s.role)">
                {{ s.role_label }}
              </span>
            </div>

            <h3 class="font-bold tracking-tight truncate">{{ s.full_name }}</h3>
            <p class="text-xs text-slate-500 truncate">{{ s.email }}</p>

            <div class="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              @if (s.branch_name) {
                <p class="flex items-center gap-1.5 text-slate-600">
                  <i class="fa-solid fa-location-dot text-slate-400 w-3"></i>
                  {{ s.branch_name }}
                </p>
              }
              @if (s.phone) {
                <p class="flex items-center gap-1.5 text-slate-600">
                  <i class="fa-solid fa-phone text-slate-400 w-3"></i>
                  {{ s.phone }}
                </p>
              }
              @if (+s.commission_rate > 0) {
                <p class="flex items-center gap-1.5 text-violet-600">
                  <i class="fa-solid fa-percent text-violet-400 w-3"></i>
                  {{ s.commission_rate }}% comisión
                </p>
              }
              @if (s.hire_date) {
                <p class="flex items-center gap-1.5 text-slate-600">
                  <i class="fa-solid fa-calendar text-slate-400 w-3"></i>
                  Desde {{ s.hire_date | date:'mediumDate' }}
                </p>
              }
            </div>

            <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="inline-flex items-center gap-1.5 text-xs"
                    [class.text-emerald-600]="s.is_active"
                    [class.text-rose-600]="!s.is_active">
                <span class="w-1.5 h-1.5 rounded-full"
                      [class.bg-emerald-500]="s.is_active"
                      [class.bg-rose-500]="!s.is_active"></span>
                {{ s.is_active ? 'Activo' : 'Inactivo' }}
              </span>
              <div class="flex gap-1">
                <a [routerLink]="['/app/admin/staff', s.id]" title="Editar"
                   class="w-8 h-8 grid place-items-center rounded-lg hover:bg-sky-100 hover:text-sky-700 transition text-slate-500">
                  <i class="fa-solid fa-pen text-xs"></i>
                </a>
                <button (click)="toggle(s)" [title]="s.is_active ? 'Desactivar' : 'Activar'"
                        class="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-100 hover:text-amber-700 transition text-slate-500">
                  <i class="fa-solid" [class.fa-eye]="s.is_active" [class.fa-eye-slash]="!s.is_active"></i>
                </button>
                <button (click)="remove(s)" title="Eliminar"
                        class="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose-100 hover:text-rose-700 transition text-slate-500">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class StaffListComponent implements OnInit {
  private svc = inject(StaffService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private adminSvc = inject(AdminService);

  staff = signal<StaffUser[]>([]);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);
  search = signal('');
  branchFilter: number | null = null;
  roleFilter = '';
  private search$ = new Subject<void>();

  ngOnInit() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.svc.list({
      search: this.search() || undefined,
      branch: this.branchFilter || undefined,
      role: this.roleFilter || undefined,
    }).subscribe({
      next: r => { this.staff.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  countByRole(r: string) { return this.staff().filter(s => s.role === r).length; }
  activeCount() { return this.staff().filter(s => s.is_active).length; }

  initials(name: string) {
    return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || '??';
  }

  avatarColor(s: StaffUser) {
    const palette = ['#7c3aed', '#22d3ee', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'];
    return palette[s.id % palette.length];
  }

  roleBadge(r: string) {
    return ({
      BRANCH_MANAGER: 'bg-violet-100 text-violet-700',
      SALESPERSON: 'bg-sky-100 text-sky-700',
    } as any)[r];
  }

  toggle(s: StaffUser) {
    this.svc.toggleActive(s.id).subscribe(() => this.reload());
  }

  async remove(s: StaffUser) {
    const ok = await this.confirm.ask({
      title: 'Eliminar miembro',
      message: `¿Eliminar a ${s.full_name}? Esta acción no se puede deshacer.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.svc.delete(s.id).subscribe({
      next: () => { this.notify.success('Miembro eliminado'); this.reload(); },
      error: e => this.notify.fromServerError(e, 'No se pudo eliminar.'),
    });
  }
}
