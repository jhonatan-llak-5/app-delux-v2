import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AdminBranch, AdminTenant } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-tenant-branches',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <a routerLink="/app/admin/tenants"
         class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink-900 mb-2">
        <i class="fa-solid fa-arrow-left text-xs"></i> Tiendas
      </a>
      @if (tenant()) {
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">{{ tenant()!.name }} — Sucursales</h1>
        <p class="text-slate-500 text-sm mt-1">
          {{ tenant()!.branches_count }} sucursal(es) · cada una con su propio catálogo y stock.
        </p>
      }
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @if (loading()) {
        <div class="card p-6 text-slate-400 col-span-full">Cargando sucursales...</div>
      } @else if (branches().length === 0) {
        <div class="card p-6 text-slate-400 col-span-full">Esta tienda aún no tiene sucursales.</div>
      } @else {
        @for (b of branches(); track b.id) {
          <a [routerLink]="['/app/admin/branches', b.id, 'catalog']"
             class="card p-5 hover:shadow-md transition group relative">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-[10px] tracking-widest uppercase text-slate-400 font-semibold">{{ b.code }}</p>
                <h3 class="text-lg font-semibold mt-0.5">{{ b.name }}</h3>
                <p class="text-sm text-slate-500">{{ b.city }}</p>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    [class.bg-emerald-100]="b.is_active" [class.text-emerald-700]="b.is_active"
                    [class.bg-rose-100]="!b.is_active"   [class.text-rose-700]="!b.is_active">
                {{ b.is_active ? 'Activa' : 'Inactiva' }}
              </span>
            </div>

            <div class="mt-5 space-y-2 text-sm text-slate-600">
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
                <span class="text-slate-500">producto(s) con stock</span>
              </div>
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-ink-900 group-hover:underline">
                Ver catálogo
                <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              </span>
            </div>
          </a>
        }
      }
    </div>
  `,
})
export class TenantBranchesComponent implements OnInit {
  slug = input.required<string>();
  private admin = inject(AdminService);
  tenant = signal<AdminTenant | null>(null);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.admin.getTenant(this.slug()).subscribe(t => this.tenant.set(t));
    this.admin.listBranches(this.slug()).subscribe({
      next: (r) => { this.branches.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
