import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DlxStatCardComponent } from '@shared/ui';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { AuthService } from '@core/services/auth.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { PayrollService, PayrollRun } from '@features/superadmin/services/payroll.service';

@Component({
  selector: 'dlx-payroll-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-money-check-dollar"></i>
          <span class="uppercase tracking-widest font-semibold">Recursos humanos</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Nómina de empleados</h1>
        <p class="text-slate-500 text-sm mt-1">Genera y da seguimiento a los pagos mensuales de tu equipo.</p>
      </div>
      <div class="flex gap-2">
        <a routerLink="/app/admin/payroll/reporte" class="btn-secondary text-sm"><i class="fa-solid fa-chart-column"></i> Reporte</a>
        <button class="eg-btn-primary text-sm" (click)="openGenerate()"><i class="fa-solid fa-plus"></i> Generar pagos</button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Nóminas" [value]="rows().length" icon="fa-calendar" />
      <dlx-stat-card label="Total generado" [value]="money(totalAll())" icon="fa-sack-dollar"
                     iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Pendientes" [value]="pendingCount()" icon="fa-hourglass-half"
                     iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if (rows().length === 0) {
        <div class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-money-check-dollar text-3xl mb-3"></i>
          <p>Aún no has generado nóminas. Usa "Generar pagos" para crear la del mes.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Periodo</th>
                <th class="px-4 py-3 font-semibold">Sucursal</th>
                <th class="px-4 py-3 font-semibold text-center">Empleados</th>
                <th class="px-4 py-3 font-semibold text-right">Total</th>
                <th class="px-4 py-3 font-semibold text-center">Estado</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-semibold">{{ monthName(r.month) }} {{ r.year }}</td>
                  <td class="px-4 py-2.5">{{ r.branch_name || 'Todas' }}</td>
                  <td class="px-4 py-2.5 text-center">{{ r.paid_count }}/{{ r.items_count }}</td>
                  <td class="px-4 py-2.5 text-right font-bold">{{ money(r.total_amount) }}</td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" [ngClass]="badge(r.status)">{{ label(r.status) }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <a [routerLink]="['/app/admin/payroll', r.id]" class="text-[var(--dash-primary)] font-semibold text-sm hover:underline">
                      <i class="fa-solid fa-eye"></i> Ver
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Modal generar -->
    @if (genOpen()) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" (click)="genOpen.set(false)">
        <div class="card w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold mb-1">Generar pagos del mes</h2>
          <p class="text-sm text-slate-500 mb-4">Se creará la nómina con un renglón por cada empleado activo y su sueldo. Queda <strong>pendiente</strong> hasta que registres los pagos.</p>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eg-label">Mes</label>
              <select class="eg-input" [(ngModel)]="genMonth">
                @for (m of months; track m.n) { <option [ngValue]="m.n">{{ m.label }}</option> }
              </select>
            </div>
            <div>
              <label class="eg-label">Año</label>
              <select class="eg-input" [(ngModel)]="genYear">
                @for (y of years; track y) { <option [ngValue]="y">{{ y }}</option> }
              </select>
            </div>
          </div>

          @if (!branchLocked()) {
            <div class="mt-3">
              <label class="eg-label">Sucursal</label>
              <select class="eg-input" [(ngModel)]="genBranch">
                <option [ngValue]="null">Todas (toda la tienda)</option>
                @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }} · {{ b.city }}</option> }
              </select>
            </div>
          }

          <div class="flex justify-end gap-2 mt-5">
            <button class="btn-secondary" (click)="genOpen.set(false)" [disabled]="saving()">Cancelar</button>
            <button class="eg-btn-primary" (click)="doGenerate()" [disabled]="saving()">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-check"></i> }
              Generar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PayrollListComponent implements OnInit {
  private svc = inject(PayrollService);
  private adminSvc = inject(AdminService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  rows = signal<PayrollRun[]>([]);
  loading = signal(true);
  branches = signal<AdminBranch[]>([]);

  genOpen = signal(false);
  saving = signal(false);
  genMonth = new Date().getMonth() + 1;
  genYear = new Date().getFullYear();
  genBranch: number | null = null;

  months = [
    { n: 1, label: 'Enero' }, { n: 2, label: 'Febrero' }, { n: 3, label: 'Marzo' },
    { n: 4, label: 'Abril' }, { n: 5, label: 'Mayo' }, { n: 6, label: 'Junio' },
    { n: 7, label: 'Julio' }, { n: 8, label: 'Agosto' }, { n: 9, label: 'Septiembre' },
    { n: 10, label: 'Octubre' }, { n: 11, label: 'Noviembre' }, { n: 12, label: 'Diciembre' },
  ];
  years = [this.genYear, this.genYear - 1, this.genYear - 2];

  branchLocked = computed(() => this.auth.user()?.role === 'BRANCH_MANAGER');
  totalAll = computed(() => this.rows().reduce((s, r) => s + (+r.total_amount || 0), 0));
  pendingCount = computed(() => this.rows().filter(r => r.status !== 'PAID').length);

  ngOnInit(): void {
    this.load();
    if (!this.branchLocked()) {
      this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    }
  }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: r => { this.rows.set(r.results || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openGenerate(): void {
    this.genMonth = new Date().getMonth() + 1;
    this.genYear = new Date().getFullYear();
    this.genBranch = null;
    this.genOpen.set(true);
  }

  doGenerate(): void {
    this.saving.set(true);
    this.svc.generate({ year: this.genYear, month: this.genMonth, branch: this.branchLocked() ? undefined : this.genBranch }).subscribe({
      next: () => {
        this.saving.set(false);
        this.genOpen.set(false);
        this.notify.success('Nómina generada');
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(parseApiError(e).message || 'No se pudo generar.');
      },
    });
  }

  monthName(m: number): string { return this.months.find(x => x.n === m)?.label || String(m); }
  money(v: number | string): string { return '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  label(st: string): string { return st === 'PAID' ? 'Pagada' : st === 'PARTIAL' ? 'Parcial' : 'Pendiente'; }
  badge(st: string): string {
    if (st === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (st === 'PARTIAL') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
}
