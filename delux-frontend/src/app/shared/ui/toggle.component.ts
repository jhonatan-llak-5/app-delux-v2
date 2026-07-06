import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Interruptor (toggle) reutilizable. Implementa ControlValueAccessor, así que
 * se usa con `formControlName` o `[(ngModel)]` en cualquier formulario.
 *
 *   <dlx-toggle formControlName="active" label="Envío activo" />
 *   <dlx-toggle formControlName="on" />   (variante compacta, solo el switch + texto)
 */
@Component({
  selector: 'dlx-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxToggleComponent), multi: true },
  ],
  template: `
    @if (label) {
      <div class="block">
        <span class="eg-label">{{ label }}</span>
        <div class="flex items-center gap-3 h-11 px-3.5 rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0b1220]"
             [class.opacity-50]="disabled">
          <span class="eg-switch" [class.is-on]="value" (click)="toggle()" role="switch"
                [attr.aria-checked]="value"></span>
          <span class="text-sm text-slate-700 dark:text-slate-300">
            {{ value ? onLabel : offLabel }}
          </span>
        </div>
        @if (hint) { <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{{ hint }}</p> }
      </div>
    } @else {
      <span class="inline-flex items-center gap-3" [class.opacity-50]="disabled">
        <span class="eg-switch" [class.is-on]="value" (click)="toggle()" role="switch"
              [attr.aria-checked]="value"></span>
        <span class="text-sm text-slate-700 dark:text-slate-300">{{ value ? onLabel : offLabel }}</span>
      </span>
    }
  `,
})
export class DlxToggleComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() onLabel = 'Activado';
  @Input() offLabel = 'Desactivado';
  @Input() disabled = false;

  private cdr = inject(ChangeDetectorRef);
  value = false;
  private onChangeFn: (v: boolean) => void = () => {};
  private onTouchedFn = () => {};
  writeValue(v: boolean) { this.value = !!v; this.cdr.markForCheck(); }
  registerOnChange(fn: any) { this.onChangeFn = fn; }
  registerOnTouched(fn: any) { this.onTouchedFn = fn; }
  setDisabledState(d: boolean) { this.disabled = d; this.cdr.markForCheck(); }
  toggle() {
    if (this.disabled) return;
    this.value = !this.value;
    this.onChangeFn(this.value);
    this.onTouchedFn();
    this.cdr.markForCheck();
  }
}
