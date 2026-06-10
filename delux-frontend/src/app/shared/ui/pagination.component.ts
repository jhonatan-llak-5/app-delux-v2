import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * <dlx-pagination
 *   [page]="page()" [pageSize]="size()" [total]="total()"
 *   (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)" />
 *
 * Page sizes default: 25, 50, 100. Override con [pageSizes]="[10,20,50]"
 */
@Component({
  selector: 'dlx-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-4 flex-wrap py-3 px-1 text-sm">
      <!-- Info + page size -->
      <div class="flex items-center gap-3 text-[var(--dash-text-muted)]">
        <span>{{ rangeText() }}</span>
        <span class="text-[var(--dash-text-soft)]">·</span>
        <span class="flex items-center gap-2">
          <span>Mostrar</span>
          <select [ngModel]="pageSize" (ngModelChange)="onSizeChange($event)"
                  class="h-8 px-2 rounded-md border bg-[var(--dash-input)] text-[var(--dash-text)]"
                  [style.border-color]="'var(--dash-input-bord)'">
            @for (s of pageSizes; track s) {
              <option [ngValue]="s">{{ s }}</option>
            }
          </select>
          <span>por página</span>
        </span>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-1">
        <button type="button" (click)="goto(1)" [disabled]="page === 1"
                class="eg-action-btn" aria-label="Primera">
          <i class="fa-solid fa-angles-left text-[11px]"></i>
        </button>
        <button type="button" (click)="goto(page - 1)" [disabled]="page === 1"
                class="eg-action-btn" aria-label="Anterior">
          <i class="fa-solid fa-chevron-left text-[11px]"></i>
        </button>
        @for (p of pageNumbers(); track p) {
          @if (p === -1) {
            <span class="px-2 text-[var(--dash-text-soft)]">…</span>
          } @else {
            <button type="button" (click)="goto(p)"
                    class="min-w-[34px] h-8 px-2 rounded-md text-[13px] font-medium transition"
                    [class.bg-[var(--dash-primary)]]="p === page"
                    [class.text-white]="p === page"
                    [class.text-[var(--dash-text-muted)]]="p !== page"
                    [class.hover:bg-[var(--dash-hover)]]="p !== page">
              {{ p }}
            </button>
          }
        }
        <button type="button" (click)="goto(page + 1)" [disabled]="page >= totalPages()"
                class="eg-action-btn" aria-label="Siguiente">
          <i class="fa-solid fa-chevron-right text-[11px]"></i>
        </button>
        <button type="button" (click)="goto(totalPages())" [disabled]="page >= totalPages()"
                class="eg-action-btn" aria-label="Última">
          <i class="fa-solid fa-angles-right text-[11px]"></i>
        </button>
      </div>
    </div>
  `,
})
export class DlxPaginationComponent {
  @Input() page = 1;
  @Input() pageSize = 25;
  @Input() total = 0;
  @Input() pageSizes = [25, 50, 100];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  totalPages = computed(() => Math.max(1, Math.ceil(this.total / this.pageSize)));

  rangeText() {
    if (!this.total) return 'Sin resultados';
    const start = (this.page - 1) * this.pageSize + 1;
    const end   = Math.min(this.page * this.pageSize, this.total);
    return `${start}–${end} de ${this.total}`;
  }

  pageNumbers(): number[] {
    const tp = this.totalPages();
    const cur = this.page;
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, -1, tp];
    if (cur >= tp - 3) return [1, -1, tp - 4, tp - 3, tp - 2, tp - 1, tp];
    return [1, -1, cur - 1, cur, cur + 1, -1, tp];
  }

  goto(p: number) {
    const tp = this.totalPages();
    if (p < 1 || p > tp || p === this.page) return;
    this.pageChange.emit(p);
  }

  onSizeChange(s: number) {
    if (s !== this.pageSize) this.pageSizeChange.emit(s);
  }
}
