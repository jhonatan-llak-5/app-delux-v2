import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AdminTenant } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-tenants-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between mb-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Tiendas registradas</h1>
        <p class="text-slate-500 text-sm mt-1">Empresas que operan sobre la plataforma.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @if (loading()) {
        <div class="card p-6 text-slate-400 col-span-full">Cargando tiendas...</div>
      } @else if (tenants().length === 0) {
        <div class="card p-6 text-slate-400 col-span-full">Sin tiendas registradas.</div>
      } @else {
        @for (t of tenants(); track t.id) {
          <a [routerLink]="['/app/admin/tenants', t.slug, 'branches']"
             class="card p-5 hover:shadow-md transition group relative">
            <div class="flex items-start justify-between">
              <div class="w-12 h-12 rounded-xl grid place-items-center text-white font-display font-bold text-xl"
                   [style.background]="'linear-gradient(135deg,' + t.primary_color + ',' + t.accent_color + ')'">
                {{ t.name[0] }}
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    [class.bg-emerald-100]="t.is_active" [class.text-emerald-700]="t.is_active"
                    [class.bg-rose-100]="!t.is_active"   [class.text-rose-700]="!t.is_active">
                {{ t.is_active ? 'Activa' : 'Inactiva' }}
              </span>
            </div>

            <h3 class="mt-4 text-lg font-semibold">{{ t.name }}</h3>
            <p class="text-xs text-slate-500 font-mono">/{{ t.slug }} · {{ t.legal_id || '—' }}</p>

            <div class="grid grid-cols-2 gap-3 mt-5">
              <div class="rounded-lg bg-slate-50 p-3">
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <i class="fa-solid fa-building text-xs"></i> Sucursales
                </div>
                <div class="text-lg font-bold mt-1">{{ t.branches_count }}</div>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <i class="fa-solid fa-users text-xs"></i> Usuarios
                </div>
                <div class="text-lg font-bold mt-1">{{ t.users_count }}</div>
              </div>
            </div>

            <div class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 group-hover:bg-ink-900 group-hover:text-white grid place-items-center transition">
              <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </div>
          </a>
        }
      }
    </div>
  `,
})
export class TenantsListComponent implements OnInit {
  private admin = inject(AdminService);
  tenants = signal<AdminTenant[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.admin.listTenants().subscribe({
      next: (r) => { this.tenants.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
