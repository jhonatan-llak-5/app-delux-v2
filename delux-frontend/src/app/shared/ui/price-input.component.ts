import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Campo estándar para montos/decimales (precios, costos, IVA, vuelto, etc.).
 * Usa type="text" + inputmode="decimal" para aceptar el punto SIN que el
 * navegador (según su idioma) borre el valor u obligue a usar coma. Acepta
 * punto o coma y siempre emite un número con punto decimal.
 * El símbolo no se encima con el número (padding .has-prefix).
 *
 * <dlx-price-input [(ngModel)]="precio" extraClass="!h-9 w-full" />
 * <dlx-price-input [(ngModel)]="iva" symbol="%" />
 */
@Component({
  selector: 'dlx-price-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxPriceInputComponent), multi: true },
  ],
  template: `
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">{{ symbol }}</span>
      <input type="text" inputmode="decimal" [attr.placeholder]="placeholder"
             [value]="display()" (input)="onInput($event)" (blur)="onBlur()"
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
  /** Si es true, dejar el campo vacío emite null en vez de 0 (para valores opcionales). */
  @Input() nullable = false;
  /** Se emite al perder el foco (para guardar en blur, como en editar-en-tabla). */
  @Output() blurred = new EventEmitter<void>();

  display = signal('');
  disabled = signal(false);
  private onChange: (v: number | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: any): void {
    const num = v ?? (this.nullable ? null : 0);
    this.display.set(num === null || num === undefined ? '' : String(num));
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  onBlur(): void { this.onTouched(); this.blurred.emit(); }

  onInput(ev: Event): void {
    // Sanea: dígitos y un único separador decimal (coma -> punto).
    let raw = ((ev.target as HTMLInputElement).value || '').replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
    this.display.set(raw);

    if (raw === '' ) { this.onChange(this.nullable ? null : 0); return; }
    if (raw === '.') { this.onChange(this.nullable ? null : 0); return; }
    const n = parseFloat(raw);
    this.onChange(Number.isNaN(n) ? (this.nullable ? null : 0) : n);
  }
}
