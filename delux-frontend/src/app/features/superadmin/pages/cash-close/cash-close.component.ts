import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import {
  CashCountLine, DlxCashCountComponent, DlxModalComponent, DlxPageHeaderComponent,
  DlxPriceInputComponent, DlxStep, DlxStepperComponent, emptyCashCount,
} from '@shared/ui';
import { CashService, CashSession } from '@features/superadmin/services/cash.service';

@Component({
  selector: 'dlx-cash-close',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxPageHeaderComponent, DlxStepperComponent,
            DlxCashCountComponent, DlxModalComponent, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-close.component.html',
})
export class CashCloseComponent implements OnInit {
  private cash = inject(CashService);
  private notify = inject(NotifyService);
  auth = inject(AuthService);
  branchCtx = inject(BranchContextService);

  readonly steps: DlxStep[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'conteo', label: 'Conteo de efectivo' },
    { key: 'resultado', label: 'Resultado' },
    { key: 'confirm', label: 'Confirmación' },
  ];
  step = signal(0);

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  session = signal<CashSession | null>(null);
  closed = signal<CashSession | null>(null);   // resultado tras cerrar

  lines = signal<CashCountLine[]>(emptyCashCount());
  counted = signal(0);
  note = '';

  // Movimiento manual (ingreso / retiro)
  movOpen = signal(false);
  movType = signal<'IN' | 'OUT'>('OUT');
  movAmount: number | null = null;
  movReason = '';
  movSaving = signal(false);

  totals = computed(() => this.session()?.totals ?? null);
  expected = computed(() => +(this.totals()?.expected_amount ?? 0));
  difference = computed(() => +(this.counted() - this.expected()).toFixed(2));
  /** Tolerancia de centavo para no marcar descuadre por redondeo. */
  isBalanced = computed(() => Math.abs(this.difference()) < 0.005);

  elapsed = computed(() => {
    const s = this.session();
    if (!s) return '';
    const from = new Date(s.opened_at).getTime();
    const mins = Math.max(0, Math.floor((Date.now() - from) / 60000));
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  });

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.cash.current(this.branchCtx.current() ?? this.auth.user()?.branch_id ?? null).subscribe({
      next: r => { this.session.set(r.session); this.loading.set(false); },
      error: () => { this.session.set(null); this.loading.set(false); },
    });
  }

  /** Re-lee el turno para traer ventas y movimientos al día. */
  refresh(): void {
    const s = this.session();
    if (!s) return;
    this.cash.summary(s.id).subscribe({
      next: fresh => this.session.set(fresh),
      error: e => this.notify.fromServerError(e, 'No se pudo actualizar el resumen.'),
    });
  }

  next(): void { this.step.update(s => Math.min(s + 1, this.steps.length - 1)); }
  back(): void { this.step.update(s => Math.max(s - 1, 0)); }

  // ── Movimientos manuales ──
  openMovement(type: 'IN' | 'OUT'): void {
    this.movType.set(type);
    this.movAmount = null;
    this.movReason = '';
    this.movOpen.set(true);
  }
  saveMovement(): void {
    const s = this.session();
    const amount = Number(this.movAmount) || 0;
    if (!s || amount <= 0 || this.movSaving()) return;
    this.movSaving.set(true);
    this.cash.addMovement(s.id, { type: this.movType(), amount, reason: this.movReason }).subscribe({
      next: () => {
        this.movSaving.set(false);
        this.movOpen.set(false);
        this.notify.success(this.movType() === 'IN' ? 'Ingreso registrado' : 'Retiro registrado');
        this.refresh();
      },
      error: e => {
        this.movSaving.set(false);
        this.notify.error(parseApiError(e).message || 'No se pudo registrar el movimiento.');
      },
    });
  }

  close(): void {
    const s = this.session();
    if (!s || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.cash.close(s.id, { lines: this.lines(), note: this.note }).subscribe({
      next: done => {
        this.saving.set(false);
        this.closed.set(done);
        this.session.set(null);
        this.notify.success('Caja cerrada', { description: done.code });
      },
      error: e => {
        this.saving.set(false);
        this.error.set(parseApiError(e).message || 'No se pudo cerrar la caja.');
      },
    });
  }

  money(v: string | number | null | undefined): string {
    return '$' + (+(v ?? 0)).toFixed(2);
  }
  abs(n: number): number { return Math.abs(n); }
}
