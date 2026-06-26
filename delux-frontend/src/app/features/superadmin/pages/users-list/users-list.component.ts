import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService, AdminUser } from '@features/superadmin/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';
import { debounceTime, Subject } from 'rxjs';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Usuarios</h1>
        <p class="text-slate-500 text-sm mt-1">Staff y clientes registrados en la plataforma.</p>
      </div>
      <a routerLink="/app/admin/staff/new"
         class="px-4 py-2.5 rounded-lg bg-[#1e40af] text-white text-sm font-semibold
                hover:bg-[#1d4ed8] transition inline-flex items-center gap-2">
        <i class="fa-solid fa-user-plus"></i> Nuevo usuario de sucursal
      </a>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar por nombre o correo..."
               [ngModel]="search()" (ngModelChange)="onSearch($event)"
               class="eg-input pl-9 pr-3 border-transparent" />
      </div>
      <select [ngModel]="role()" (ngModelChange)="onRole($event)"
              class="eg-input border-transparent">
        <option value="">Todos los roles</option>
        <option value="SUPERADMIN">Superadmin</option>
        <option value="TENANT_ADMIN">Admin Tenant</option>
        <option value="BRANCH_MANAGER">Gerente Sucursal</option>
        <option value="SALESPERSON">Vendedor</option>
        <option value="CUSTOMER">Cliente</option>
      </select>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Usuario</th>
              <th class="px-5 py-3 font-semibold">Rol</th>
              <th class="px-5 py-3 font-semibold">Tienda · Sucursal</th>
              <th class="px-5 py-3 font-semibold">Verificado</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Cargando...</td></tr>
            } @else if (users().length === 0) {
              <tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">No hay usuarios.</td></tr>
            } @else {
              @for (u of users(); track u.id) {
                <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                  <td class="px-5 py-3">
                    <div class="font-medium">{{ u.full_name || '—' }}</div>
                    <div class="text-xs text-slate-500">{{ u.email }}</div>
                  </td>
                  <td class="px-5 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          [ngClass]="roleClass(u.role)">{{ roleLabel(u.role) }}</span>
                  </td>
                  <td class="px-5 py-3 text-slate-600">
                    {{ u.tenant_name || '—' }}@if (u.branch_name) {<span> · {{ u.branch_name }}</span>}
                  </td>
                  <td class="px-5 py-3">
                    @if (u.is_email_verified) {
                      <i class="fa-solid fa-circle-check text-emerald-600"></i>
                    } @else {
                      <i class="fa-solid fa-circle-xmark text-rose-500"></i>
                    }
                  </td>
                  <td class="px-5 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          [class.bg-emerald-100]="u.is_active" [class.text-emerald-700]="u.is_active"
                          [class.bg-rose-100]="!u.is_active"   [class.text-rose-700]="!u.is_active">
                      {{ u.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-right">
                    <div class="inline-flex items-center gap-2">
                      @if (canImpersonate(u)) {
                        <button class="text-xs font-semibold px-2.5 py-1.5 rounded-lg
                                       bg-[#1e40af] text-white hover:bg-[#1d4ed8] transition
                                       inline-flex items-center gap-1.5"
                                (click)="impersonate(u)" title="Entrar como este usuario">
                          <i class="fa-solid fa-right-to-bracket"></i> Acceder
                        </button>
                      }
                      <button class="btn-secondary text-xs" (click)="toggle(u)">
                        <i class="fa-solid fa-power-off"></i>
                        {{ u.is_active ? 'Desactivar' : 'Activar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class UsersListComponent implements OnInit {
  private admin = inject(AdminService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);
  users = signal<AdminUser[]>([]);
  loading = signal(true);
  search = signal('');
  role = signal('');
  private search$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.fetch());
    this.fetch();
  }

  fetch() {
    this.loading.set(true);
    this.admin.listUsers({ search: this.search(), role: this.role() }).subscribe({
      next: (r) => { this.users.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }
  onRole(v: string)   { this.role.set(v); this.fetch(); }

  /** No tiene sentido impersonarse a uno mismo ni a cuentas inactivas. */
  canImpersonate(u: AdminUser): boolean {
    return u.is_active && u.id !== this.auth.user()?.id;
  }

  impersonate(u: AdminUser) {
    this.admin.impersonate(u.id).subscribe({
      next: (r) => {
        this.auth.startImpersonation(r as any);
        this.router.navigate(['/app']);
      },
      error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo acceder a la cuenta.'),
    });
  }

  toggle(u: AdminUser) {
    const op = u.is_active ? this.admin.deactivateUser(u.id) : this.admin.activateUser(u.id);
    op.subscribe(() => this.fetch());
  }

  roleLabel(r: AdminUser['role']) {
    return ({ SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin', BRANCH_MANAGER: 'Gerente',
              SALESPERSON: 'Vendedor', CUSTOMER: 'Cliente' } as const)[r];
  }
  roleClass(r: AdminUser['role']) {
    return ({
      SUPERADMIN: 'bg-violet-100 text-violet-700',
      TENANT_ADMIN: 'bg-sky-100 text-sky-700',
      BRANCH_MANAGER: 'bg-emerald-100 text-emerald-700',
      SALESPERSON: 'bg-amber-100 text-amber-700',
      CUSTOMER: 'bg-slate-100 text-slate-700',
    } as const)[r];
  }
}
