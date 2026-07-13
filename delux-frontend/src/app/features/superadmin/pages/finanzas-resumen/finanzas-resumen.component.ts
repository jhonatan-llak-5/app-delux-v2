import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { BranchContextService } from '@core/services/branch-context.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';
import { DlxExportMenuComponent } from '@shared/ui/export-menu.component';
import { ExportColumn } from '@shared/utils/export.util';
import { ExpenseService, FinanceSummary, FinanceTimeline, FinanceYear, FinanceTopProduct } from '@features/superadmin/services/expense.service';

type Period = 'hoy' | 'semana' | 'quincena' | 'mes' | 'anio' | 'custom';
interface ReportRow { seccion: string; concepto: string; valor: string; }

@Component({
  selector: 'dlx-finanzas-resumen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChartCanvasComponent, DlxExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finanzas-resumen.component.html',
})
export class FinanzasResumenComponent {
  private svc = inject(ExpenseService);
  ctx = inject(BranchContextService);

  loading = signal(false);
  data = signal<FinanceSummary | null>(null);
  timeline = signal<FinanceTimeline | null>(null);
  yearly = signal<FinanceYear[]>([]);
  topProducts = signal<FinanceTopProduct[]>([]);
  period = signal<Period>('mes');
  customFrom = signal<string>(this.fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  customTo = signal<string>(this.fmtDate(new Date()));

  readonly periods: { key: Period; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'quincena', label: 'Quincena' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' },
    { key: 'custom', label: 'Rango' },
  ];

  readonly exportColumns: ExportColumn<ReportRow>[] = [
    { header: 'Sección', key: 'seccion' },
    { header: 'Concepto', key: 'concepto' },
    { header: 'Valor (USD)', key: 'valor' },
  ];

  constructor() {
    effect(() => {
      this.period(); this.ctx.current();
      if (this.period() === 'custom') { this.customFrom(); this.customTo(); }
      this.reload();
    }, { allowSignalWrites: true });
  }

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
      case 'custom':   return { from: this.customFrom(), to: this.customTo() };
    }
  }

  reload(): void {
    this.loading.set(true);
    const r = this.range();
    if (this.period() === 'custom' && (!r.from || !r.to || r.from > r.to)) { this.loading.set(false); return; }
    const f = { from: r.from, to: r.to, branch: this.ctx.current() ?? undefined };
    this.svc.financeSummary(f).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.financeTimeline(f).subscribe({ next: t => this.timeline.set(t), error: () => this.timeline.set(null) });
    this.svc.financeYearly(f).subscribe({ next: y => this.yearly.set(y), error: () => this.yearly.set([]) });
    this.svc.financeTopProducts(f).subscribe({ next: p => this.topProducts.set(p), error: () => this.topProducts.set([]) });
  }

  setPeriod(p: Period): void { this.period.set(p); }

  /** Fecha máxima seleccionable: hoy (no permitir futuro). */
  readonly maxDate = this.fmtDate(new Date());
  onFromChange(v: string): void {
    if (!v) return;
    this.customFrom.set(v);
    if (this.customTo() < v) this.customTo.set(v);   // no dejar 'hasta' antes de 'desde'
  }
  onToChange(v: string): void {
    if (!v) return;
    this.customTo.set(v);
    if (this.customFrom() > v) this.customFrom.set(v); // no dejar 'desde' después de 'hasta'
  }

  // Filas para la exportación (P&L + gastos por categoría)
  exportRows = computed<ReportRow[]>(() => {
    const d = this.data(); if (!d) return [];
    const $ = (n: string | number) => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dp = (v: number | null) => v == null ? 'sin comparación' : (v > 0 ? 'subió ' : 'bajó ') + Math.abs(v) + '%';
    const gastoTotal = Number(d.compras) + Number(d.gastos);
    const vendioMas = Number(d.ventas) >= gastoTotal;
    const rows: ReportRow[] = [];

    // Lo más importante primero: el resultado
    rows.push({ seccion: 'RESULTADO', concepto: 'Total que vendí', valor: $(d.ventas) });
    rows.push({ seccion: 'RESULTADO', concepto: 'Total que gasté (compras + gastos)', valor: $(gastoTotal) });
    rows.push({ seccion: 'RESULTADO', concepto: '¿Vendí más de lo que gasté?', valor: vendioMas ? 'SÍ' : 'NO' });
    rows.push({ seccion: 'RESULTADO', concepto: 'Balance (ganancia o pérdida)', valor: $(d.ganancia) });
    rows.push({ seccion: 'RESULTADO', concepto: 'Número de ventas (pedidos)', valor: String(d.orders ?? 0) });

    // Ventas
    rows.push({ seccion: 'VENTAS', concepto: 'Ventas por la web', valor: $(d.ventas_web) });
    rows.push({ seccion: 'VENTAS', concepto: 'Ventas en tienda (POS)', valor: $(d.ventas_pos) });
    rows.push({ seccion: 'VENTAS', concepto: 'Total ventas', valor: $(d.ventas) });

    // Compras
    rows.push({ seccion: 'COMPRAS', concepto: 'Compra de mercadería', valor: $(d.compras) });

    // En qué gasté
    for (const c of d.gastos_by_cat) rows.push({ seccion: 'EN QUÉ GASTÉ', concepto: c.label, valor: $(c.total) });
    rows.push({ seccion: 'EN QUÉ GASTÉ', concepto: 'Total gastos', valor: $(d.gastos) });

    // Tendencia (en palabras)
    rows.push({ seccion: 'TENDENCIA (vs periodo anterior)', concepto: 'Ventas', valor: dp(d.deltas.ventas) });
    rows.push({ seccion: 'TENDENCIA (vs periodo anterior)', concepto: 'Gastos', valor: dp(d.deltas.gastos) });
    rows.push({ seccion: 'TENDENCIA (vs periodo anterior)', concepto: 'Ganancia', valor: dp(d.deltas.ganancia) });

    // Productos más vendidos
    for (const p of this.topProducts()) rows.push({ seccion: 'PRODUCTOS MÁS VENDIDOS', concepto: p.product, valor: p.qty + ' u · ' + $(p.revenue) });

    // Comparativo anual
    for (const y of this.yearly()) {
      rows.push({ seccion: 'AÑO ' + y.year, concepto: 'Ventas', valor: $(y.ventas) });
      rows.push({ seccion: 'AÑO ' + y.year, concepto: 'Compras', valor: $(y.compras) });
      rows.push({ seccion: 'AÑO ' + y.year, concepto: 'Gastos', valor: $(y.gastos) });
      rows.push({ seccion: 'AÑO ' + y.year, concepto: 'Ganancia', valor: $(y.ganancia) });
    }
    return rows;
  });
  exportSubtitle = computed(() => {
    const d = this.data();
    return d ? `${this.ctx.currentName()} · ${d.range.from} a ${d.range.to}` : '';
  });

  private tickLabels(): string[] {
    const t = this.timeline();
    if (!t) return [];
    return t.granularity === 'day' ? t.labels.map(l => l.slice(5)) : t.labels;
  }
  private primary(): string {
    if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') return '#3b82f6';
    return getComputedStyle(document.documentElement).getPropertyValue('--dash-primary').trim() || '#3b82f6';
  }
  private lineCfg(label: string, values: number[], color: string): ChartConfiguration {
    return {
      type: 'line',
      data: { labels: this.tickLabels(), datasets: [{ label, data: values, borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } } },
    };
  }
  webConfig = computed<ChartConfiguration | null>(() => { const t = this.timeline(); return t ? this.lineCfg('Ventas Web', t.web, this.primary()) : null; });
  posConfig = computed<ChartConfiguration | null>(() => { const t = this.timeline(); return t ? this.lineCfg('Ventas POS', t.pos, '#0b1c40') : null; });
  flowConfig = computed<ChartConfiguration | null>(() => {
    const t = this.timeline(); if (!t) return null;
    const ventas = t.web.map((v, i) => v + (t.pos[i] || 0));
    return {
      type: 'bar',
      data: {
        labels: this.tickLabels(),
        datasets: [
          { label: 'Ventas', data: ventas, backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Gastos', data: t.gastos, backgroundColor: '#e11d48', borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } } },
    };
  });

  yearlyConfig = computed<ChartConfiguration | null>(() => {
    const ys = this.yearly(); if (!ys.length) return null;
    return {
      type: 'bar',
      data: {
        labels: ys.map(y => String(y.year)),
        datasets: [
          { label: 'Ventas',   data: ys.map(y => +y.ventas),   backgroundColor: '#10b981' },
          { label: 'Compras',  data: ys.map(y => +y.compras),  backgroundColor: '#f59e0b' },
          { label: 'Gastos',   data: ys.map(y => +y.gastos),   backgroundColor: '#e4002b' },
          { label: 'Ganancia', data: ys.map(y => +y.ganancia), backgroundColor: '#0ea5e9' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } } },
    };
  });

  // Guía en lenguaje simple con tendencia (alcista/bajista) para decidir.
  guide = computed(() => {
    const d = this.data(); if (!d) return [];
    const money = (n: string) => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mk = (label: string, value: string, delta: number | null, up: string, down: string, goodUp: boolean) => {
      let msg: string, tone: 'good' | 'bad' | 'neutral';
      if (delta != null && delta !== 0) {
        const isUp = delta > 0;
        msg = isUp ? up : down;
        tone = (goodUp ? isUp : !isUp) ? 'good' : 'bad';
      } else if (Number(value) > 0) {
        msg = 'Primer periodo con datos'; tone = 'neutral';
      } else {
        msg = 'Sin movimientos aún'; tone = 'neutral';
      }
      return { label, value: money(value), delta, msg, tone };
    };
    return [
      mk('Ventas',   d.ventas,   d.deltas.ventas,   'Tus ventas subieron 👏', 'Tus ventas bajaron, revisa', true),
      mk('Gastos',   d.gastos,   d.deltas.gastos,   'Gastaste más, contrólalo', 'Bajaste gastos, bien hecho', false),
      mk('Ganancia', d.ganancia, d.deltas.ganancia, 'Tu ganancia mejoró', 'Tu ganancia bajó, revisa costos', true),
    ];
  });

  money(n: string | number | undefined): string { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  pct(part: string, total: string): number { const t = Number(total); return t > 0 ? Math.round((Number(part) / t) * 100) : 0; }
  deltaClass(val: number | null, goodWhenUp: boolean): string {
    if (val == null || val === 0) return 'text-ink-400 dark:text-white/40';
    const good = goodWhenUp ? val > 0 : val < 0;
    return good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  }
  deltaIcon(val: number | null): string { if (val == null || val === 0) return 'fa-minus'; return val > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'; }
}
