import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from '@shared/ui/modal.component';
import { FormsModule } from '@angular/forms';
import { Stock, InventoryService } from '@features/superadmin/services/inventory.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-transfer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DlxModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="true" [maxWidth]="520"
               [title]="'Transferir stock'"
               (closed)="close.emit()">
      <div class="space-y-4">
          <div class="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <img [src]="stock.product_main_image" [alt]="stock.product_name"
                 class="w-14 h-14 rounded-lg object-cover bg-white"
                 crossorigin="anonymous" (error)="onImgErr($event)" />
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate">{{ stock.product_name }}</p>
              <p class="text-xs text-slate-500 font-mono">
                {{ stock.variant_sku }} · {{ stock.variant_size }} · {{ stock.variant_color }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label class="eg-label">Desde</label>
              <div class="p-3 rounded-lg bg-rose-50 border border-rose-200">
                <p class="text-sm font-semibold">{{ stock.branch_name }}</p>
                <p class="text-xs text-slate-500">{{ stock.quantity }} disponibles</p>
              </div>
            </div>
            <i class="fa-solid fa-arrow-right text-slate-400 mb-3"></i>
            <div>
              <label class="eg-label">Hacia *</label>
              <select [(ngModel)]="toBranchId"
                      class="eg-input">
                <option [ngValue]="null">— Sucursal destino —</option>
                @for (b of otherBranches(); track b.id) {
                  <option [ngValue]="b.id">{{ b.name }} ({{ b.code }})</option>
                }
              </select>
              @if (fe('to_branch_id')) { <p class="text-xs text-rose-600 mt-1">{{ fe('to_branch_id') }}</p> }
            </div>
          </div>

          <div>
            <label class="eg-label">Cantidad a transferir *</label>
            <div class="flex items-center gap-2">
              <button type="button" (click)="qty.set(Math.max(1, qty() - 1))"
                      class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center">
                <i class="fa-solid fa-minus text-sm"></i>
              </button>
              <input type="number" [ngModel]="qty()" (ngModelChange)="qty.set(+$event || 0)"
                     [max]="stock.quantity" min="1"
                     class="eg-input flex-1 text-center text-lg font-bold" />
              <button type="button" (click)="qty.set(Math.min(stock.quantity, qty() + 1))"
                      class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center">
                <i class="fa-solid fa-plus text-sm"></i>
              </button>
              <button type="button" (click)="qty.set(stock.quantity)"
                      class="px-3 py-2.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-semibold">
                Máx
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">Máximo disponible: {{ stock.quantity }}</p>
            @if (fe('quantity')) { <p class="text-xs text-rose-600 mt-1">{{ fe('quantity') }}</p> }
          </div>

          <div>
            <label class="eg-label">Nota (opcional)</label>
            <input [(ngModel)]="note" maxlength="240"
                   class="eg-input"
                   placeholder="ej. Reabastecimiento mensual" />
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" (click)="close.emit()"
                    class="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
              Cancelar
            </button>
            <button type="button" (click)="transfer()"
                    [disabled]="!toBranchId || qty() < 1 || qty() > stock.quantity || saving()"
                    class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold
                           hover:bg-violet-700 disabled:opacity-50 transition">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> }
              @else { <i class="fa-solid fa-truck"></i> Transferir }
            </button>
          </div>
        </div>
    </dlx-modal>
  `,
})
export class TransferModalComponent implements OnInit {
  private svc = inject(InventoryService);
  private adminSvc = inject(AdminService);
  Math = Math;

  @Input({ required: true }) stock!: Stock;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  branches = signal<AdminBranch[]>([]);
  toBranchId: number | null = null;
  qty = signal(1);
  note = '';
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  ngOnInit() {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
  }

  otherBranches() {
    return this.branches().filter(b => b.id !== this.stock.branch);
  }

  transfer() {
    this.error.set(null);
    if (!this.toBranchId) { this.fieldErrors.set({ to_branch_id: 'Selecciona la sucursal destino.' }); return; }
    this.fieldErrors.set({});
    this.saving.set(true);
    this.svc.transfer({
      variant_id: this.stock.variant,
      from_branch_id: this.stock.branch,
      to_branch_id: this.toBranchId,
      quantity: this.qty(),
      note: this.note,
    }).subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(Object.keys(p.fieldErrors).length ? p.fieldErrors : { quantity: p.message || 'Error en transferencia' });
      },
    });
  }

  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.close.emit(); }
  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
