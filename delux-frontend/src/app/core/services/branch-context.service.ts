import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { PublicBranchesService, PublicBranch } from '@shared/services/public-branches.service';

const KEY = 'dlx_ctx_branch';

/**
 * Sucursal "activa" del panel. El superadmin/admin la eligen en el header para
 * ver los datos de esa sucursal; el gerente/vendedor queda fijo a la suya.
 */
@Injectable({ providedIn: 'root' })
export class BranchContextService {
  private auth = inject(AuthService);
  private branchesSvc = inject(PublicBranchesService);

  branches = signal<PublicBranch[]>([]);
  private _current = signal<number | null>(this.readStored());
  readonly current = computed(() => this._current());

  readonly canSwitch = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN';
  });

  /** Muestra el widget de sucursal solo para roles del panel (no clientes). */
  readonly showWidget = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER' || r === 'SALESPERSON';
  });

  readonly currentName = computed(() => {
    const id = this._current();
    if (id == null) return 'Todas las sucursales';
    return this.branches().find(b => b.id === id)?.name ?? 'Sucursal';
  });

  load(): void {
    const u = this.auth.user();
    if (u && (u.role === 'BRANCH_MANAGER' || u.role === 'SALESPERSON') && u.branch_id) {
      this._current.set(u.branch_id); // fijo a su sucursal
    }
    this.branchesSvc.list().subscribe({
      next: r => this.branches.set(r.results),
      error: () => {},
    });
  }

  setBranch(id: number | null): void {
    if (!this.canSwitch()) return;
    this._current.set(id);
    if (typeof localStorage !== 'undefined') {
      if (id == null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(id));
    }
  }

  private readStored(): number | null {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  }
}
