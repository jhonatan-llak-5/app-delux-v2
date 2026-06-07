import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  ReportsService, RangeParams, OverviewKPIs,
  TimelinePoint, BranchRow, CategoryRow, BrandRow,
  ProductRow, SellerRow, ChannelRow, LowStockRow,
} from '@features/superadmin/services/reports.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
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
  imports: [CommonModule, FormsModule, ChartCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-chart-line"></i>
          <span class="uppercase tracking-widest font-semibold">Insights</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Reportes y analíticas</h1>
        <p class="text-slate-500 text-sm mt-1">
          {{ kpis()?.from }} → {{ kpis()?.to }} · datos en tiempo real
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button (click)="setPreset(7)"
                class="px-3 py-2 rounded-lg text-xs font-semibold transition"
                [class.bg-ink-950]="presetDays === 7" [class.text-white]="presetDays === 7"
                [class.bg-slate-100]="presetDays !== 7" [class.hover:bg-slate-200]="presetDays !== 7">7 días</button>
        <button (click)="setPreset(30)"
                class="px-3 py-2 rounded-lg text-xs font-semibold transition"
                [class.bg-ink-950]="presetDays === 30" [class.text-white]="presetDays === 30"
                [class.bg-slate-100]="presetDays !== 30" [class.hover:bg-slate-200]="presetDays !== 30">30 días</button>
        <button (click)="setPreset(90)"
                class="px-3 py-2 rounded-lg text-xs font-semibold transition"
                [class.bg-ink-950]="presetDays === 90" [class.text-white]="presetDays === 90"
                [class.bg-slate-100]="presetDays !== 90" [class.hover:bg-slate-200]="presetDays !== 90">90 días</button>
        <input type="date" [(ngModel)]="from" (change)="onCustomRange()"
               class="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs" />
        <input type="date" [(ngModel)]="to" (change)="onCustomRange()"
               class="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs" />
        <select [(ngModel)]="branchId" (change)="reload()"
                class="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <option [ngValue]="null">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
        </select>
      </div>
    </div>

    <!-- KPIs -->
    @if (kpis(); as k) {
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="card p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <p class="text-xs uppercase tracking-widest text-emerald-100 font-semibold">Revenue</p>
          <p class="text-3xl font-bold mt-1">\${{ k.total_revenue | number:'1.2-2' }}</p>
          @if (k.revenue_delta_pct !== null) {
            <p class="text-xs mt-1 flex items-center gap-1"
               [class.text-emerald-100]="k.revenue_delta_pct >= 0"
               [class.text-rose-200]="k.revenue_delta_pct < 0">
              <i class="fa-solid" [class.fa-arrow-trend-up]="k.revenue_delta_pct >= 0" [class.fa-arrow-trend-down]="k.revenue_delta_pct < 0"></i>
              {{ k.revenue_delta_pct >= 0 ? '+' : '' }}{{ k.revenue_delta_pct }}% vs anterior
            </p>
          }
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Órdenes</p>
          <p class="text-3xl font-bold mt-1">{{ k.total_orders }}</p>
          @if (k.orders_delta_pct !== null) {
            <p class="text-xs mt-1 flex items-center gap-1"
               [class.text-emerald-600]="k.orders_delta_pct >= 0"
               [class.text-rose-600]="k.orders_delta_pct < 0">
              <i class="fa-solid" [class.fa-arrow-trend-up]="k.orders_delta_pct >= 0" [class.fa-arrow-trend-down]="k.orders_delta_pct < 0"></i>
              {{ k.orders_delta_pct >= 0 ? '+' : '' }}{{ k.orders_delta_pct }}%
            </p>
          }
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Ticket promedio</p>
          <p class="text-3xl font-bold mt-1">\${{ k.avg_order_value | number:'1.2-2' }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Unidades</p>
          <p class="text-3xl font-bold mt-1">{{ k.items_sold }}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Clientes</p>
          <p class="text-3xl font-bold mt-1">{{ k.unique_customers }}</p>
        </div>
      </div>
    }

    <!-- Timeline + Channel -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <div class="card p-5 lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold tracking-tight">Revenue diario</h3>
          <span class="text-xs text-slate-500">{{ timeline().length }} días</span>
        </div>
        @if (timelineConfig()) {
          <dlx-chart-canvas [config]="timelineConfig()!" [height]="280" />
        }
      </div>
      <div class="card p-5">
        <h3 class="font-bold tracking-tight mb-3">Por canal</h3>
        @if (channelConfig()) {
          <dlx-chart-canvas [config]="channelConfig()!" [height]="280" />
        }
      </div>
    </div>

    <!-- Branches + Categories + Brands -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div class="card p-5">
        <h3 class="font-bold tracking-tight mb-3">Por sucursal</h3>
        @if (branchConfig()) {
          <dlx-chart-canvas [config]="branchConfig()!" [height]="260" />
        }
      </div>
      <div class="card p-5">
        <h3 class="font-bold tracking-tight mb-3">Por categoría</h3>
        @if (categoryConfig()) {
          <dlx-chart-canvas [config]="categoryConfig()!" [height]="260" />
        }
      </div>
      <div class="card p-5">
        <h3 class="font-bold tracking-tight mb-3">Por marca</h3>
        @if (brandConfig()) {
          <dlx-chart-canvas [config]="brandConfig()!" [height]="260" />
        }
      </div>
    </div>

    <!-- Top products -->
    <div class="card overflow-hidden mb-4">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-bold tracking-tight">Top productos</h3>
        <div class="flex gap-2">
          <button (click)="exportPDF()" class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold flex items-center gap-1.5">
            <i class="fa-solid fa-file-pdf text-rose-500"></i> PDF
          </button>
          <button (click)="exportExcel()" class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold flex items-center gap-1.5">
            <i class="fa-solid fa-file-excel text-emerald-600"></i> Excel
          </button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr class="text-left">
            <th class="px-5 py-2.5 font-semibold w-12">#</th>
            <th class="px-5 py-2.5 font-semibold">Producto</th>
            <th class="px-5 py-2.5 font-semibold">Marca</th>
            <th class="px-5 py-2.5 font-semibold text-right">Unidades</th>
            <th class="px-5 py-2.5 font-semibold text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          @for (p of topProducts(); track p.variant__product_id; let i = $index) {
            <tr class="border-t border-slate-100 hover:bg-slate-50/60">
              <td class="px-5 py-3 font-bold text-slate-400">{{ i + 1 }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <img [src]="p.variant__product__main_image_url" alt=""
                       class="w-10 h-10 rounded-lg object-cover bg-slate-100"
                       crossorigin="anonymous" (error)="onImgErr($event)" />
                  <span class="font-medium">{{ p.variant__product__name }}</span>
                </div>
              </td>
              <td class="px-5 py-3 text-slate-600">{{ p.variant__product__brand__name }}</td>
              <td class="px-5 py-3 text-right font-bold">{{ p.units }}</td>
              <td class="px-5 py-3 text-right font-bold text-emerald-600">\${{ p.revenue | number:'1.2-2' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Top sellers + Low stock -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="font-bold tracking-tight">Top vendedores</h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-2.5 font-semibold">Vendedor</th>
              <th class="px-5 py-2.5 font-semibold text-center">Ventas</th>
              <th class="px-5 py-2.5 font-semibold text-right">Revenue</th>
              <th class="px-5 py-2.5 font-semibold text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            @for (s of topSellers(); track s.seller_id) {
              <tr class="border-t border-slate-100">
                <td class="px-5 py-3">
                  <p class="font-medium">{{ s.seller__full_name || s.seller__email }}</p>
                  <p class="text-xs text-slate-500">{{ s.seller__branch__name || '—' }}</p>
                </td>
                <td class="px-5 py-3 text-center font-bold">{{ s.orders }}</td>
                <td class="px-5 py-3 text-right font-bold">\${{ s.revenue | number:'1.2-2' }}</td>
                <td class="px-5 py-3 text-right text-violet-600 font-bold">\${{ s.commission | number:'1.2-2' }}</td>
              </tr>
            }
            @if (topSellers().length === 0) {
              <tr><td colspan="4" class="px-5 py-8 text-center text-slate-400">Sin ventas con vendedor asignado.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="card overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="font-bold tracking-tight flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> Stock bajo
          </h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-2.5 font-semibold">Producto / SKU</th>
              <th class="px-5 py-2.5 font-semibold">Sucursal</th>
              <th class="px-5 py-2.5 font-semibold text-center">Stock</th>
            </tr>
          </thead>
          <tbody>
            @for (l of lowStock(); track $index) {
              <tr class="border-t border-slate-100">
                <td class="px-5 py-3">
                  <p class="font-medium text-xs">{{ l.product_name }}</p>
                  <p class="text-[11px] text-slate-500 font-mono">{{ l.variant_sku }}</p>
                </td>
                <td class="px-5 py-3 text-xs">{{ l.branch_name }}</td>
                <td class="px-5 py-3 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        [class.bg-rose-100]="l.quantity === 0"
                        [class.text-rose-700]="l.quantity === 0"
                        [class.bg-amber-100]="l.quantity > 0"
                        [class.text-amber-700]="l.quantity > 0">
                    {{ l.quantity }} / {{ l.min_threshold }}
                  </span>
                </td>
              </tr>
            }
            @if (lowStock().length === 0) {
              <tr><td colspan="3" class="px-5 py-8 text-center text-slate-400">Todo el stock está sobre el umbral.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ReportsDashboardComponent implements OnInit {
  private svc = inject(ReportsService);
  private adminSvc = inject(AdminService);

  branches = signal<AdminBranch[]>([]);
  branchId: number | null = null;
  presetDays = 30;
  from = '';
  to = '';

  kpis = signal<OverviewKPIs | null>(null);
  timeline = signal<TimelinePoint[]>([]);
  byBranch = signal<BranchRow[]>([]);
  byCategory = signal<CategoryRow[]>([]);
  byBrand = signal<BrandRow[]>([]);
  byChannel = signal<ChannelRow[]>([]);
  topProducts = signal<ProductRow[]>([]);
  topSellers = signal<SellerRow[]>([]);
  lowStock = signal<LowStockRow[]>([]);

  ngOnInit() {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.setPreset(30);
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
      branch: this.branchId || undefined,
    };
  }

  reload() {
    const p = this.params();
    this.svc.overview(p).subscribe(k => this.kpis.set(k));
    this.svc.timeline(p).subscribe(r => this.timeline.set(r.results));
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
    const t = this.timeline();
    if (!t.length) return null;
    return {
      type: 'line',
      data: {
        labels: t.map(p => p.day.slice(5)),
        datasets: [{
          label: 'Revenue ($)',
          data: t.map(p => +p.revenue),
          borderColor: VIOLET,
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } },
        },
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
          label: 'Revenue',
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
          label: 'Revenue',
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

  // ── Exports ───────────────────────────────────────────────────
  exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.timeline()), 'Timeline');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.byBranch()), 'Sucursales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.byCategory()), 'Categorías');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.byBrand()), 'Marcas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.topProducts()), 'Top productos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.topSellers()), 'Vendedores');
    XLSX.writeFile(wb, `Delux-reportes-${this.from}-${this.to}.xlsx`);
  }

  exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('DELUX — Reportes', 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${this.from} → ${this.to}`, 14, 26);

    const k = this.kpis();
    if (k) {
      autoTable(doc, {
        startY: 32,
        head: [['KPI', 'Valor']],
        body: [
          ['Revenue total', `$${k.total_revenue}`],
          ['Órdenes', `${k.total_orders}`],
          ['Ticket promedio', `$${k.avg_order_value}`],
          ['Unidades vendidas', `${k.items_sold}`],
          ['Clientes únicos', `${k.unique_customers}`],
        ],
        headStyles: { fillColor: [11, 14, 22] },
      });
    }

    autoTable(doc, {
      head: [['Producto', 'Marca', 'Unidades', 'Revenue']],
      body: this.topProducts().map(p => [
        p.variant__product__name,
        p.variant__product__brand__name || '—',
        p.units,
        `$${p.revenue}`,
      ]),
      headStyles: { fillColor: [124, 58, 237] },
      didDrawPage: () => {
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      },
    });

    autoTable(doc, {
      head: [['Sucursal', 'Órdenes', 'Revenue']],
      body: this.byBranch().map(b => [b.branch__name, b.orders, `$${b.revenue}`]),
      headStyles: { fillColor: [34, 211, 238] },
    });

    autoTable(doc, {
      head: [['Vendedor', 'Sucursal', 'Ventas', 'Revenue', 'Comisión']],
      body: this.topSellers().map(s => [
        s.seller__full_name || s.seller__email,
        s.seller__branch__name || '—',
        s.orders, `$${s.revenue}`, `$${s.commission}`,
      ]),
      headStyles: { fillColor: [224, 57, 154] },
    });

    doc.save(`Delux-reportes-${this.from}-${this.to}.pdf`);
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
