import { ChangeDetectionStrategy, Component, computed, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { COUNTRIES, Country } from '@shared/data/ecuador';

/**
 * Teléfono con selector de código de país (buscable). Ecuador por defecto.
 * El valor emitido es "<dial> <numero>" (p. ej. "+593 987654321").
 * Uso: <dlx-phone-input [(ngModel)]="phone" />
 */
@Component({
  selector: 'dlx-phone-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxPhoneInputComponent), multi: true }],
  template: `
    <div class="flex gap-2">
      <!-- Selector de país -->
      <div class="relative shrink-0">
        <button type="button" (click)="open.set(!open())" [disabled]="disabled"
                class="eg-input !w-auto flex items-center gap-1.5 pr-2">
          <span class="text-base leading-none">{{ country().flag }}</span>
          <span class="text-sm font-medium">{{ country().dial }}</span>
          <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
        </button>
        @if (open()) {
          <div class="absolute z-30 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div class="p-2 border-b border-slate-100">
              <input [value]="q()" (input)="onSearch($event)" placeholder="Buscar país…"
                     class="eg-input !h-9 text-sm" autocomplete="off" />
            </div>
            <div class="max-h-56 overflow-y-auto">
              @for (c of filtered(); track c.code) {
                <button type="button" (click)="selectCountry(c)"
                        class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                  <span class="text-base">{{ c.flag }}</span>
                  <span class="flex-1 truncate">{{ c.name }}</span>
                  <span class="text-slate-400">{{ c.dial }}</span>
                </button>
              }
            </div>
          </div>
        }
      </div>
      <!-- Número -->
      <input [value]="number()" (input)="onNumber($event)" (blur)="onTouched()"
             type="tel" inputmode="tel" [placeholder]="placeholder" [disabled]="disabled"
             class="eg-input flex-1 min-w-0" autocomplete="off" />
    </div>
  `,
})
export class DlxPhoneInputComponent implements ControlValueAccessor {
  placeholder = '987654321';
  countries = COUNTRIES;
  country = signal<Country>(COUNTRIES[0]);   // Ecuador por defecto
  number = signal('');
  open = signal(false);
  q = signal('');
  disabled = false;

  filtered = computed(() => {
    const s = this.q().trim().toLowerCase();
    if (!s) return this.countries;
    return this.countries.filter(c => c.name.toLowerCase().includes(s) || c.dial.includes(s));
  });

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  private emit() {
    const n = this.number().trim();
    this.onChange(n ? `${this.country().dial} ${n}` : '');
  }
  onSearch(ev: Event) { this.q.set((ev.target as HTMLInputElement).value); }
  selectCountry(c: Country) { this.country.set(c); this.open.set(false); this.q.set(''); this.emit(); }
  onNumber(ev: Event) { this.number.set((ev.target as HTMLInputElement).value.replace(/[^\d]/g, '')); this.emit(); }

  writeValue(v: string): void {
    const raw = (v || '').trim();
    if (!raw) { this.country.set(COUNTRIES[0]); this.number.set(''); return; }
    // Busca un código de país que sea prefijo (el más largo primero).
    const noSpace = raw.replace(/\s+/g, '');
    const match = [...this.countries].sort((a, b) => b.dial.length - a.dial.length)
      .find(c => noSpace.startsWith(c.dial));
    if (match) {
      this.country.set(match);
      this.number.set(noSpace.slice(match.dial.length).replace(/[^\d]/g, ''));
    } else {
      this.country.set(COUNTRIES[0]);
      this.number.set(noSpace.replace(/[^\d]/g, ''));
    }
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}
