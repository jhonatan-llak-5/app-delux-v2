import { ChangeDetectionStrategy, Component, ContentChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxPaginationComponent } from './pagination.component';

export interface DlxTableColumn<T = any> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** Si quieres render custom usa la template #cell con let-row let-col en lugar de string */
  format?: (value: any, row: T) => string;
}

/**
 * <dlx-table
 *   [columns]="cols" [rows]="rows()" [total]="total()" [loading]="loading()"
 *   [page]="page()" [pageSize]="size()"
 *   (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)"
 *   (rowClick)="open($event)">
 *
 *   <!-- Cell custom render -->
 *   <ng-template #cell let-row let-col="col">
 *     @if (col.key === 'status') {
 *       <span class="eg-badge eg-badge-success">{{ row.status }}</span>
 *     } @else {
 *       {{ row[col.key] }}
 *     }
 *   </ng-template>
 *
 *   <!-- Actions slot a la derecha de cada fila -->
 *   <ng-template #actions let-row>
 *     <dlx-action-btn icon="fa-pen" (clicked)="edit(row)" />
 *   </ng-template>
 * </dlx-table>
 */
@Component({
  selector: 'dlx-table',
  standalone: true,
  imports: [CommonModule, DlxPaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eg-table-wrap">
      <div class="overflow-x-auto">
        <table class="eg-table">
          <thead>
            <tr>
              @for (col of columns; track col.key) {
                <th [style.width]="col.width || null"
                    [class.text-center]="col.align === 'center'"
                    [class.text-right]="col.align === 'right'">
                  {{ col.label }}
                </th>
              }
              @if (actionsTpl) {
                <th class="text-right" style="width:140px;">Acciones</th>
              }
            </tr>
          </thead>
          <tbody>
            @if (loading) {
              <tr>
                <td [attr.colspan]="(columns.length + (actionsTpl ? 1 : 0))"
                    class="text-center py-12 text-[var(--dash-text-muted)]">
                  <i class="fa-solid fa-spinner fa-spin text-xl mb-2"></i>
                  <p>Cargando…</p>
                </td>
              </tr>
            } @else if (!rows || rows.length === 0) {
              <tr>
                <td [attr.colspan]="(columns.length + (actionsTpl ? 1 : 0))"
                    class="text-center py-12 text-[var(--dash-text-muted)]">
                  <i class="fa-solid {{ emptyIcon }} text-3xl mb-3 block"></i>
                  <p class="font-semibold mb-1">{{ emptyTitle }}</p>
                  @if (emptyDescription) {
                    <p class="text-xs">{{ emptyDescription }}</p>
                  }
                </td>
              </tr>
            } @else {
              @for (row of rows; track trackBy(row, $index); let i = $index) {
                <tr [class.cursor-pointer]="rowClickable"
                    (click)="rowClickable ? rowClick.emit(row) : null">
                  @for (col of columns; track col.key) {
                    <td [class.text-center]="col.align === 'center'"
                        [class.text-right]="col.align === 'right'">
                      @if (cellTpl) {
                        <ng-container
                          [ngTemplateOutlet]="cellTpl"
                          [ngTemplateOutletContext]="{ $implicit: row, col, i }"></ng-container>
                      } @else if (col.format) {
                        {{ col.format(getCell(row, col.key), row) }}
                      } @else {
                        {{ getCell(row, col.key) }}
                      }
                    </td>
                  }
                  @if (actionsTpl) {
                    <td class="text-right" (click)="$event.stopPropagation()">
                      <div class="flex items-center justify-end gap-1">
                        <ng-container
                          [ngTemplateOutlet]="actionsTpl"
                          [ngTemplateOutletContext]="{ $implicit: row, i }"></ng-container>
                      </div>
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (showPagination && total > 0) {
        <div class="border-t" [style.border-color]="'var(--dash-border)'">
          <dlx-pagination
            [page]="page" [pageSize]="pageSize" [total]="total" [pageSizes]="pageSizes"
            (pageChange)="pageChange.emit($event)"
            (pageSizeChange)="pageSizeChange.emit($event)" />
        </div>
      }
    </div>
  `,
})
export class DlxTableComponent<T = any> {
  @Input({ required: true }) columns: DlxTableColumn<T>[] = [];
  @Input({ required: true }) rows: T[] | null = [];
  @Input() total = 0;
  @Input() loading = false;
  @Input() page = 1;
  @Input() pageSize = 25;
  @Input() pageSizes = [25, 50, 100];
  @Input() showPagination = true;
  @Input() rowClickable = false;
  @Input() emptyIcon = 'fa-inbox';
  @Input() emptyTitle = 'Sin resultados';
  @Input() emptyDescription = '';
  @Input() trackByKey = 'id';

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() rowClick = new EventEmitter<T>();

  @ContentChild('cell', { static: false }) cellTpl?: TemplateRef<any>;
  @ContentChild('actions', { static: false }) actionsTpl?: TemplateRef<any>;

  trackBy = (row: any, idx: number) => row?.[this.trackByKey] ?? idx;

  /** Acceso seguro a propiedades anidadas: 'branch.name', 'user.email', etc. */
  getCell(row: any, key: string): any {
    if (row == null) return '';
    if (!key.includes('.')) return row[key];
    return key.split('.').reduce((acc: any, k) => (acc == null ? acc : acc[k]), row);
  }
}
