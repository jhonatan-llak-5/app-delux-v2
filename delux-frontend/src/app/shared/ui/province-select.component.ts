import { ChangeDetectionStrategy, Component, Input, computed, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { EC_PROVINCES } from '@shared/data/ecuador';

/**
 * Selector de provincia (Ecuador) con buscador. Compatible con [(ngModel)].
 * Uso: <dlx-province-select [(ngModel)]="prov" placeholder="Provincia" />
 */
@Component({
  selector: 'dlx-province-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxProvinceSelectComponent), multi: true }],
  template: `
    <div class="relative">
      <i class="fa-solid fa-location-dot text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input [value]="query()" (input)="onInput($event)" (focus)="open.set(true)" (blur)="closeSoon()"
             [placeholder]="placeholder" [disabled]="disabled"
             class="eg-input has-icon-left pr-8" autocomplete="off" />
      @if (query()) {
        <button type="button" (mousedown)="clear($event)" tabindex="-1"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-slate-400 hover:text-slate-700">
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      }
      @if (open() && filtered().length) {
        <div class="absolute z-30 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-56 overflow-y-auto">
          @for (p of filtered(); track p) {
            <button type="button" (mousedown)="pick($event, p)"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{{ p }}</button>
          }
        </div>
      }
    </div>
  `,
})
export class DlxProvinceSelectComponent implements ControlValueAccessor {
  @Input() placeholder = 'Provincia';
  provinces = EC_PROVINCES;
  query = signal('');
  open = signal(false);
  disabled = false;

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = q ? this.provinces.filter(p => p.toLowerCase().includes(q)) : this.provinces;
    return list.slice(0, 30);
  });

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.query.set(v);
    this.open.set(true);
    this.onChange(v);   // permite texto libre también
  }
  pick(ev: Event, p: string) {
    ev.preventDefault();
    this.query.set(p);
    this.open.set(false);
    this.onChange(p);
  }
  clear(ev: Event) {
    ev.preventDefault();
    this.query.set('');
    this.onChange('');
  }
  closeSoon() { setTimeout(() => { this.open.set(false); this.onTouched(); }, 150); }

  writeValue(v: string): void { this.query.set(v || ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}
