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
             class="card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl grid place-items-center text-white font-bold text-lg shrink-0"
                   [style.background]="'linear-gradient(135deg,' + t.primary_color + ',' + t.accent_color + ')'">
                {{ t.name[0] }}
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-bold truncate">{{ t.name }}</h3>
              </div>
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                    [ngClass]="t.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'">
                <span class="w-1.5 h-1.5 rounded-full" [ngClass]="t.is_active ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                {{ t.is_active ? 'Activa' : 'Inactiva' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-5">
              <div class="flex items-center gap-2.5 rounded-xl border border-slate-100 dark:border-white/10 p-3">
                <span class="grid place-items-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0"><i class="fa-solid fa-store"></i></span>
                <div>
                  <p class="text-lg font-bold leading-none">{{ t.branches_count }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Sucursales</p>
                </div>
              </div>
              <div class="flex items-center gap-2.5 rounded-xl border border-slate-100 dark:border-white/10 p-3">
                <span class="grid place-items-center w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0"><i class="fa-solid fa-users"></i></span>
                <div>
                  <p class="text-lg font-bold leading-none">{{ t.users_count }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Usuarios</p>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <span class="text-xs text-slate-400 font-mono truncate">{{ t.legal_id || 'Sin RUC' }}</span>
              <span class="text-xs font-semibold text-[var(--dash-primary)] inline-flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
                Ver sucursales <i class="fa-solid fa-arrow-right text-[10px]"></i>
              </span>
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
