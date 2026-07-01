import { ChangeDetectionStrategy, Component, ElementRef, HostListener, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Íconos básicos (FontAwesome free solid) para categorías y similares. */
const ICONS: string[] = [
  'fa-shapes', 'fa-tag', 'fa-tags', 'fa-bag-shopping', 'fa-basket-shopping', 'fa-cart-shopping',
  'fa-shirt', 'fa-shoe-prints', 'fa-socks', 'fa-hat-cowboy', 'fa-mitten', 'fa-vest',
  'fa-glasses', 'fa-gem', 'fa-ring', 'fa-crown', 'fa-diamond', 'fa-wand-magic-sparkles',
  'fa-briefcase', 'fa-suitcase', 'fa-suitcase-rolling', 'fa-box', 'fa-boxes-stacked', 'fa-gift',
  'fa-star', 'fa-heart', 'fa-fire', 'fa-bolt', 'fa-medal', 'fa-trophy',
  'fa-baby', 'fa-child', 'fa-person', 'fa-person-dress', 'fa-people-group', 'fa-user',
  'fa-dumbbell', 'fa-futbol', 'fa-basketball', 'fa-baseball', 'fa-volleyball', 'fa-table-tennis-paddle-ball',
  'fa-person-running', 'fa-person-swimming', 'fa-person-biking', 'fa-person-skiing', 'fa-person-hiking', 'fa-heart-pulse',
  'fa-music', 'fa-headphones', 'fa-gamepad', 'fa-camera', 'fa-mobile-screen', 'fa-laptop',
  'fa-clock', 'fa-sun', 'fa-moon', 'fa-snowflake', 'fa-umbrella', 'fa-cloud',
  'fa-tree', 'fa-leaf', 'fa-seedling', 'fa-paw', 'fa-dog', 'fa-cat',
  'fa-mug-hot', 'fa-utensils', 'fa-pizza-slice', 'fa-wine-bottle', 'fa-cookie-bite', 'fa-ice-cream',
  'fa-palette', 'fa-paintbrush', 'fa-scissors', 'fa-ruler', 'fa-gear', 'fa-wrench',
  'fa-spray-can', 'fa-soap', 'fa-bath', 'fa-bed', 'fa-couch', 'fa-lightbulb',
  'fa-plug', 'fa-key', 'fa-lock', 'fa-truck', 'fa-store', 'fa-house',
  'fa-globe', 'fa-earth-americas', 'fa-location-dot', 'fa-book', 'fa-pen', 'fa-graduation-cap',
];

@Component({
  selector: 'dlx-icon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxIconPickerComponent), multi: true },
  ],
  template: `
    <div class="relative">
      <div class="flex gap-2">
        <button type="button" (click)="open.set(!open())"
                class="w-11 h-11 grid place-items-center rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
          @if (value()) { <i class="fa-solid {{ value() }} text-slate-700 dark:text-white"></i> }
          @else { <i class="fa-solid fa-shapes text-slate-400"></i> }
        </button>
        <button type="button" (click)="open.set(!open())"
                class="eg-input flex-1 flex items-center justify-between text-left">
          <span class="text-sm" [class.text-slate-400]="!value()">{{ value() || 'Elegir ícono…' }}</span>
          <i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
        </button>
        @if (value()) {
          <button type="button" (click)="pick('')" title="Quitar ícono"
                  class="w-11 h-11 grid place-items-center rounded-lg text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-white/10 shrink-0">
            <i class="fa-solid fa-xmark"></i>
          </button>
        }
      </div>

      @if (open()) {
        <div class="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl p-2
                    bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
          <div class="relative mb-2">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input [ngModel]="query()" (ngModelChange)="query.set($event)"
                   class="eg-input has-icon-left !h-9" placeholder="Buscar ícono…" autocomplete="off" />
          </div>
          <div class="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
            @for (ic of filtered(); track ic) {
              <button type="button" (click)="pick(ic)" [title]="ic"
                      class="aspect-square grid place-items-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-white/10"
                      [ngClass]="value() === ic ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] dark:text-[var(--dash-primary)]' : 'text-slate-600 dark:text-white/70'">
                <i class="fa-solid {{ ic }}"></i>
              </button>
            }
            @if (!filtered().length) {
              <p class="col-span-8 text-center text-xs text-slate-400 py-3">Sin resultados</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DlxIconPickerComponent implements ControlValueAccessor {
  private host = inject(ElementRef);
  readonly icons = ICONS;
  value = signal<string>('');
  open = signal(false);
  query = signal('');
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  filtered(): string[] {
    const q = this.query().trim().toLowerCase().replace(/^fa-/, '');
    return q ? this.icons.filter(i => i.includes(q)) : this.icons;
  }
  pick(icon: string): void {
    this.value.set(icon);
    this.onChange(icon);
    this.open.set(false);
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target)) this.open.set(false);
  }

  writeValue(v: any): void { this.value.set(v || ''); }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
}
