import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AdminBranchCatalogItem, AdminBranch } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-branch-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      @if (branch()) {
        <a [routerLink]="['/app/admin/tenants', branch()!.tenant_slug, 'branches']"
           class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink-900 mb-2">
          <i class="fa-solid fa-arrow-left text-xs"></i> Sucursales
        </a>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">
          {{ branch()!.name }} — Catálogo
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          {{ count() }} producto(s) con stock disponible en esta sucursal.
        </p>
      }
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Producto</th>
              <th class="px-5 py-3 font-semibold">Marca</th>
              <th class="px-5 py-3 font-semibold">Categoría</th>
              <th class="px-5 py-3 font-semibold text-right">Precio</th>
              <th class="px-5 py-3 font-semibold text-right">Stock</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Cargando catálogo...</td></tr>
            } @else if (items().length === 0) {
              <tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">
                <i class="fa-solid fa-box text-2xl opacity-50 mb-2"></i>
                <p>Sin productos con stock en esta sucursal.</p>
              </td></tr>
            } @else {
              @for (p of items(); track p.id) {
                <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                  <td class="px-5 py-3 font-medium">{{ p.name }}</td>
                  <td class="px-5 py-3 text-slate-600">{{ p.brand_name }}</td>
                  <td class="px-5 py-3 text-slate-600">{{ p.category_name }}</td>
                  <td class="px-5 py-3 text-right font-semibold">\${{ p.base_price }}</td>
                  <td class="px-5 py-3 text-right">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          [class.bg-emerald-100]="p.branch_stock > 5"
                          [class.text-emerald-700]="p.branch_stock > 5"
                          [class.bg-amber-100]="p.branch_stock > 0 && p.branch_stock <= 5"
                          [class.text-amber-700]="p.branch_stock > 0 && p.branch_stock <= 5"
                          [class.bg-rose-100]="p.branch_stock === 0"
                          [class.text-rose-700]="p.branch_stock === 0">
                      {{ p.branch_stock }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-slate-600">{{ p.status }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class BranchCatalogComponent implements OnInit {
  id = input.required<number, string>({ transform: (v: string) => parseInt(v, 10) });
  private admin = inject(AdminService);
  branch = signal<AdminBranch | null>(null);
  items = signal<AdminBranchCatalogItem[]>([]);
  count = signal(0);
  loading = signal(true);

  ngOnInit(): void {
    this.admin.branchCatalog(this.id()).subscribe({
      next: (r) => {
        this.branch.set(r.branch);
        this.items.set(r.results);
        this.count.set(r.count);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
