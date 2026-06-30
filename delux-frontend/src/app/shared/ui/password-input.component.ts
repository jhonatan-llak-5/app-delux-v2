import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

/**
 * Input de contraseña con botón de ojo (mostrar/ocultar). Reutilizable en todo
 * el app. Compatible con [(ngModel)] y formControl (ControlValueAccessor).
 * Uso: <dlx-password-input [(ngModel)]="pw" autocomplete="new-password" placeholder="…" />
 */
@Component({
  selector: 'dlx-password-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DlxPasswordInputComponent),
    multi: true,
  }],
  template: `
    <div class="relative">
      <input [type]="show() ? 'text' : 'password'"
             [value]="value" (input)="onInput($event)" (blur)="onTouched()" (focus)="focused.emit()"
             [disabled]="disabled"
             [attr.autocomplete]="autocomplete" [attr.placeholder]="placeholder"
             [class]="inputClass" />
      <button type="button" (click)="show.set(!show())" tabindex="-1"
              [attr.aria-label]="show() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded
                     text-slate-400 hover:text-slate-700 dark:hover:text-white/80 transition">
        <i class="fa-solid" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()"></i>
      </button>
    </div>
  `,
})
export class DlxPasswordInputComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() autocomplete = '';
  @Input() inputClass = 'eg-input w-full pr-10';
  @Output() focused = new EventEmitter<void>();

  show = signal(false);
  value = '';
  disabled = false;

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  onInput(ev: Event): void {
    this.value = (ev.target as HTMLInputElement).value;
    this.onChange(this.value);
  }
  writeValue(v: string): void { this.value = v || ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}
