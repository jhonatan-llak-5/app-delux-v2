import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Contador de cantidad editable: − / campo escribible / +.
 *
 * El campo acepta SOLO dígitos (nada de signos, decimales ni "e") y se puede
 * escribir a mano, no solo con los botones. Mientras se edita puede quedar
 * vacío: en ese caso emite `null` para que la pantalla que lo usa bloquee su
 * acción (p. ej. el botón Cobrar del POS) en vez de enviar una cantidad basura.
 *
 * <dlx-qty-input [ngModel]="item.quantity" (ngModelChange)="setQty(i, $event)"
 *                [max]="item.max_stock" />
 */
@Component({
  selector: 'dlx-qty-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxQtyInputComponent), multi: true },
  ],
  template: `
    <div [class]="'inline-flex items-center gap-1 rounded-lg border p-0.5 bg-white dark:bg-white/10 transition ' +
                  (invalid() ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-white/10') +
                  ' ' + extraClass">
      <button type="button" (click)="step(-1)" [disabled]="disabled() || atMin()"
              [attr.aria-label]="'Quitar uno'" title="Quitar uno"
              class="w-6 h-6 rounded-md grid place-items-center text-sm font-bold
                     hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">−</button>

      <!-- Fondo gris en claro: sin él, el campo se confunde con el contenedor y
           no se ve que es escribible. En oscuro el contraste ya lo da el
           contenedor, así que se deja transparente. -->
      <input type="text" inputmode="numeric" autocomplete="off"
             [value]="display()" (input)="onInput($event)" (blur)="onBlur()"
             [disabled]="disabled()" [attr.aria-label]="ariaLabel"
             [attr.aria-invalid]="invalid() ? 'true' : null"
             [class]="'text-center text-sm font-bold outline-none rounded-md py-0.5 px-1 transition ' +
                      'bg-slate-100 dark:bg-transparent ' +
                      'focus:bg-white dark:focus:bg-white/10 ' +
                      'focus:ring-2 focus:ring-[var(--dash-primary)]/35 ' +
                      (invalid() ? 'text-rose-600 dark:text-rose-400 ' : '') + inputClass" />

      <button type="button" (click)="step(1)" [disabled]="disabled() || atMax()"
              [attr.aria-label]="'Agregar uno'" title="Agregar uno"
              class="w-6 h-6 rounded-md grid place-items-center text-sm font-bold
                     hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
    </div>
  `,
})
export class DlxQtyInputComponent implements ControlValueAccessor {
  /** Cantidad mínima aceptada. Por debajo, el valor se considera inválido. */
  @Input() min = 1;
  /** Cantidad máxima (p. ej. el stock disponible). null = sin tope. */
  @Input() max: number | null = null;
  /** Clases extra para el contenedor. */
  @Input() extraClass = '';
  /** Clases del campo (ancho, sobre todo). */
  @Input() inputClass = 'w-9';
  /** Si es true, dejarlo vacío es válido (vale 0): p. ej. contar billetes,
   *  donde no tener ninguno de una denominación es normal. */
  @Input() allowEmpty = false;
  @Input() ariaLabel = 'Cantidad';
  /** Se emite al perder el foco (para guardar en blur si hace falta). */
  @Output() blurred = new EventEmitter<void>();

  display = signal('');
  disabled = signal(false);

  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  /** Valor actual, o null si el campo está vacío. */
  value(): number | null {
    const raw = this.display();
    return raw === '' ? null : Number(raw);
  }

  /** true cuando el valor no sirve para enviar: vacío o fuera de rango. */
  invalid(): boolean {
    const v = this.value();
    if (v === null) return !this.allowEmpty;
    return v < this.min || (this.max != null && v > this.max);
  }

  atMin(): boolean { const v = this.value(); return v !== null && v <= this.min; }
  atMax(): boolean { const v = this.value(); return this.max != null && v !== null && v >= this.max; }

  writeValue(v: any): void {
    if (v === null || v === undefined || v === '') { this.display.set(''); return; }
    const n = Math.trunc(Number(v));
    this.display.set(Number.isFinite(n) ? String(n) : '');
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  onBlur(): void { this.onTouched(); this.blurred.emit(); }

  onInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    // Solo dígitos: descarta pegados con letras, signos o decimales.
    let raw = (el.value || '').replace(/[^0-9]/g, '');
    // Sin ceros a la izquierda, pero dejando escribir un "0" suelto (inválido
    // si min es 1, que es justo lo que debe bloquear el envío).
    if (raw.length > 1) raw = raw.replace(/^0+/, '') || '0';
    // Nunca por encima del tope (no se puede vender más del stock disponible).
    if (raw !== '' && this.max != null && Number(raw) > this.max) raw = String(this.max);
    // El binding [value] no repinta si display() no cambió: hay que reflejar el
    // saneo en el DOM a mano o el usuario vería lo que escribió mal.
    if (el.value !== raw) el.value = raw;

    this.display.set(raw);
    this.onChange(raw === '' ? null : Number(raw));
  }

  step(delta: number): void {
    if (this.disabled()) return;
    const cur = this.value();
    // Desde vacío, cualquiera de los dos botones deja el mínimo.
    let next = cur === null ? this.min : cur + delta;
    if (next < this.min) next = this.min;
    if (this.max != null && next > this.max) next = this.max;
    this.display.set(String(next));
    this.onChange(next);
  }
}
