import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '@features/superadmin/services/admin.service';
import { UiKpiCardComponent } from '@shared/components/ui-kpi-card/ui-kpi-card.component';

@Component({
  selector: 'dlx-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, UiKpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between mb-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Panel de Superadmin</h1>
        <p class="text-slate-500 text-sm mt-1">Visión global de la plataforma multi-tenant.</p>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <dlx-ui-kpi-card label="Tiendas"    [value]="tenantsCount() + ''"   icon="fa-store"
                       iconBg="bg-violet-100 text-violet-600" />
      <dlx-ui-kpi-card label="Sucursales" [value]="branchesCount() + ''"  icon="fa-building"
                       iconBg="bg-sky-100 text-sky-600" />
      <dlx-ui-kpi-card label="Usuarios"   [value]="usersCount() + ''"     icon="fa-users"
                       iconBg="bg-emerald-100 text-emerald-600" />
      <dlx-ui-kpi-card label="Clientes"   [value]="customersCount() + ''" icon="fa-user-group"
                       iconBg="bg-amber-100 text-amber-600" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <a routerLink="/app/admin/tenants" class="card p-5 hover:shadow-md transition group">
        <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 grid place-items-center mb-3">
          <i class="fa-solid fa-store"></i>
        </div>
        <h3 class="font-semibold">Tiendas registradas</h3>
        <p class="text-sm text-slate-500 mt-1">Empresas/marcas que operan en Delux.</p>
        <span class="text-sm text-ink-900 font-semibold mt-3 inline-block group-hover:underline">Ver tiendas →</span>
      </a>

      <a routerLink="/app/admin/users" class="card p-5 hover:shadow-md transition group">
        <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 grid place-items-center mb-3">
          <i class="fa-solid fa-users"></i>
        </div>
        <h3 class="font-semibold">Usuarios</h3>
        <p class="text-sm text-slate-500 mt-1">Staff y clientes registrados.</p>
        <span class="text-sm text-ink-900 font-semibold mt-3 inline-block group-hover:underline">Ver usuarios →</span>
      </a>

      <a routerLink="/app/admin/settings" class="card p-5 hover:shadow-md transition group">
        <div class="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 grid place-items-center mb-3">
          <i class="fa-solid fa-gear"></i>
        </div>
        <h3 class="font-semibold">Configuración</h3>
        <p class="text-sm text-slate-500 mt-1">SMTP, remitente, branding y expiraciones.</p>
        <span class="text-sm text-ink-900 font-semibold mt-3 inline-block group-hover:underline">Abrir configuración →</span>
      </a>
    </div>
  `,
})
export class AdminOverviewComponent implements OnInit {
  private admin = inject(AdminService);
  tenantsCount   = signal(0);
  branchesCount  = signal(0);
  usersCount     = signal(0);
  customersCount = signal(0);

  ngOnInit(): void {
    this.admin.listTenants().subscribe(r => this.tenantsCount.set(r.count));
    this.admin.listBranches().subscribe(r => this.branchesCount.set(r.count));
    this.admin.listUsers().subscribe(r => this.usersCount.set(r.count));
    this.admin.listUsers({ role: 'CUSTOMER' }).subscribe(r => this.customersCount.set(r.count));
  }
}
