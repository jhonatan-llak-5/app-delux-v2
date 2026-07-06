import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { AuthService } from '@core/services/auth.service';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

import { Stock, InventorySummary, InventoryService } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { RowActionsComponent, RowAction } from '@shared/ui/row-actions.component';
import { onImageError, imgOrPlaceholder } from '@shared/utils/img-placeholder';
import { StockAdjustModalComponent } from '@features/superadmin/components/stock-adjust-modal/stock-adjust-modal.component';
import { TransferModalComponent } from '@features/superadmin/components/transfer-modal/transfer-modal.component';
import { printProductLabels } from '@shared/utils/print-labels';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { DlxPaginationComponent } from '@shared/ui/pagination.component';

@Component({
  selector: 'dlx-inventory-overview',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxStatCardComponent, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, StockAdjustModalComponent, TransferModalComponent, RowActionsComponent, DlxPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-overview.component.html',
})
export class InventoryOverviewComponent implements OnInit {
  protected auth = inject(AuthService);
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);
  private branchCtx = inject(BranchContextService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);
  private inited = false;

  constructor() {
    effect(() => {
      const b = this.branchCtx.current();
      if (this.inited) { this.branchFilter = b; this.reload(); }
    });
  }

  stocks = signal<Stock[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(50);
  summary = signal<InventorySummary | null>(null);
  branches = signal<AdminBranch[]>([]);
  loading = signal(true);

  search = signal('');
  branchFilter: number | null = null;
  lowOnly = false;
  outOnly = false;
  private search$ = new Subject<void>();

  adjustStock = signal<Stock | null>(null);
  transferStock = signal<Stock | null>(null);

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    this.branchFilter = this.branchCtx.current();
    this.reload();
    this.inited = true;
  }

  reload(): void {
    this.loading.set(true);
    this.svc.summary(this.branchFilter || undefined).subscribe(s => this.summary.set(s));
    this.svc.stocks({
      search: this.search(),
      branch: this.branchFilter || undefined,
      low_stock: this.lowOnly,
      out_of_stock: this.outOnly,
      page: this.page(), page_size: this.pageSize(),
    }).subscribe({
      next: r => { this.stocks.set(r.results); this.total.set(r.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) { this.search.set(v); this.page.set(1); this.search$.next(); }
  onFilter() { this.page.set(1); this.reload(); }
  onPage(p: number) { this.page.set(p); this.reload(); }
  onSize(s: number) { this.pageSize.set(s); this.page.set(1); this.reload(); }

  setBranchFilter(id: number) {
    this.branchFilter = this.branchFilter === id ? null : id;
    this.reload();
  }

  rowActions(s: Stock): RowAction[] {
    return [
      { label: 'Ajustar', icon: 'fa-pen', run: () => this.openAdjust(s) },
      { label: 'Transferir', icon: 'fa-truck', disabled: s.quantity === 0, run: () => this.openTransfer(s) },
      { label: 'Imprimir etiqueta', icon: 'fa-barcode', run: () => this.printLabel(s) },
    ];
  }

  printLabel(s: Stock): void {
    const price = s.price_override != null ? +s.price_override : +s.base_price || 0;
    printProductLabels(
      [{ sku: s.variant_sku, name: s.product_name, size: s.variant_size, price, quantity: 1 }],
      { store: this.branding.siteName(), taxRate: this.branding.taxRate(), onError: m => this.notify.error(m) },
    );
  }

  openAdjust(s: Stock) { this.adjustStock.set(s); }
  openTransfer(s: Stock) { this.transferStock.set(s); }

  onAdjusted() {
    this.adjustStock.set(null);
    this.reload();
  }
  onTransferred() {
    this.transferStock.set(null);
    this.reload();
  }

  imgSrc(u?: string | null): string { return imgOrPlaceholder(u); }
}
