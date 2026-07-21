import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, effect} from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { DlxStatCardComponent } from '@shared/ui';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  ReportsService, RangeParams, OverviewKPIs,
  TimelinePoint, BranchRow, CategoryRow, BrandRow,
  ProductRow, SellerRow, ChannelRow, LowStockRow,
} from '@features/superadmin/services/reports.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { ExpenseService, FinanceTimeline } from '@features/superadmin/services/expense.service';
import { ChartCanvasComponent } from '@shared/components/chart-canvas/chart-canvas.component';

const ACCENT = '#22d3ee';
const VIOLET = '#7c3aed';
const MAGENTA = '#e0399a';
const ORANGE = '#ff7849';
const TEAL = '#14b8a6';
const AMBER = '#f59e0b';
const ROSE = '#f43f5e';

const PALETTE = [VIOLET, ACCENT, MAGENTA, ORANGE, TEAL, AMBER, ROSE, '#3b82f6', '#10b981'];

@Component({
  selector: 'dlx-reports-dashboard',
  standalone: true,
  imports: [ImgFallbackDirective, DlxStatCardComponent, CommonModule, FormsModule, ChartCanvasComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-dashboard.component.html',
})
export class ReportsDashboardComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(ReportsService);
  private adminSvc = inject(AdminService);
  private fin = inject(ExpenseService);
  private branchCtx = inject(BranchContextService);
  private ready = false;
  constructor() {
    // El efecto se agenda y corre por primera vez DESPUES de ngOnInit; saltamos
    // esa primera ejecucion para no duplicar el reload inicial. Solo recarga
    // cuando el usuario cambia de sucursal en el selector global.
    let branchFirst = true;
    effect(() => {
      this.branchCtx.current();
      if (branchFirst) { branchFirst = false; return; }
      this.reload();
    }, { allowSignalWrites: true });
  }

  branches = signal<AdminBranch[]>([]);
  branchId: number | null = null;
  presetDays = 30;
  from = '';
  to = '';

  kpis = signal<OverviewKPIs | null>(null);
  timeline = signal<TimelinePoint[]>([]);
  finTimeline = signal<FinanceTimeline | null>(null);
  byBranch = signal<BranchRow[]>([]);
  byCategory = signal<CategoryRow[]>([]);
  byBrand = signal<BrandRow[]>([]);
  byChannel = signal<ChannelRow[]>([]);
  topProducts = signal<ProductRow[]>([]);
  topSellers = signal<SellerRow[]>([]);
  lowStock = signal<LowStockRow[]>([]);

  ngOnInit() {
    this.setPreset(30);
    this.ready = true;
  }

  setPreset(days: number) {
    this.presetDays = days;
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (days - 1));
    this.to = now.toISOString().slice(0, 10);
    this.from = from.toISOString().slice(0, 10);
    this.reload();
  }

  onCustomRange() {
    if (this.from && this.to) {
      this.presetDays = 0;
      this.reload();
    }
  }

  private params(): RangeParams {
    return {
      from: this.from || undefined,
      to: this.to || undefined,
      branch: this.branchCtx.current() || undefined,
    };
  }

  reload() {
    const p = this.params();
    this.svc.overview(p).subscribe(k => this.kpis.set(k));
    this.svc.timeline(p).subscribe(r => this.timeline.set(r.results));
    this.fin.financeTimeline({ from: this.from, to: this.to, branch: this.branchCtx.current() || undefined })
      .subscribe(t => this.finTimeline.set(t));
    this.svc.byBranch(p).subscribe(r => this.byBranch.set(r.results));
    this.svc.byCategory(p).subscribe(r => this.byCategory.set(r.results));
    this.svc.byBrand(p).subscribe(r => this.byBrand.set(r.results));
    this.svc.byChannel(p).subscribe(r => this.byChannel.set(r.results));
    this.svc.topProducts(p).subscribe(r => this.topProducts.set(r.results));
    this.svc.topSellers(p).subscribe(r => this.topSellers.set(r.results));
    this.svc.lowStock().subscribe(r => this.lowStock.set(r.results));
  }

  // ── Chart configs ──────────────────────────────────────────────
  timelineConfig = computed<ChartConfiguration | null>(() => {
    const t = this.finTimeline();
    if (!t || !t.labels.length) return null;
    return {
      type: 'line',
      data: {
        labels: t.labels.map(l => l.slice(5)),
        datasets: [
          { label: 'Tienda', data: t.pos, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.10)',
            tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 },
          { label: 'Web', data: t.web, borderColor: VIOLET, backgroundColor: 'rgba(124,58,237,0.10)',
            tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: $${(+ctx.parsed.y).toFixed(2)}` } } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } },
      },
    };
  });

  branchConfig = computed<ChartConfiguration | null>(() => {
    const b = this.byBranch();
    if (!b.length) return null;
    return {
      type: 'doughnut',
      data: {
        labels: b.map(x => x.branch__name),
        datasets: [{
          data: b.map(x => +x.revenue),
          backgroundColor: PALETTE,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      },
    };
  });

  categoryConfig = computed<ChartConfiguration | null>(() => {
    const c = this.byCategory();
    if (!c.length) return null;
    const top = c.slice(0, 7);
    return {
      type: 'bar',
      data: {
        labels: top.map(x => x.variant__product__category__name || '—'),
        datasets: [{
          label: 'Ingresos',
          data: top.map(x => +x.revenue),
          backgroundColor: ACCENT,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } },
      },
    };
  });

  brandConfig = computed<ChartConfiguration | null>(() => {
    const b = this.byBrand();
    if (!b.length) return null;
    const top = b.slice(0, 7);
    return {
      type: 'bar',
      data: {
        labels: top.map(x => x.variant__product__brand__name || '—'),
        datasets: [{
          label: 'Ingresos',
          data: top.map(x => +x.revenue),
          backgroundColor: MAGENTA,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } },
      },
    };
  });

  channelConfig = computed<ChartConfiguration | null>(() => {
    const c = this.byChannel();
    if (!c.length) return null;
    return {
      type: 'pie',
      data: {
        labels: c.map(x => x.channel),
        datasets: [{
          data: c.map(x => +x.revenue),
          backgroundColor: [VIOLET, ACCENT, ORANGE, TEAL],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      },
    };
  });

  // ── Exportes ──────────────────────────────────────────────────
  hasAnyData(): boolean {
    return this.timeline().length > 0 || this.byBranch().length > 0 ||
           this.byCategory().length > 0 || this.byBrand().length > 0 ||
           this.topProducts().length > 0 || this.topSellers().length > 0;
  }
  noDataMsg(): string {
    return this.branchCtx.current()
      ? 'Esta sucursal no tiene datos en el periodo seleccionado.'
      : 'No hay datos para mostrar en el periodo seleccionado.';
  }

  // Día con más y con menos ventas (solo días con ventas > 0).
  private dayTotals() {
    const t = this.finTimeline();
    if (!t) return [];
    return t.labels.map((d, i) => ({ day: d, revenue: (t.web[i] || 0) + (t.pos[i] || 0) })).filter(x => x.revenue > 0);
  }
  readonly bestDay = computed(() => {
    this.finTimeline();
    const days = this.dayTotals();
    return days.length ? days.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;
  });
  readonly worstDay = computed(() => {
    this.finTimeline();
    const days = this.dayTotals();
    return days.length > 1 ? days.reduce((a, b) => (b.revenue < a.revenue ? b : a)) : null;
  });

  private money(n: any): string { return '$' + (Math.round((+n || 0) * 100) / 100).toFixed(2); }

  // Renderiza un gráfico en alta resolución (offscreen) para el PDF -> nítido.
  private chartToImage(config: ChartConfiguration, cssW: number, cssH: number): string | null {
    try {
      const holder = document.createElement('div');
      holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${cssW}px;height:${cssH}px;`;
      const canvas = document.createElement('canvas');
      canvas.width = cssW; canvas.height = cssH;
      holder.appendChild(canvas);
      document.body.appendChild(holder);
      const cfg: any = {
        ...config,
        options: {
          ...(config.options || {}),
          responsive: false, animation: false, maintainAspectRatio: false,
          devicePixelRatio: 3,
        },
      };
      const chart = new Chart(canvas, cfg);
      const img = canvas.toDataURL('image/png', 1.0);
      chart.destroy();
      document.body.removeChild(holder);
      return img;
    } catch { return null; }
  }

  exportExcel() {
    const wb = XLSX.utils.book_new();
    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const k = this.kpis();
    const resumen = [
      { Indicador: 'Ingresos totales', Valor: round(+(k?.total_revenue || 0)) },
      { Indicador: 'Órdenes', Valor: k?.total_orders || 0 },
      { Indicador: 'Venta promedio', Valor: round(+(k?.avg_order_value || 0)) },
      { Indicador: 'Unidades vendidas', Valor: k?.items_sold || 0 },
      { Indicador: 'Clientes únicos', Valor: k?.unique_customers || 0 },
    ];
    const bd = this.bestDay(), wd = this.worstDay();
    if (bd) resumen.push({ Indicador: 'Día con más ventas', Valor: `${bd.day} (${this.money(bd.revenue)})` } as any);
    if (wd) resumen.push({ Indicador: 'Día con menos ventas', Valor: `${wd.day} (${this.money(wd.revenue)})` } as any);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    const sheet = (name: string, rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Sin datos en el periodo' }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    sheet('Ingresos por dia', this.timeline());
    sheet('Por canal', this.byChannel());
    sheet('Sucursales', this.byBranch());
    sheet('Categorias', this.byCategory());
    sheet('Marcas', this.byBrand());
    sheet('Top productos', this.topProducts());
    sheet('Vendedores', this.topSellers());
    sheet('Stock bajo', this.lowStock());
    XLSX.writeFile(wb, `Delux-reportes-${this.from}-${this.to}.xlsx`);
  }

  exportPDF() {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const BLACK: [number, number, number] = [17, 24, 39];
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    doc.text('DELUX - Reportes y analiticas', 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
    doc.text(`Periodo: ${this.from} a ${this.to}`, 14, 26);
    const scope = this.branchCtx.current() ? (this.branchCtx.currentName() || 'Sucursal') : 'Todas las sucursales (consolidado)';
    doc.text(`Alcance: ${scope}`, 14, 31);
    doc.setTextColor(20);

    const k = this.kpis();
    autoTable(doc, {
      startY: 36,
      head: [['Indicador', 'Valor']],
      body: [
        ['Ingresos totales', this.money(k?.total_revenue)],
        ['Ordenes', `${k?.total_orders ?? 0}`],
        ['Venta promedio', this.money(k?.avg_order_value)],
        ['Unidades vendidas', `${k?.items_sold ?? 0}`],
        ['Clientes unicos', `${k?.unique_customers ?? 0}`],
      ],
      headStyles: { fillColor: BLACK, textColor: 255 },
    });
    let y = (doc as any).lastAutoTable.finalY + 8;

    const heading = (txt: string) => {
      if (y + 14 > H) { doc.addPage(); y = 18; }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
      doc.text(txt, 14, y); y += 4;
    };

    // Ventas por dia (Tienda vs Web) + mejor/peor dia
    const tl = this.timelineConfig();
    if (tl) {
      const w = W - 28;
      const h = w * (300 / 760);
      if (y + h + 20 > H) { doc.addPage(); y = 18; }
      heading('Ventas por dia (Tienda vs Web)');
      const img = this.chartToImage(tl, 760, 300);
      if (img) { doc.addImage(img, 'PNG', 14, y, w, h); y += h + 5; }
      const bd = this.bestDay(), wd = this.worstDay();
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
      if (bd) { doc.text(`Dia con mas ventas: ${bd.day}  ->  ${this.money(bd.revenue)}`, 14, y); y += 5; }
      if (wd) { doc.text(`Dia con menos ventas: ${wd.day}  ->  ${this.money(wd.revenue)}`, 14, y); y += 5; }
      doc.setTextColor(20); y += 5;
    }

    // Graficos categoricos en 2 columnas + mini tabla de valores
    const chLabel = (c: string) => c === 'WEB' ? 'Web' : c === 'POS' ? 'Tienda' : c;
    const items = [
      { title: 'Ventas por canal', cfg: this.channelConfig(), head: ['Canal', 'Ingresos'],
        rows: this.byChannel().map(c => [chLabel(c.channel), this.money(c.revenue)]) },
      { title: 'Por sucursal', cfg: this.branchConfig(), head: ['Sucursal', 'Ingresos'],
        rows: this.byBranch().map(b => [b.branch__name, this.money(b.revenue)]) },
      { title: 'Por categoria', cfg: this.categoryConfig(), head: ['Categoria', 'Ingresos'],
        rows: this.byCategory().slice(0, 10).map(c => [c.variant__product__category__name || '-', this.money(c.revenue)]) },
      { title: 'Por marca', cfg: this.brandConfig(), head: ['Marca', 'Ingresos'],
        rows: this.byBrand().slice(0, 10).map(b => [b.variant__product__brand__name || '-', this.money(b.revenue)]) },
    ].filter(it => !!it.cfg);

    const colGap = 8;
    const colW = (W - 28 - colGap) / 2;
    const chartH = colW * (300 / 440);
    const colX = [14, 14 + colW + colGap];
    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2);
      const maxRows = Math.max(1, ...pair.map(it => it.rows.length));
      const rowH = 6 + chartH + 3 + (maxRows + 1) * 6 + 10;
      if (y + rowH > H) { doc.addPage(); y = 18; }
      const top = y;
      let maxFinalY = top + 5 + chartH + 3;
      pair.forEach((it, j) => {
        const x = colX[j];
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
        doc.text(it.title, x, top + 2);
        const img = this.chartToImage(it.cfg as ChartConfiguration, 440, 300);
        if (img) doc.addImage(img, 'PNG', x, top + 5, colW, chartH);
        autoTable(doc, {
          startY: top + 5 + chartH + 3,
          margin: { left: x },
          tableWidth: colW,
          head: [it.head],
          body: it.rows,
          theme: 'grid',
          headStyles: { fillColor: BLACK, textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 1.5 },
        });
        maxFinalY = Math.max(maxFinalY, (doc as any).lastAutoTable.finalY);
      });
      y = maxFinalY + 8;
    }

    // Tablas de datos (todas con header negro)
    const section = (title: string, headCols: string[], body: any[][]) => {
      if (!body.length) return;
      if (y + 18 > H) { doc.addPage(); y = 18; }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
      doc.text(title, 14, y);
      autoTable(doc, { startY: y + 2, head: [headCols], body, headStyles: { fillColor: BLACK, textColor: 255 }, styles: { fontSize: 8 } });
      y = (doc as any).lastAutoTable.finalY + 8;
    };
    section('Top productos', ['Producto', 'Marca', 'Unidades', 'Ingresos'],
      this.topProducts().map(pr => [pr.variant__product__name, pr.variant__product__brand__name || '-', pr.units, this.money(pr.revenue)]));
    section('Por sucursal', ['Sucursal', 'Ordenes', 'Ingresos'],
      this.byBranch().map(b => [b.branch__name, b.orders, this.money(b.revenue)]));
    section('Por categoria', ['Categoria', 'Ingresos'],
      this.byCategory().map(c => [c.variant__product__category__name || '-', this.money(c.revenue)]));
    section('Por marca', ['Marca', 'Ingresos'],
      this.byBrand().map(b => [b.variant__product__brand__name || '-', this.money(b.revenue)]));
    section('Vendedores', ['Vendedor', 'Sucursal', 'Ventas', 'Ingresos', 'Comision'],
      this.topSellers().map(sv => [sv.seller__full_name || sv.seller__email, sv.seller__branch__name || '-', sv.orders, this.money(sv.revenue), this.money(sv.commission)]));
    section('Stock bajo', ['Producto', 'SKU', 'Sucursal', 'Stock'],
      this.lowStock().map(l => [l.product_name, l.variant_sku, l.branch_name, `${l.quantity}/${l.min_threshold}`]));

    if (!this.hasAnyData()) {
      if (y + 20 > H) { doc.addPage(); y = 18; }
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
      doc.text('No hay datos de ventas en el periodo seleccionado.', 14, y + 4);
    }

    doc.save(`Delux-reportes-${this.from}-${this.to}.pdf`);
  }

}
