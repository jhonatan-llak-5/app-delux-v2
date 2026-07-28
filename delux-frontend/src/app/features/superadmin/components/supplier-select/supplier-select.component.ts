import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InventoryService, Supplier } from '@features/superadmin/services/inventory.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { SupplierFormModalComponent } from '@features/superadmin/components/supplier-form-modal/supplier-form-modal.component';

/**
 * Selector de proveedor reutilizable (el mismo del Paso 1 de recepción):
 * input con autocompletado + dropdown de proveedores + botón "+" que abre el
 * formulario completo de proveedor. Funciona con [(ngModel)] (guarda el nombre).
 */
@Component({
  selector: 'dlx-supplier-select',
  standalone: true,
  imports: [CommonModule, FormsModule, SupplierFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SupplierSelectComponent),
    multi: true,
  }],
  template: `
    <div class="flex gap-2">
      <div class="relative flex-1">
        <input [ngModel]="value" (ngModelChange)="onInput($event)"
               (focus)="open.set(true)" (blur)="closeSoon()"
               class="eg-input w-full transition" [class.!border-emerald-400]="value.trim()"
               [placeholder]="placeholder" autocomplete="off" />
        @if (value.trim()) { <i class="fa-solid fa-circle-check text-emerald-500 text-sm absolute right-3 top-1/2 -translate-y-1/2"></i> }
        @if (open() && filtered().length) {
          <div class="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl py-1
                      bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
            @for (sp of filtered(); track sp.id) {
              <button type="button" (click)="pick(sp.name)"
                      class="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center gap-2">
                <i class="fa-solid fa-truck-field text-slate-400 text-xs"></i> {{ sp.name }}
              </button>
            }
          </div>
        }
      </div>
      <button type="button" class="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition"
              (click)="showModal.set(true)" title="Agregar proveedor con todos sus datos">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>

    @if (showModal()) {
      <dlx-supplier-form-modal [initialName]="value"
                               (saved)="onCreated($event)" (cancel)="showModal.set(false)" />
    }
  `,
})
export class SupplierSelectComponent implements ControlValueAccessor {
  private inv = inject(InventoryService);
  private notify = inject(NotifyService);

  @Input() placeholder = 'Nombre del proveedor';
  /** Se emite además del cambio de ngModel, para que el padre persista su estado. */
  @Output() changed = new EventEmitter<string>();

  value = '';
  suppliers = signal<Supplier[]>([]);
  open = signal(false);
  showModal = signal(false);

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.inv.listSuppliers().subscribe(r => this.suppliers.set(r.results || []));
  }

  filtered(): Supplier[] {
    const q = this.value.trim().toLowerCase();
    const list = this.suppliers();
    return (q ? list.filter(s => s.name.toLowerCase().includes(q)) : list).slice(0, 8);
  }

  onInput(v: string): void {
    this.value = v || '';
    this.open.set(true);
    this.onChange(this.value);
    this.changed.emit(this.value);
  }
  pick(name: string): void {
    this.value = name;
    this.open.set(false);
    this.onChange(this.value);
    this.changed.emit(this.value);
  }
  closeSoon(): void { setTimeout(() => { this.open.set(false); this.onTouched(); }, 150); }

  onCreated(s: Supplier): void {
    this.suppliers.update(l => [s, ...l.filter(x => x.id !== s.id)]);
    this.value = s.name;
    this.showModal.set(false);
    this.onChange(this.value);
    this.changed.emit(this.value);
    this.notify.success('Proveedor guardado');
  }

  // ── ControlValueAccessor ──
  writeValue(v: string): void { this.value = v || ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
