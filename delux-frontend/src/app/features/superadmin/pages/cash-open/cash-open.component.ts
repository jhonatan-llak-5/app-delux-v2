import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import {
  CashCountLine, DlxCashCountComponent, DlxModalComponent, DlxPageHeaderComponent,
  DlxStep, DlxStepperComponent, emptyCashCount,
} from '@shared/ui';
import { CashRegister, CashService, CashSession } from '@features/superadmin/services/cash.service';

@Component({
  selector: 'dlx-cash-open',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxPageHeaderComponent,
            DlxStepperComponent, DlxCashCountComponent, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-open.component.html',
})
export class CashOpenComponent implements OnInit {
  private cash = inject(CashService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  branchCtx = inject(BranchContextService);

  readonly steps: DlxStep[] = [
    { key: 'info', label: 'Información' },
    { key: 'fondo', label: 'Fondo inicial' },
    { key: 'confirm', label: 'Confirmación' },
  ];
  step = signal(0);

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  /** Turno ya abierto: no se puede abrir otro hasta cerrarlo. */
  openSession = signal<CashSession | null>(null);
  registers = signal<CashRegister[]>([]);

  branchId = signal<number | null>(null);
  registerId = signal<number | null>(null);
  note = '';
  lines = signal<CashCountLine[]>(emptyCashCount());
  total = signal(0);

  userName = computed(() => this.auth.user()?.full_name || this.auth.user()?.email || 'Usuario');
  /** Solo el superadmin elige sucursal; el resto abre la caja de la suya. */
  canPickBranch = computed(() => this.auth.user()?.role === 'SUPERADMIN');
  branches = computed(() => this.branchCtx.branches());
  branchName = computed(() =>
    this.branches().find(b => b.id === this.branchId())?.name ?? this.branchCtx.currentName());
  registerName = computed(() =>
    this.registers().find(r => r.id === this.registerId())?.name ?? 'Caja 1');
  freeRegisters = computed(() => this.registers().filter(r => r.is_active && !r.has_open_session));

  canContinue = computed(() => this.branchId() != null);
  now = new Date();

  // ── Administración de puntos de venta (solo gerente o superior) ──
  canManageRegisters = computed(() =>
    ['SUPERADMIN', 'BRANCH_MANAGER'].includes(this.auth.user()?.role ?? ''));
  manageOpen = signal(false);
  newRegisterName = '';
  registerSaving = signal(false);

  ngOnInit(): void {
    this.branchId.set(this.branchCtx.current() ?? this.auth.user()?.branch_id ?? null);
    this.cash.current(this.branchId()).subscribe({
      next: r => {
        this.openSession.set(r.session);
        this.loading.set(false);
        if (!r.session) this.loadRegisters();
      },
      error: () => { this.loading.set(false); this.loadRegisters(); },
    });
  }

  private loadRegisters(): void {
    this.cash.registers(this.branchId()).subscribe({
      next: r => {
        this.registers.set(r.results || []);
        const free = this.freeRegisters();
        if (free.length && this.registerId() == null) this.registerId.set(free[0].id);
      },
      error: () => {},
    });
  }

  onBranch(id: number | null): void {
    this.branchId.set(id);
    this.registerId.set(null);
    this.loadRegisters();
  }

  next(): void { this.step.update(s => Math.min(s + 1, this.steps.length - 1)); }
  back(): void { this.step.update(s => Math.max(s - 1, 0)); }

  // ── Puntos de venta ──
  /** Agrega una caja física a la sucursal (ej. "Caja 2" para un segundo mostrador). */
  addRegister(): void {
    const branch = this.branchId();
    const name = this.newRegisterName.trim();
    if (branch == null || !name || this.registerSaving()) return;
    this.registerSaving.set(true);
    this.cash.createRegister({ branch, name }).subscribe({
      next: () => {
        this.registerSaving.set(false);
        this.newRegisterName = '';
        this.notify.success(`"${name}" agregada`);
        this.loadRegisters();
      },
      error: e => {
        this.registerSaving.set(false);
        this.notify.error(parseApiError(e).message
          || Object.values(parseApiError(e).fieldErrors)[0]
          || 'No se pudo crear la caja.');
      },
    });
  }

  /** Activa/desactiva una caja: la desactivada deja de ofrecerse en la apertura. */
  toggleRegister(r: CashRegister): void {
    this.cash.updateRegister(r.id, { is_active: !r.is_active }).subscribe({
      next: () => this.loadRegisters(),
      error: e => this.notify.fromServerError(e, 'No se pudo actualizar la caja.'),
    });
  }

  async deleteRegister(r: CashRegister): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar caja',
      message: `¿Eliminar "${r.name}"? Si ya tiene turnos registrados no se podrá borrar; desactívala en su lugar.`,
      variant: 'danger', confirmText: 'Eliminar', cancelText: 'Cancelar',
    });
    if (!ok) return;
    this.cash.removeRegister(r.id).subscribe({
      next: () => { this.notify.success('Caja eliminada'); this.loadRegisters(); },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo eliminar la caja.'),
    });
  }

  submit(): void {
    const branch = this.branchId();
    if (branch == null || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.cash.open({
      branch, register: this.registerId(), lines: this.lines(), note: this.note,
    }).subscribe({
      next: s => {
        this.saving.set(false);
        this.notify.success(`Caja abierta con $${(+s.opening_amount).toFixed(2)}`, {
          description: `${s.code} · ${s.register_name || 'Caja'}`,
        });
        this.router.navigate(['/app/admin/caja/cierre']);
      },
      error: e => {
        this.saving.set(false);
        this.error.set(parseApiError(e).message || 'No se pudo abrir la caja.');
      },
    });
  }

  money(v: string | number | null | undefined): string {
    return '$' + (+(v ?? 0)).toFixed(2);
  }
}
