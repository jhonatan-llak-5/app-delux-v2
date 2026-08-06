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
  templateUrl: './users-list.component.html',
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
    return ({ SUPERADMIN: 'Superadmin', BRANCH_MANAGER: 'Gerente',
              SALESPERSON: 'Vendedor', WAREHOUSE: 'Bodeguero', AFFILIATE: 'Afiliado', CUSTOMER: 'Cliente' } as const)[r];
  }
  roleClass(r: AdminUser['role']) {
    return ({
      SUPERADMIN: 'bg-violet-100 text-violet-700',
      BRANCH_MANAGER: 'bg-emerald-100 text-emerald-700',
      SALESPERSON: 'bg-amber-100 text-amber-700',
      WAREHOUSE: 'bg-teal-100 text-teal-700',
      AFFILIATE: 'bg-blue-100 text-blue-700',
      CUSTOMER: 'bg-slate-100 text-slate-700',
    } as const)[r];
  }
}
