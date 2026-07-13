import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { NotifyService } from '@shared/services/notify.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { BranchContextService } from '@core/services/branch-context.service';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { ExpenseService, Expense, ExpenseCategoryOpt, ExpenseSummary } from '@features/superadmin/services/expense.service';

type Period = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio';

@Component({
  selector: 'dlx-gastos-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxPriceInputComponent, DlxExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gastos-list.component.html',
})
export class GastosListComponent {
  private svc = inject(ExpenseService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  ctx = inject(BranchContextService);

  loading = signal(false);
  saving = signal(false);
  items = signal<Expense[]>([]);
  summary = signal<ExpenseSummary | null>(null);
  categories = signal<ExpenseCategoryOpt[]>([]);
  period = signal<Period>('mes');

  readonly periods: { key: Period; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'quincena', label: 'Quincena' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' },
  ];

  readonly exportColumns: ExportColumn<Expense>[] = [
    { header: 'Fecha', key: 'date' },
    { header: 'Categoría', key: 'category_label' },
    { header: 'Descripción', key: 'description' },
    { header: 'Sucursal', key: (r) => r.branch_name || '' },
    { header: 'Monto (USD)', key: (r) => Number(r.amount).toFixed(2) },
  ];

  form = { date: this.today(), amount: null as number | null, category: 'OTROS', description: '', branch: null as number | null };

  canPickBranch = computed(() => this.ctx.canSwitch());

  constructor() {
    this.svc.categories().subscribe({ next: c => this.categories.set(c), error: () => {} });
    effect(() => { this.period(); this.ctx.current(); this.reload(); }, { allowSignalWrites: true });
  }

  private today(): string { return this.fmtDate(new Date()); }
  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private range(): { from: string; to: string } {
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    switch (this.period()) {
      case 'hoy':      return { from: this.fmtDate(d), to: this.fmtDate(d) };
      case 'semana': { const mon = new Date(d); mon.setDate(day - ((d.getDay() + 6) % 7)); return { from: this.fmtDate(mon), to: this.fmtDate(d) }; }
      case 'quincena': return { from: this.fmtDate(day <= 15 ? new Date(y, m, 1) : new Date(y, m, 16)), to: this.fmtDate(d) };
      case 'mes':      return { from: this.fmtDate(new Date(y, m, 1)), to: this.fmtDate(d) };
      case 'anio':     return { from: this.fmtDate(new Date(y, 0, 1)), to: this.fmtDate(d) };
    }
  }

  private filter() {
    const r = this.range();
    return { from: r.from, to: r.to, branch: this.ctx.current() ?? undefined };
  }

  reload(): void {
    this.loading.set(true);
    const f = this.filter();
    this.svc.list(f).subscribe({
      next: r => { this.items.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.summary(f).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  setPeriod(p: Period): void { this.period.set(p); }

  save(): void {
    if (!this.form.amount || this.form.amount <= 0) { this.notify.warning('Ingresa un monto válido'); return; }
    this.saving.set(true);
    const body: Partial<Expense> = {
      date: this.form.date, amount: this.form.amount, category: this.form.category,
      description: this.form.description.trim(),
    };
    const branch = this.canPickBranch() ? (this.form.branch ?? this.ctx.current()) : undefined;
    if (branch != null) body.branch = branch;
    this.svc.create(body).subscribe({
      next: () => {
        this.notify.success('Gasto registrado');
        this.form.amount = null; this.form.description = '';
        this.saving.set(false);
        this.reload();
      },
      error: e => { this.notify.error(parseApiError(e).message || 'No se pudo registrar el gasto'); this.saving.set(false); },
    });
  }

  async remove(x: Expense): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar gasto', message: `¿Eliminar el gasto de $${this.money(x.amount)}?`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.svc.remove(x.id).subscribe({
      next: () => { this.notify.success('Gasto eliminado'); this.reload(); },
      error: e => this.notify.error(parseApiError(e).message || 'No se pudo eliminar'),
    });
  }

  money(n: string | number): string {
    return Number(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  pct(part: string, total: string): number {
    const t = Number(total); return t > 0 ? Math.round((Number(part) / t) * 100) : 0;
  }
  catIcon(c: string): string {
    const m: Record<string, string> = {
      MOTORIZADO: 'fa-motorcycle', PUBLICIDAD: 'fa-bullhorn', ONLINE: 'fa-globe',
      ALIMENTACION: 'fa-utensils', SERVICIOS: 'fa-bolt', INSUMOS: 'fa-broom',
      NOMINA: 'fa-money-check-dollar', OTROS: 'fa-receipt',
    };
    return m[c] || 'fa-receipt';
  }
}
