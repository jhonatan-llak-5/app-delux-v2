import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'dlx-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxTextareaComponent), multi: true },
  ],
  template: `
    <label class="block">
      @if (label) {
        <span class="eg-label">
          {{ label }}
          @if (required) { <span class="text-rose-600">*</span> }
        </span>
      }
      <textarea
        [placeholder]="placeholder"
        [disabled]="disabled"
        [readonly]="readonly"
        [rows]="rows"
        [attr.maxlength]="maxlength ?? null"
        [ngModel]="value"
        (ngModelChange)="onChange($event)"
        (blur)="onBlur()"
        [class.eg-input]="true"
        [class.!border-rose-500]="!!error"
      ></textarea>
      @if (error) {
        <p class="text-xs text-rose-600 dark:text-rose-400 mt-1.5">{{ error }}</p>
      } @else if (hint) {
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{{ hint }}</p>
      }
    </label>
  `,
})
export class DlxTextareaComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() rows = 4;
  @Input() maxlength?: number;

  value: any = '';
  private onTouchedFn = () => {};
  private onChangeFn: (v: any) => void = () => {};
  writeValue(v: any) { this.value = v ?? ''; }
  registerOnChange(fn: any) { this.onChangeFn = fn; }
  registerOnTouched(fn: any) { this.onTouchedFn = fn; }
  setDisabledState(d: boolean) { this.disabled = d; }
  onChange(v: any) { this.value = v; this.onChangeFn(v); }
  onBlur() { this.onTouchedFn(); }
}
