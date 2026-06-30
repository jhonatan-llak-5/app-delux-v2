import { ChangeDetectionStrategy, Component, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Campo de precio/costo reutilizable con símbolo de moneda.
 * El símbolo no se encima con el número (usa padding dedicado .has-prefix).
 *
 * <dlx-price-input [(ngModel)]="precio" extraClass="!h-9 w-full" />
 */
@Component({
  selector: 'dlx-price-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxPriceInputComponent), multi: true },
  ],
  template: `
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">{{ symbol }}</span>
      <input type="number" [min]="min" step="0.01" [attr.placeholder]="placeholder"
             [ngModel]="value()" (ngModelChange)="onInput($event)" (blur)="onTouched()"
             [disabled]="disabled()"
             [class]="'eg-input has-prefix ' + extraClass" />
    </div>
  `,
})
export class DlxPriceInputComponent implements ControlValueAccessor {
  @Input() symbol = '$';
  @Input() min = 0;
  @Input() placeholder = '0';
  @Input() extraClass = 'w-full';
  /** Si es true, dejar el campo vacío emite null en vez de 0 (para precios opcionales). */
  @Input() nullable = false;

  value = signal<number | null>(0);
  disabled = signal(false);
  private onChange: (v: number | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: any): void { this.value.set(v ?? (this.nullable ? null : 0)); }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
  onInput(v: any): void {
    if (this.nullable && (v === '' || v === null || v === undefined)) {
      this.value.set(null); this.onChange(null); return;
    }
    const n = +v || 0; this.value.set(n); this.onChange(n);
  }
}
