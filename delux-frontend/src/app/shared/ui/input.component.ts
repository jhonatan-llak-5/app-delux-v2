import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * <dlx-input
 *   label="Email" type="email" placeholder="tu@correo.com"
 *   iconLeft="fa-magnifying-glass"  iconRight="fa-circle-info"
 *   [(ngModel)]="value" [error]="emailError()" hint="..." />
 *
 * Una sola fuente de verdad para todos los inputs (search, email, password, etc.).
 * Soporta `type=text/email/password/number/url/tel/search/date/time`.
 * Compatible con `[(ngModel)]` y `formControlName`.
 */
@Component({
  selector: 'dlx-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxInputComponent), multi: true },
  ],
  template: `
    <label class="block w-full">
      @if (label) {
        <span class="eg-label">
          {{ label }}
          @if (required) { <span class="text-rose-600">*</span> }
          @if (badge) {
            <span class="eg-badge ml-2"
                  [class.eg-badge-success]="badgeVariant === 'success'"
                  [class.eg-badge-brand]="badgeVariant === 'brand'"
                  [class.eg-badge-warning]="badgeVariant === 'warning'">
              {{ badge }}
            </span>
          }
        </span>
      }
      <div class="relative">
        @if (iconLeft) {
          <i class="fa-solid {{ iconLeft }} absolute left-[14px] top-1/2 -translate-y-1/2
                    text-[14px] pointer-events-none"
             [style.color]="'var(--dash-text-soft)'"></i>
        }
        <input
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [attr.autocomplete]="autocomplete || null"
          [attr.inputmode]="inputmode || null"
          [attr.min]="min ?? null"
          [attr.max]="max ?? null"
          [attr.maxlength]="maxlength ?? null"
          [ngModel]="value"
          (ngModelChange)="onChange($event)"
          (blur)="onBlur()"
          [class]="inputClass()"
        />
        @if (iconRight) {
          <button type="button" tabindex="-1" (click)="iconRightClicked.emit()"
                  class="absolute right-[10px] top-1/2 -translate-y-1/2
                         w-8 h-8 grid place-items-center rounded-md
                         hover:bg-[var(--dash-hover)] transition">
            <i class="fa-solid {{ iconRight }} text-[14px]" [style.color]="'var(--dash-text-muted)'"></i>
          </button>
        }
      </div>
      @if (error) {
        <p class="text-xs mt-1.5" style="color: #dc2626;">
          <i class="fa-solid fa-circle-exclamation text-[10px]"></i> {{ error }}
        </p>
      } @else if (hint) {
        <p class="text-xs mt-1.5" [style.color]="'var(--dash-text-muted)'">{{ hint }}</p>
      }
    </label>
  `,
})
export class DlxInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel' | 'search' | 'date' | 'time' = 'text';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() badge = '';
  @Input() badgeVariant: 'success' | 'brand' | 'warning' = 'success';
  @Input() iconLeft?: string;
  @Input() iconRight?: string;
  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() autocomplete = '';
  @Input() inputmode: 'text' | 'numeric' | 'email' | 'tel' | 'url' | 'search' | '' = '';
  @Input() min?: number;
  @Input() max?: number;
  @Input() maxlength?: number;
  @Input() mono = false;
  @Input() extraClass = '';
  @Output() iconRightClicked = new EventEmitter<void>();

  value: any = '';

  private onTouchedFn = () => {};
  private onChangeFn: (v: any) => void = () => {};

  writeValue(v: any) { this.value = v ?? ''; }
  registerOnChange(fn: any) { this.onChangeFn = fn; }
  registerOnTouched(fn: any) { this.onTouchedFn = fn; }
  setDisabledState(d: boolean) { this.disabled = d; }
  onChange(v: any) { this.value = v; this.onChangeFn(v); }
  onBlur() { this.onTouchedFn(); }

  inputClass(): string {
    const cls = ['eg-input'];
    if (this.iconLeft)  cls.push('has-icon-left');
    if (this.iconRight) cls.push('has-icon-right');
    if (this.mono)      cls.push('font-mono', 'text-[13px]');
    if (this.error)     cls.push('!border-rose-500');
    if (this.extraClass) cls.push(this.extraClass);
    return cls.join(' ');
  }
}
