import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReturnsService, ReturnRequest } from '@shared/services/returns.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-returns-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <i class="fa-solid fa-rotate-left"></i>
        <span class="uppercase tracking-widest font-semibold">Post-venta</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Devoluciones</h1>
      <p class="text-slate-500 text-sm mt-1">Solicitudes de devolución de los clientes.</p>
    </div>

    <div class="grid grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-amber-600 font-semibold">Solicitadas</p>
        <p class="text-2xl font-bold text-amber-600 mt-1">{{ countBy('REQUESTED') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-sky-600 font-semibold">Aprobadas</p>
        <p class="text-2xl font-bold text-sky-600 mt-1">{{ countBy('APPROVED') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">Reembolsadas</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ countBy('REFUNDED') }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-rose-600 font-semibold">Rechazadas</p>
        <p class="text-2xl font-bold text-rose-600 mt-1">{{ countBy('REJECTED') }}</p>
      </div>
    </div>

    <div class="card p-4 mb-4 flex gap-2 items-center flex-wrap">
      <select [(ngModel)]="statusFilter" (change)="reload()"
              class="px-3 py-2 rounded-lg bg-slate-50 border border-transparent text-sm">
        <option value="">Todos los estados</option>
        <option value="REQUESTED">Solicitadas</option>
        <option value="APPROVED">Aprobadas</option>
        <option value="REJECTED">Rechazadas</option>
        <option value="REFUNDED">Reembolsadas</option>
      </select>
    </div>

    <div class="space-y-3">
      @for (r of items(); track r.id) {
        <div class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
            <div>
              <p class="font-mono font-bold">{{ r.code }}</p>
              <p class="text-xs text-slate-500">Orden {{ r.order_code }} · {{ r.created_at | date:'short' }}</p>
            </div>
            <div class="text-right">
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase"
                    [ngClass]="statusBadge(r.status)">{{ r.status_label }}</span>
              <p class="text-xl font-bold mt-1">\${{ r.refund_amount }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Cliente</p>
              <p class="font-semibold">{{ r.customer_name }}</p>
              <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-2">Razón</p>
              <p>{{ r.reason_label }}</p>
              @if (r.note) { <p class="text-xs text-slate-600 mt-1">{{ r.note }}</p> }
            </div>
            <div>
              <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Artículos</p>
              <ul class="space-y-1 mt-1">
                @for (it of r.items; track it.id) {
                  <li class="text-xs">
                    <span class="font-semibold">{{ it.quantity }}×</span> {{ it.product_name }}
                    <span class="text-slate-500">({{ it.size }}/{{ it.color }})</span>
                    <span class="ml-auto float-right">\${{ it.refund_amount }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
            @if (r.status === 'REQUESTED') {
              <button (click)="approve(r)" class="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold">
                <i class="fa-solid fa-check"></i> Aprobar
              </button>
              <button (click)="reject(r)" class="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold">
                <i class="fa-solid fa-xmark"></i> Rechazar
              </button>
            }
            @if (r.status === 'APPROVED') {
              <button (click)="refund(r)" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold">
                <i class="fa-solid fa-dollar-sign"></i> Reembolsar y devolver stock
              </button>
            }
          </div>
        </div>
      }
      @if (items().length === 0) {
        <div class="card p-12 text-center text-slate-400">
          <i class="fa-solid fa-rotate-left text-3xl mb-3"></i>
          <p>No hay solicitudes de devolución.</p>
        </div>
      }
    </div>
  `,
})
export class ReturnsListComponent implements OnInit {
  private svc = inject(ReturnsService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  items = signal<ReturnRequest[]>([]);
  statusFilter = '';

  ngOnInit() { this.reload(); }
  reload() { this.svc.list({ status: this.statusFilter }).subscribe(r => this.items.set(r.results)); }

  countBy(s: string) { return this.items().filter(r => r.status === s).length; }
  statusBadge(s: string) {
    return ({
      REQUESTED: 'bg-amber-100 text-amber-700',
      APPROVED: 'bg-sky-100 text-sky-700',
      REJECTED: 'bg-rose-100 text-rose-700',
      REFUNDED: 'bg-emerald-100 text-emerald-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }
  approve(r: ReturnRequest) { this.svc.approve(r.id).subscribe(() => this.reload()); }
  reject(r: ReturnRequest) { this.svc.reject(r.id).subscribe(() => this.reload()); }
  async refund(r: ReturnRequest) {
    const ok = await this.confirm.ask({
      title: 'Reembolsar devolución',
      message: `¿Reembolsar ${r.code} y devolver el stock al inventario?`,
      variant: 'warning', confirmText: 'Reembolsar',
    });
    if (!ok) return;
    this.svc.refund(r.id).subscribe({
      next: () => { this.notify.success('Devolución reembolsada'); this.reload(); },
      error: e => this.notify.fromServerError(e, 'No se pudo reembolsar.'),
    });
  }
}
