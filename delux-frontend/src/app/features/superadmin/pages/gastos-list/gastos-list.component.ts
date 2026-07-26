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
import { InventoryService, Supplier } from '@features/superadmin/services/inventory.service';

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
  private inv = inject(InventoryService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  ctx = inject(BranchContextService);

  loading = signal(false);
  saving = signal(false);
  items = signal<Expense[]>([]);
  summary = signal<ExpenseSummary | null>(null);
  categories = signal<ExpenseCategoryOpt[]>([]);
  suppliers = signal<Supplier[]>([]);
  period = signal<Period>('mes');

  readonly payMethods: { value: string; label: string; icon: string }[] = [
    { value: 'CASH', label: 'Efectivo', icon: 'fa-money-bill-wave' },
    { value: 'TRANSFER', label: 'Transferencia', icon: 'fa-building-columns' },
    { value: 'CARD', label: 'Tarjeta', icon: 'fa-credit-card' },
  ];
  payLabel(v?: string): string {
    return this.payMethods.find(m => m.value === v)?.label || '';
  }
  payIcon(v?: string): string {
    return this.payMethods.find(m => m.value === v)?.icon || 'fa-wallet';
  }

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
    { header: 'Forma de pago', key: (r) => r.payment_method_label || '' },
    { header: 'Proveedor', key: (r) => r.supplier_name || '' },
    { header: 'Descripción', key: 'description' },
    { header: 'Sucursal', key: (r) => r.branch_name || '' },
    { header: 'Monto (USD)', key: (r) => Number(r.amount).toFixed(2) },
  ];

  // Filas para exportar: los gastos + una fila final con el TOTAL.
  exportRows = computed(() => {
    const rows = this.items();
    if (!rows.length) return rows as Expense[];
    const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
    const totalRow = {
      date: '', category_label: '', description: 'TOTAL GASTOS',
      branch_name: '', amount: total,
    } as unknown as Expense;
    return [...rows, totalRow];
  });

  form = {
    date: this.today(), amount: null as number | null, category: 'OTROS',
    payment_method: 'CASH', supplier: null as number | null,
    description: '', branch: null as number | null,
  };

  canPickBranch = computed(() => this.ctx.canSwitch());

  // ── Proveedor: combobox tipo inventario (buscar / seleccionar / crear inline) ──
  supplierQuery = '';
  supplierOpen = signal(false);
  creatingSupplier = signal(false);

  filteredSuppliers(): Supplier[] {
    const q = this.supplierQuery.trim().toLowerCase();
    const list = this.suppliers();
    return (q ? list.filter(s => s.name.toLowerCase().includes(q)) : list).slice(0, 8);
  }
  exactSupplierExists(): boolean {
    const q = this.supplierQuery.trim().toLowerCase();
    return !!q && this.suppliers().some(s => s.name.toLowerCase() === q);
  }
  onSupplierInput(): void { this.supplierOpen.set(true); this.form.supplier = null; }
  pickSupplier(s: Supplier): void {
    this.form.supplier = s.id; this.supplierQuery = s.name; this.supplierOpen.set(false);
  }
  clearSupplier(): void { this.form.supplier = null; this.supplierQuery = ''; }
  closeSupplierSoon(): void { setTimeout(() => this.supplierOpen.set(false), 150); }
  createSupplierInline(): void {
    const name = this.supplierQuery.trim();
    if (!name || this.creatingSupplier()) return;
    this.creatingSupplier.set(true);
    this.inv.createSupplier({ name }).subscribe({
      next: sup => {
        this.suppliers.update(l => [...l, sup]);
        this.form.supplier = sup.id; this.supplierQuery = sup.name;
        this.supplierOpen.set(false); this.creatingSupplier.set(false);
        this.notify.success('Proveedor creado');
      },
      error: e => { this.creatingSupplier.set(false); this.notify.error(parseApiError(e).message || 'No se pudo crear el proveedor'); },
    });
  }

  constructor() {
    this.svc.categories().subscribe({ next: c => this.categories.set(c), error: () => {} });
    this.inv.listSuppliers().subscribe({ next: r => this.suppliers.set(r.results), error: () => {} });
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
      payment_method: this.form.payment_method,
      supplier: this.form.supplier ?? null,
      description: this.form.description.trim(),
    };
    const branch = this.canPickBranch() ? (this.form.branch ?? this.ctx.current()) : undefined;
    if (branch != null) body.branch = branch;
    this.svc.create(body).subscribe({
      next: () => {
        this.notify.success('Gasto registrado');
        this.form.amount = null; this.form.description = ''; this.form.supplier = null; this.supplierQuery = '';
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
