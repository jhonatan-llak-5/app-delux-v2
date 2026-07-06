import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AddressHit { lat: number; lng: number; display_name: string; address?: any; }
interface NomItem { place_id: number; lat: string; lon: string; display_name: string; address?: any; }

/**
 * Buscador de direcciones con sugerencias (typeahead). Consulta OpenStreetMap
 * (Nominatim) con debounce, restringido por país, y muestra opciones abajo.
 *
 *   <dlx-address-autocomplete [value]="addr" (valueChange)="addr = $event"
 *       [biasLat]="lat()" [biasLng]="lng()" (selected)="onPick($event)" />
 */
@Component({
  selector: 'dlx-address-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative' },
  template: `
    <input type="text" [ngModel]="value" (ngModelChange)="onInput($event)"
           (keydown)="onKey($event)" (focus)="onFocus()" [placeholder]="placeholder"
           autocomplete="off"
           class="w-full px-3 py-2.5 rounded-xl bg-ink-50 dark:bg-white/5
                  border border-ink-200 dark:border-white/10 text-sm
                  text-ink-950 dark:text-white focus:outline-none" />
    @if (loading()) {
      <i class="fa-solid fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs"></i>
    }
    @if (open() && suggestions().length) {
      <ul class="absolute z-[1200] left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl
                 border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 shadow-xl">
        @for (s of suggestions(); track s.place_id; let i = $index) {
          <li (mousedown)="choose(s)" (mouseenter)="active.set(i)"
              class="px-3 py-2 text-[13px] cursor-pointer flex items-start gap-2 text-ink-800 dark:text-white/80"
              [class.bg-ink-100]="i === active()" [class.dark:bg-white/10]="i === active()">
            <i class="fa-solid fa-location-dot text-ink-400 dark:text-white/40 mt-0.5 text-[11px]"></i>
            <span>{{ s.display_name }}</span>
          </li>
        }
      </ul>
    }
  `,
})
export class DlxAddressAutocompleteComponent {
  @Input() value = '';
  @Input() placeholder = 'Escribe tu dirección…';
  @Input() biasLat: number | null = null;
  @Input() biasLng: number | null = null;
  @Input() countryCodes = 'ec';
  @Output() valueChange = new EventEmitter<string>();
  @Output() selected = new EventEmitter<AddressHit>();

  private host = inject(ElementRef);
  suggestions = signal<NomItem[]>([]);
  open = signal(false);
  loading = signal(false);
  active = signal(-1);
  private timer: any = null;

  onInput(v: string) {
    this.value = v;
    this.valueChange.emit(v);
    this.active.set(-1);
    if (this.timer) clearTimeout(this.timer);
    const q = v.trim();
    if (q.length < 3) { this.suggestions.set([]); this.open.set(false); return; }
    this.timer = setTimeout(() => this.fetch(q), 400);
  }

  private async fetch(q: string) {
    this.loading.set(true);
    try {
      let vb = '';
      if (this.biasLat != null && this.biasLng != null) {
        const d = 0.3;
        vb = `&viewbox=${this.biasLng - d},${this.biasLat + d},${this.biasLng + d},${this.biasLat - d}`;
      }
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6`
        + `&countrycodes=${this.countryCodes}${vb}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const arr = await r.json();
      this.suggestions.set(Array.isArray(arr) ? arr : []);
      this.open.set(true);
    } catch {
      this.suggestions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  choose(s: NomItem) {
    this.value = s.display_name;
    this.valueChange.emit(this.value);
    this.selected.emit({ lat: parseFloat(s.lat), lng: parseFloat(s.lon), display_name: s.display_name, address: s.address });
    this.suggestions.set([]);
    this.open.set(false);
    this.active.set(-1);
  }

  onKey(e: KeyboardEvent) {
    if (!this.open() || !this.suggestions().length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set(Math.min(this.active() + 1, this.suggestions().length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(Math.max(this.active() - 1, 0)); }
    else if (e.key === 'Enter') { const i = this.active(); if (i >= 0) { e.preventDefault(); this.choose(this.suggestions()[i]); } }
    else if (e.key === 'Escape') { this.open.set(false); }
  }

  onFocus() { if (this.suggestions().length) this.open.set(true); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
