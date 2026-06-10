import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DlxSelectOption { value: any; label: string; }

@Component({
  selector: 'dlx-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxSelectComponent), multi: true },
  ],
  template: `
    <label class="block">
      @if (label) {
        <span class="eg-label">
          {{ label }}
          @if (required) { <span class="text-rose-600">*</span> }
        </span>
      }
      <select [disabled]="disabled"
              [ngModel]="value" (ngModelChange)="onChange($event)" (blur)="onBlur()"
              class="eg-input">
        @if (placeholder) { <option [ngValue]="null">{{ placeholder }}</option> }
        @for (opt of options; track opt.value) {
          <option [ngValue]="opt.value">{{ opt.label }}</option>
        }
      </select>
      @if (hint) { <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{{ hint }}</p> }
    </label>
  `,
})
export class DlxSelectComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() options: DlxSelectOption[] = [];

  value: any = null;
  private onTouchedFn = () => {};
  private onChangeFn: (v: any) => void = () => {};
  writeValue(v: any) { this.value = v ?? null; }
  registerOnChange(fn: any) { this.onChangeFn = fn; }
  registerOnTouched(fn: any) { this.onTouchedFn = fn; }
  setDisabledState(d: boolean) { this.disabled = d; }
  onChange(v: any) { this.value = v; this.onChangeFn(v); }
  onBlur() { this.onTouchedFn(); }
}
