import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DlxStatCardComponent } from '@shared/ui';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { PayrollService, PayrollRunDetail, PayrollItem } from '@features/superadmin/services/payroll.service';

@Component({
  selector: 'dlx-payroll-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, DlxStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (d(); as r) {
      <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <a routerLink="/app/admin/payroll" class="text-xs text-slate-500 hover:underline"><i class="fa-solid fa-arrow-left"></i> Nómina</a>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight mt-1">{{ monthName(r.month) }} {{ r.year }}</h1>
          <p class="text-slate-500 text-sm mt-1">{{ r.branch_name || 'Toda la tienda' }} · generada por {{ r.generated_by_name || '—' }}</p>
        </div>
        <div class="flex items-center gap-2 self-center">
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold" [ngClass]="badge(r.status)">{{ label(r.status) }}</span>
          <button class="btn-secondary text-sm" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
          @if (pendingCount(r) > 0) {
            <button class="eg-btn-primary text-sm" (click)="askPayAll()"><i class="fa-solid fa-money-bill-wave"></i> Pagar todos</button>
          }
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <dlx-stat-card label="Total nómina" [value]="money(r.total_amount)" icon="fa-sack-dollar"
                       iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
        <dlx-stat-card label="Empleados" [value]="r.items_count" icon="fa-users"
                       iconBg="bg-violet-50 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" />
        <dlx-stat-card label="Pagados" [value]="r.paid_count" icon="fa-circle-check" />
        <dlx-stat-card label="Pendientes" [value]="pendingCount(r)" icon="fa-hourglass-half"
                       iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
      </div>

      <div class="card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <h2 class="font-bold tracking-tight">Detalle de pagos</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Empleado</th>
                <th class="px-4 py-3 font-semibold">Rol</th>
                <th class="px-4 py-3 font-semibold text-right">Sueldo</th>
                <th class="px-4 py-3 font-semibold text-center">Estado</th>
                <th class="px-4 py-3 font-semibold">Método</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (it of r.items; track it.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-semibold">{{ it.employee_name }}</td>
                  <td class="px-4 py-2.5 text-slate-500">{{ roleLabel(it.role) }}</td>
                  <td class="px-4 py-2.5 text-right font-bold">{{ money(it.amount) }}</td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          [ngClass]="it.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">
                      {{ it.status === 'PAID' ? 'Pagado' : 'Pendiente' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-slate-500">
                    @if (it.status === 'PAID') { {{ it.method === 'CASH' ? 'Efectivo' : it.method === 'TRANSFER' ? 'Transferencia' : '—' }} <span class="text-xs text-slate-400">{{ it.paid_at ? ('· ' + (it.paid_at | date:'dd/MM/yy')) : '' }}</span> }
                    @else { — }
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    @if (it.status === 'PAID') {
                      <button class="text-slate-400 hover:text-rose-600 text-xs font-semibold" (click)="unpay(it)"><i class="fa-solid fa-rotate-left"></i> Revertir</button>
                    } @else {
                      <button class="eg-btn-primary text-xs" (click)="askPay(it)"><i class="fa-solid fa-check"></i> Pagar</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal de pago -->
      @if (payOpen()) {
        <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" (click)="payOpen.set(false)">
          <div class="card w-full max-w-sm p-6" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-bold mb-1">{{ payTarget() ? 'Registrar pago' : 'Pagar todos los pendientes' }}</h2>
            <p class="text-sm text-slate-500 mb-4">
              @if (payTarget(); as t) { Pago a <strong>{{ t.employee_name }}</strong> por <strong>{{ money(t.amount) }}</strong>. }
              @else { Se marcarán como pagados los {{ pendingCount(r) }} empleados pendientes. }
            </p>
            <label class="eg-label">Método</label>
            <select class="eg-input mb-3" [(ngModel)]="payMethod">
              <option value="CASH">Efectivo</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
            @if (payTarget()) {
              <label class="eg-label">Nota (opcional)</label>
              <input class="eg-input mb-4" [(ngModel)]="payNote" maxlength="200" placeholder="Referencia u observación…" />
            }
            <div class="flex justify-end gap-2 mt-2">
              <button class="btn-secondary" (click)="payOpen.set(false)" [disabled]="saving()">Cancelar</button>
              <button class="eg-btn-primary" (click)="confirmPay()" [disabled]="saving()">
                @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-check"></i> } Confirmar
              </button>
            </div>
          </div>
        </div>
      }
    } @else if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    }
  `,
})
export class PayrollDetailComponent implements OnInit {
  private svc = inject(PayrollService);
  private route = inject(ActivatedRoute);
  private notify = inject(NotifyService);

  d = signal<PayrollRunDetail | null>(null);
  loading = signal(true);
  runId = 0;

  payOpen = signal(false);
  payTarget = signal<PayrollItem | null>(null);
  payMethod = 'CASH';
  payNote = '';
  saving = signal(false);

  private months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  ngOnInit(): void {
    this.runId = +this.route.snapshot.paramMap.get('id')!;
    this.reload();
  }

  reload(): void {
    this.svc.get(this.runId).subscribe({
      next: r => { this.d.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  pendingCount(r: PayrollRunDetail): number { return r.items.filter(i => i.status !== 'PAID').length; }

  askPay(it: PayrollItem): void { this.payTarget.set(it); this.payMethod = 'CASH'; this.payNote = ''; this.payOpen.set(true); }
  askPayAll(): void { this.payTarget.set(null); this.payMethod = 'CASH'; this.payOpen.set(true); }

  confirmPay(): void {
    this.saving.set(true);
    const done = (r: PayrollRunDetail) => { this.d.set(r); this.saving.set(false); this.payOpen.set(false); this.notify.success('Pago registrado'); };
    const err = (e: any) => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo registrar.'); };
    const t = this.payTarget();
    if (t) this.svc.payItem(this.runId, t.id, this.payMethod, this.payNote).subscribe({ next: done, error: err });
    else this.svc.payAll(this.runId, this.payMethod).subscribe({ next: done, error: err });
  }

  unpay(it: PayrollItem): void {
    this.svc.unpayItem(this.runId, it.id).subscribe({
      next: r => { this.d.set(r); this.notify.success('Pago revertido'); },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo revertir.'),
    });
  }

  exportPdf(): void {
    const r = this.d();
    if (!r) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Comprobante de nómina', 14, 18);
    doc.setFontSize(11); doc.setTextColor(60);
    doc.text(`${this.monthName(r.month)} ${r.year} · ${r.branch_name || 'Toda la tienda'}`, 14, 26);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Estado: ${this.label(r.status)}  ·  Empleados: ${r.items_count}  ·  Pagados: ${r.paid_count}  ·  Total: ${this.money(r.total_amount)}`, 14, 33);
    autoTable(doc, {
      startY: 39,
      head: [['Empleado', 'Rol', 'Sueldo', 'Estado', 'Método', 'Fecha']],
      body: r.items.map(it => [
        it.employee_name, this.roleLabel(it.role), this.money(it.amount),
        it.status === 'PAID' ? 'Pagado' : 'Pendiente',
        it.status === 'PAID' ? (it.method === 'CASH' ? 'Efectivo' : it.method === 'TRANSFER' ? 'Transferencia' : '—') : '—',
        it.paid_at ? new Date(it.paid_at).toLocaleDateString('es-EC') : '—',
      ]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] },
      foot: [['', '', this.money(r.total_amount), '', '', '']],
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    });
    doc.save(`nomina-${r.year}-${String(r.month).padStart(2, '0')}.pdf`);
  }

  monthName(m: number): string { return this.months[m - 1] || String(m); }
  roleLabel(r: string): string {
    return ({ SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin', BRANCH_MANAGER: 'Gerente', SALESPERSON: 'Vendedor' } as Record<string, string>)[r] || r;
  }
  money(v: number | string): string { return '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  label(st: string): string { return st === 'PAID' ? 'Pagada' : st === 'PARTIAL' ? 'Parcial' : 'Pendiente'; }
  badge(st: string): string {
    if (st === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (st === 'PARTIAL') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
}
