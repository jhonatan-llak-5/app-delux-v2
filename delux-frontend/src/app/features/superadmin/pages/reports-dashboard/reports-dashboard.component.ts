import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { AuthService } from '@core/services/auth.service';
import { DlxStatCardComponent } from '@shared/ui';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [ImgFallbackDirective, DlxStatCardComponent, CommonModule, FormsModule, ChartCanvasComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-dashboard.component.html',
})
export class ReportsDashboardComponent implements OnInit {
  protected auth = inject(AuthService);
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

}
