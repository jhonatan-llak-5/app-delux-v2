import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService, AdminUser } from '@features/superadmin/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';
import { debounceTime, Subject } from 'rxjs';
import { parseApiError } from '@shared/utils/api-error.util';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';

type Scope = 'system' | 'clients' | 'all';

@Component({
  selector: 'dlx-users-list',
  standalone: true,
  imports: [DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, DlxModalComponent, RowActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ ui().title }}</h1>
        <p class="text-slate-500 text-sm mt-1">{{ ui().subtitle }}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        @if (scope() !== 'clients') {
          <a routerLink="/app/admin/staff/new"
             class="px-4 py-2.5 rounded-lg bg-[var(--dash-primary)] text-white text-sm font-semibold
                    hover:bg-[var(--dash-primary-d)] transition inline-flex items-center gap-2">
            <i class="fa-solid fa-user-plus"></i> Nuevo usuario de sucursal
          </a>
        }
      </div>
    </div>

    <div class="card p-4 mb-4 flex flex-wrap gap-3 items-center filter-bar">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar por nombre o correo..." class="flex-1 min-w-64" />
      @if (scope() !== 'clients') {
        <select [ngModel]="role()" (ngModelChange)="onRole($event)"
                class="eg-input border-transparent">
          <option value="">Todos los roles</option>
          <option value="SUPERADMIN">Superadmin</option>
          <option value="TENANT_ADMIN">Admin Tenant</option>
          <option value="BRANCH_MANAGER">Gerente Sucursal</option>
          <option value="SALESPERSON">Vendedor</option>
          <option value="AFFILIATE">Afiliado</option>
          @if (scope() === 'all') { <option value="CUSTOMER">Cliente</option> }
        </select>
      }
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
                    <dlx-row-actions [actions]="rowActions(u)" />
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing(); as ed) {
      <dlx-modal [open]="true" [maxWidth]="480" title="Editar usuario" (closed)="closeEdit()">
          <p class="text-xs text-slate-500 mb-4">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full font-semibold"
                  [ngClass]="roleClass(ed.role)">{{ roleLabel(ed.role) }}</span>
            <span class="ml-1">El rol no se puede cambiar desde aquí.</span>
          </p>

          <label class="block text-sm font-medium mb-1">Correo <span class="text-rose-500">*</span></label>
          <input type="email" autocomplete="off" [(ngModel)]="form.email" class="eg-input w-full" />
          @if (fieldErrors()['email']) { <p class="text-rose-600 text-xs mt-1">{{ fieldErrors()['email'] }}</p> }

          <label class="block text-sm font-medium mb-1 mt-3">Nombre completo</label>
          <input [(ngModel)]="form.full_name" class="eg-input w-full" />
          @if (fieldErrors()['full_name']) { <p class="text-rose-600 text-xs mt-1">{{ fieldErrors()['full_name'] }}</p> }

          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="block text-sm font-medium mb-1">Teléfono</label>
              <input [(ngModel)]="form.phone" class="eg-input w-full" />
              @if (fieldErrors()['phone']) { <p class="text-rose-600 text-xs mt-1">{{ fieldErrors()['phone'] }}</p> }
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Documento</label>
              <input [(ngModel)]="form.document_id" class="eg-input w-full" />
              @if (fieldErrors()['document_id']) { <p class="text-rose-600 text-xs mt-1">{{ fieldErrors()['document_id'] }}</p> }
            </div>
          </div>

          <label class="block text-sm font-medium mb-1 mt-3">Nueva contraseña</label>
          <input type="password" autocomplete="new-password" [(ngModel)]="form.password"
                 placeholder="Déjalo vacío para no cambiarla" class="eg-input w-full" />
          <p class="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres. Solo se cambia si escribes algo.</p>
          @if (fieldErrors()['password']) { <p class="text-rose-600 text-xs mt-1">{{ fieldErrors()['password'] }}</p> }

          @if (formError()) { <p class="text-rose-600 text-sm mt-3">{{ formError() }}</p> }

          <div class="flex justify-end gap-2 mt-6">
            <button class="btn-secondary text-sm" (click)="closeEdit()" [disabled]="saving()">Cancelar</button>
            <button class="px-4 py-2 rounded-lg bg-[var(--dash-primary)] text-white text-sm font-semibold
                           hover:bg-[var(--dash-primary-d)] transition disabled:opacity-60"
                    (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
      </dlx-modal>
    }
  `,
})
export class UsersListComponent implements OnInit {
  /** Clasificación: 'system' (equipo interno), 'clients' (rol Cliente) o 'all'. */
  scope = input<Scope>('all');

  private admin = inject(AdminService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);
  users = signal<AdminUser[]>([]);
  loading = signal(true);
  search = signal('');
  role = signal('');
  private search$ = new Subject<void>();

  // Edición
  editing = signal<AdminUser | null>(null);
  saving = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);
  form = { email: '', full_name: '', phone: '', document_id: '', password: '' };

  ui = computed(() => {
    switch (this.scope()) {
      case 'clients':
        return {
          title: 'Clientes', subtitle: 'Cuentas registradas con rol Cliente en la plataforma.',
          advancedLabel: 'Ver CRM y compras', advancedRoute: '/app/admin/customers',
        };
      case 'system':
        return {
          title: 'Usuarios del sistema',
          subtitle: 'Equipo interno: administradores, gerentes y vendedores.',
          advancedLabel: 'Gestión de personal (comisiones)', advancedRoute: '/app/admin/staff',
        };
      default:
        return {
          title: 'Usuarios', subtitle: 'Staff y clientes registrados en la plataforma.',
          advancedLabel: 'Equipo', advancedRoute: '/app/admin/staff',
        };
    }
  });

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.fetch());
    this.fetch();
  }

  fetch() {
    this.loading.set(true);
    const sc = this.scope();
    const kind = sc === 'clients' ? 'clients' : sc === 'system' ? 'system' : undefined;
    this.admin.listUsers({ search: this.search(), role: this.role(), kind }).subscribe({
      next: (r) => { this.users.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }
  onRole(v: string)   { this.role.set(v); this.fetch(); }

  /** No tiene sentido impersonarse a uno mismo ni a cuentas inactivas. */
  canImpersonate(u: AdminUser): boolean {
    return this.auth.user()?.role === 'SUPERADMIN' && u.is_active && u.id !== this.auth.user()?.id;
  }

  rowActions(u: AdminUser): RowAction[] {
    const edit: RowAction = (this.scope() === 'system' && u.role !== 'SUPERADMIN')
      ? { label: 'Editar', icon: 'fa-pen', link: ['/app/admin/staff', u.id] }
      : { label: 'Editar', icon: 'fa-pen', run: () => this.openEdit(u) };
    return [
      { label: 'Acceder', icon: 'fa-right-to-bracket', variant: 'primary',
        hidden: !this.canImpersonate(u), run: () => this.impersonate(u) },
      edit,
      { label: u.is_active ? 'Desactivar' : 'Activar', icon: 'fa-power-off',
        variant: u.is_active ? 'danger' : 'default', run: () => this.toggle(u) },
    ];
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

  openEdit(u: AdminUser) {
    this.editing.set(u);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.form = {
      email: u.email || '',
      full_name: u.full_name || '',
      phone: u.phone || '',
      document_id: u.document_id || '',
      password: '',
    };
  }

  closeEdit() { this.editing.set(null); }

  save() {
    const u = this.editing();
    if (!u) return;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    const payload: { email: string; full_name: string; phone: string; document_id: string; password?: string } = {
      email: this.form.email.trim(),
      full_name: this.form.full_name.trim(),
      phone: this.form.phone.trim(),
      document_id: this.form.document_id.trim(),
    };
    if (this.form.password) payload.password = this.form.password;
    this.admin.updateUser(u.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Usuario actualizado');
        this.closeEdit();
        this.fetch();
      },
      error: (e) => {
        this.saving.set(false);
        const { fieldErrors, message } = parseApiError(e);
        this.fieldErrors.set(fieldErrors);
        this.formError.set(Object.keys(fieldErrors).length ? null : (message || 'No se pudo guardar.'));
      },
    });
  }

  roleLabel(r: AdminUser['role']) {
    return ({ SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin', BRANCH_MANAGER: 'Gerente',
              SALESPERSON: 'Vendedor', AFFILIATE: 'Afiliado', CUSTOMER: 'Cliente' } as const)[r];
  }
  roleClass(r: AdminUser['role']) {
    return ({
      SUPERADMIN: 'bg-violet-100 text-violet-700',
      TENANT_ADMIN: 'bg-sky-100 text-sky-700',
      BRANCH_MANAGER: 'bg-emerald-100 text-emerald-700',
      SALESPERSON: 'bg-amber-100 text-amber-700',
      AFFILIATE: 'bg-blue-100 text-blue-700',
      CUSTOMER: 'bg-slate-100 text-slate-700',
    } as const)[r];
  }
}
