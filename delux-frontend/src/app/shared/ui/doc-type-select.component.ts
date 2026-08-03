import { ChangeDetectionStrategy, Component, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Tipos de identificación del SRI (Ecuador), con sus códigos oficiales. */
export const SRI_DOC_TYPES = [
  { v: '05', label: 'Cédula' },
  { v: '04', label: 'RUC' },
  { v: '06', label: 'Pasaporte' },
  { v: '07', label: 'Consumidor final' },
  { v: '08', label: 'Identificación del exterior' },
  { v: '09', label: 'Placa' },
];

/**
 * Selector reutilizable de "Identificación SRI" (tipo de documento).
 * Implementa ControlValueAccessor, así que funciona con `[(ngModel)]`.
 * `excludeConsumerFinal` oculta "Consumidor final" (útil donde eso se maneja
 * con un check aparte, como el popup de emisión de factura).
 */
@Component({
  selector: 'dlx-doc-type-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DlxDocTypeSelectComponent),
    multi: true,
  }],
  template: `
    <select [ngModel]="value()" (ngModelChange)="onSelect($event)" [disabled]="disabled()"
            class="eg-input w-full text-sm disabled:opacity-60">
      @for (t of types; track t.v) {
        <option [value]="t.v">{{ t.label }}</option>
      }
    </select>
  `,
})
export class DlxDocTypeSelectComponent implements ControlValueAccessor {
  @Input() excludeConsumerFinal = false;

  value = signal('05');
  disabled = signal(false);

  get types() {
    return this.excludeConsumerFinal
      ? SRI_DOC_TYPES.filter(t => t.v !== '07')
      : SRI_DOC_TYPES;
  }

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v || '05'); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  onSelect(v: string): void {
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }
}
