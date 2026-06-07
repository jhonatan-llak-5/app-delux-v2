import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Customer, CustomerService } from '@features/superadmin/services/customer.service';
import { CustomerFormModalComponent } from '@features/superadmin/components/customer-form-modal/customer-form-modal.component';

@Component({
  selector: 'dlx-customers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomerFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-user-group"></i>
          <span class="uppercase tracking-widest font-semibold">CRM</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Clientes</h1>
        <p class="text-slate-500 text-sm mt-1">Base de datos completa con historial de compras.</p>
      </div>
      <button (click)="openCreate()"
              class="px-4 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-900 flex items-center gap-2">
        <i class="fa-solid fa-user-plus"></i> Nuevo cliente
      </button>
    </div>

    @if (summary()) {
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total</p>
          <p class="text-2xl font-bold mt-1">{{ summary()!.total_customers }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">Con compras</p>
          <p class="text-2xl font-bold text-emerald-600 mt-1">{{ summary()!.with_purchases }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs uppercase tracking-widest text-violet-600 font-semibold">Suscritos marketing</p>
          <p class="text-2xl font-bold text-violet-600 mt-1">{{ summary()!.marketing_subscribers }}</p>
        </div>
      </div>
    }

    <div class="card p-4 mb-4">
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input placeholder="Buscar por nombre, email, teléfono, cédula..."
               [ngModel]="search()" (ngModelChange)="onSearch($event)"
               class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-slate-300 focus:outline-none text-sm" />
      </div>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>
      } @else if (customers().length === 0) {
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-user-group text-3xl mb-3"></i>
          <p>Aún no hay clientes registrados.</p>
        </div>
      } @else {
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Cliente</th>
              <th class="px-5 py-3 font-semibold">Contacto</th>
              <th class="px-5 py-3 font-semibold text-center">Órdenes</th>
              <th class="px-5 py-3 font-semibold text-right">Total gastado</th>
              <th class="px-5 py-3 font-semibold">Última compra</th>
              <th class="px-5 py-3 font-semibold text-center">Marketing</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (c of customers(); track c.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-xs"
                         [style.background]="avatarColor(c)">
                      {{ initials(c.full_name) }}
                    </div>
                    <div>
                      <p class="font-medium">{{ c.full_name }}</p>
                      @if (c.document_id) { <p class="text-[11px] text-slate-500 font-mono">{{ c.document_id }}</p> }
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3">
                  <p class="text-xs">{{ c.email }}</p>
                  @if (c.phone) { <p class="text-[11px] text-slate-500">{{ c.phone }}</p> }
                </td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        [class.bg-emerald-100]="c.total_orders > 0"
                        [class.text-emerald-700]="c.total_orders > 0"
                        [class.bg-slate-100]="c.total_orders === 0"
                        [class.text-slate-500]="c.total_orders === 0">
                    {{ c.total_orders }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right font-bold">\${{ (+(c.total_spent || 0)).toFixed(2) }}</td>
                <td class="px-5 py-3 text-xs text-slate-600">
                  {{ c.last_order_at ? (c.last_order_at | date:'mediumDate') : '—' }}
                </td>
                <td class="px-5 py-3 text-center">
                  @if (c.accepts_marketing) {
                    <i class="fa-solid fa-circle-check text-emerald-600"></i>
                  } @else {
                    <i class="fa-solid fa-minus text-slate-300"></i>
                  }
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="inline-flex gap-1">
                    <a [routerLink]="['/app/admin/customers', c.id]" title="Ver detalle"
                       class="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500">
                      <i class="fa-solid fa-eye text-xs"></i>
                    </a>
                    <button (click)="openEdit(c)" title="Editar"
                            class="w-8 h-8 grid place-items-center rounded-lg hover:bg-sky-100 hover:text-sky-700 text-slate-500">
                      <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button (click)="remove(c)" title="Eliminar"
                            class="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose-100 hover:text-rose-700 text-slate-500">
                      <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (showModal()) {
      <dlx-customer-form-modal [customer]="editing()"
                                (close)="closeModal()" (saved)="onSaved()" />
    }
  `,
})
export class CustomersListComponent implements OnInit {
  private svc = inject(CustomerService);

  customers = signal<Customer[]>([]);
  summary = signal<{ total_customers: number; with_purchases: number; marketing_subscribers: number } | null>(null);
  loading = signal(true);
  search = signal('');
  private search$ = new Subject<void>();
  showModal = signal(false);
  editing = signal<Customer | null>(null);

  ngOnInit() {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.svc.summary().subscribe(s => this.summary.set(s));
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.svc.list({ search: this.search() || undefined }).subscribe({
      next: r => { this.customers.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.search$.next(); }

  initials(n: string) { return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'; }
  avatarColor(c: Customer) {
    const palette = ['#7c3aed', '#22d3ee', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'];
    return palette[c.id % palette.length];
  }

  openCreate() { this.editing.set(null); this.showModal.set(true); }
  openEdit(c: Customer) { this.editing.set(c); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editing.set(null); }
  onSaved() { this.closeModal(); this.reload(); }

  remove(c: Customer) {
    if (!confirm(`¿Eliminar a ${c.full_name}?`)) return;
    this.svc.delete(c.id).subscribe(() => this.reload());
  }
}
