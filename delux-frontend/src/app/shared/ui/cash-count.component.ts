import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DlxQtyInputComponent } from './qty-input.component';

export interface CashCountLine {
  piece: 'BILL' | 'COIN';
  denomination: number;
  quantity: number | null;
}

/** Denominaciones en circulación (USD, Ecuador). Debe coincidir con
 *  `DENOMINATIONS` del backend (apps/cashbox/models.py). */
export const CASH_DENOMINATIONS: { piece: 'BILL' | 'COIN'; denomination: number }[] = [
  { piece: 'BILL', denomination: 100 },
  { piece: 'BILL', denomination: 50 },
  { piece: 'BILL', denomination: 20 },
  { piece: 'BILL', denomination: 10 },
  { piece: 'BILL', denomination: 5 },
  { piece: 'BILL', denomination: 2 },
  { piece: 'BILL', denomination: 1 },
  { piece: 'COIN', denomination: 1 },
  { piece: 'COIN', denomination: 0.50 },
  { piece: 'COIN', denomination: 0.25 },
  { piece: 'COIN', denomination: 0.10 },
  { piece: 'COIN', denomination: 0.05 },
  { piece: 'COIN', denomination: 0.01 },
];

export function emptyCashCount(): CashCountLine[] {
  return CASH_DENOMINATIONS.map(d => ({ ...d, quantity: null }));
}

/**
 * Conteo físico de efectivo por denominación (arqueo de caja).
 *
 * Se usa igual en la apertura (fondo inicial) y en el cierre (conteo final), y
 * en modo `readonly` para mostrar un conteo ya guardado en el historial.
 *
 * <dlx-cash-count [value]="lines()" (valueChange)="lines.set($event)"
 *                 (totalChange)="total.set($event)" />
 */
@Component({
  selector: 'dlx-cash-count',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxQtyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 sm:grid-cols-2 max-w-5xl">
      @for (group of groups(); track group.key) {
        <div class="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-white/5
                      border-b border-slate-200 dark:border-white/10">
            <i class="fa-solid {{ group.icon }} text-slate-400"></i>
            <span class="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-white/50">
              {{ group.label }}
            </span>
            <span class="ml-auto text-sm font-bold tabular-nums">{{ money(group.total) }}</span>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40">
                <th class="text-left font-semibold px-4 py-2">Denominación</th>
                <th class="text-center font-semibold px-2 py-2">Cantidad</th>
                <th class="text-right font-semibold px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (row of group.rows; track row.idx) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-1.5 font-semibold tabular-nums">{{ money(row.line.denomination) }}</td>
                  <td class="px-2 py-1.5 text-center">
                    @if (readonly) {
                      <span class="font-bold tabular-nums">{{ row.line.quantity ?? 0 }}</span>
                    } @else {
                      <dlx-qty-input [ngModel]="row.line.quantity" (ngModelChange)="setQty(row.idx, $event)"
                                     [min]="0" [allowEmpty]="true" inputClass="w-12"
                                     [ariaLabel]="'Cantidad de ' + money(row.line.denomination)" />
                    }
                  </td>
                  <td class="px-4 py-1.5 text-right font-semibold tabular-nums"
                      [ngClass]="row.line.quantity ? '' : 'text-slate-300 dark:text-white/20'">
                    {{ money(row.line.denomination * (row.line.quantity ?? 0)) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <div class="mt-4 max-w-5xl flex items-center justify-between gap-4 rounded-xl px-5 py-4
                bg-[var(--dash-primary)]/8 border border-[var(--dash-primary)]/25">
      <div>
        <p class="text-sm font-bold text-slate-800 dark:text-white">{{ totalLabel }}</p>
        @if (totalHint) { <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5">{{ totalHint }}</p> }
      </div>
      <span class="text-3xl font-display font-bold tabular-nums">{{ money(total()) }}</span>
    </div>
  `,
})
export class DlxCashCountComponent {
  @Input() set value(v: CashCountLine[] | null | undefined) {
    this.lines.set(v?.length ? v.map(l => ({ ...l })) : emptyCashCount());
  }
  @Input() readonly = false;
  @Input() totalLabel = 'Total contado';
  @Input() totalHint = '';

  @Output() valueChange = new EventEmitter<CashCountLine[]>();
  @Output() totalChange = new EventEmitter<number>();

  lines = signal<CashCountLine[]>(emptyCashCount());

  total = computed(() =>
    this.lines().reduce((s, l) => s + l.denomination * (l.quantity ?? 0), 0)
  );

  groups = computed(() => {
    const rows = this.lines().map((line, idx) => ({ line, idx }));
    const build = (key: 'BILL' | 'COIN', label: string, icon: string) => {
      const own = rows.filter(r => r.line.piece === key);
      return {
        key, label, icon, rows: own,
        total: own.reduce((s, r) => s + r.line.denomination * (r.line.quantity ?? 0), 0),
      };
    };
    return [build('BILL', 'Billetes', 'fa-money-bill-wave'), build('COIN', 'Monedas', 'fa-coins')];
  });

  setQty(idx: number, qty: number | null): void {
    const next = this.lines().map((l, i) => (i === idx ? { ...l, quantity: qty } : l));
    this.lines.set(next);
    this.valueChange.emit(next);
    this.totalChange.emit(this.total());
  }

  money(n: number): string {
    return '$' + (n || 0).toFixed(2);
  }
}
