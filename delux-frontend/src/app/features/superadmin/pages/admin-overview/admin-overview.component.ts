import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '@features/superadmin/services/admin.service';
import { DlxPageHeaderComponent, DlxStatCardComponent } from '@shared/ui';

interface KpiSpec {
  label: string; value: number; icon: string;
  iconBg: string; iconColor: string;
}
interface Shortcut {
  route: string; icon: string; iconBg: string; iconColor: string;
  title: string; description: string; cta: string;
}

@Component({
  selector: 'dlx-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, DlxPageHeaderComponent, DlxStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-overview.component.html',
})
export class AdminOverviewComponent implements OnInit {
  private admin = inject(AdminService);

  tenantsCount   = signal(0);
  branchesCount  = signal(0);
  usersCount     = signal(0);
  customersCount = signal(0);
  kpis = signal<KpiSpec[]>([]);

  readonly shortcuts: Shortcut[] = [
    { route: '/app/admin/tenants', icon: 'fa-store',
      iconBg: 'bg-violet-50 dark:bg-violet-500/15',
      iconColor: 'text-violet-600 dark:text-violet-400',
      title: 'Tiendas registradas',
      description: 'Empresas y marcas que operan en Delux.',
      cta: 'Ver tiendas' },
    { route: '/app/admin/users', icon: 'fa-users',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/15',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Usuarios',
      description: 'Staff y clientes registrados en la plataforma.',
      cta: 'Ver usuarios' },
    { route: '/app/admin/settings', icon: 'fa-gear',
      iconBg: 'bg-sky-50 dark:bg-sky-500/15',
      iconColor: 'text-sky-600 dark:text-sky-400',
      title: 'Configuración',
      description: 'SMTP, reCAPTCHA, marca, subidas y pagos.',
      cta: 'Abrir configuración' },
  ];

  ngOnInit(): void {
    this.admin.listTenants().subscribe(r => { this.tenantsCount.set(r.count); this.refreshKpis(); });
    this.admin.listBranches().subscribe(r => { this.branchesCount.set(r.count); this.refreshKpis(); });
    this.admin.listUsers().subscribe(r => { this.usersCount.set(r.count); this.refreshKpis(); });
    this.admin.listUsers({ role: 'CUSTOMER' }).subscribe(r => { this.customersCount.set(r.count); this.refreshKpis(); });
    this.refreshKpis();
  }

  refreshKpis() {
    this.kpis.set([
      { label: 'Tiendas',    value: this.tenantsCount(),
        icon: 'fa-store',    iconBg: 'bg-violet-50 dark:bg-violet-500/15',
        iconColor: 'text-violet-600 dark:text-violet-400' },
      { label: 'Sucursales', value: this.branchesCount(),
        icon: 'fa-building', iconBg: 'bg-sky-50 dark:bg-sky-500/15',
        iconColor: 'text-sky-600 dark:text-sky-400' },
      { label: 'Usuarios',   value: this.usersCount(),
        icon: 'fa-users',    iconBg: 'bg-emerald-50 dark:bg-emerald-500/15',
        iconColor: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Clientes',   value: this.customersCount(),
        icon: 'fa-user-group', iconBg: 'bg-amber-50 dark:bg-amber-500/15',
        iconColor: 'text-amber-600 dark:text-amber-400' },
    ]);
  }
}
