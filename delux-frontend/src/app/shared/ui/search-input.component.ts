import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SEARCH_DEBOUNCE_MS } from '@shared/config/search';

/**
 * Campo de búsqueda con ícono de lupa, reutilizable en todas las listas.
 * La emisión de `valueChange` está "debounced" con el timer global
 * (SEARCH_DEBOUNCE_MS): solo dispara cuando el usuario deja de escribir.
 * Enter fuerza la búsqueda inmediata.
 *
 * Uso: <dlx-search-input [value]="search()" (valueChange)="onSearch($event)" placeholder="Buscar..." />
 */
@Component({
  selector: 'dlx-search-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="relative w-full" [class.max-w-md]="!fluid">
      <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input [ngModel]="value" (ngModelChange)="onInput($event)" (keydown.enter)="flush()"
             [placeholder]="placeholder"
             class="eg-input has-icon-left pr-3" autocomplete="off" />
    </div>
  `,
})
export class DlxSearchInputComponent implements OnInit, OnDestroy {
  @Input() value = '';
  @Input() placeholder = 'Buscar…';
  @Input() fluid = false;
  /** Permite ajustar el retraso por instancia; por defecto usa el global. */
  @Input() debounceMs = SEARCH_DEBOUNCE_MS;
  @Output() valueChange = new EventEmitter<string>();

  private input$ = new Subject<string>();
  private sub?: Subscription;
  private lastEmitted = '';

  ngOnInit(): void {
    this.lastEmitted = this.value;
    this.sub = this.input$.pipe(debounceTime(this.debounceMs)).subscribe(v => this.emit(v));
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onInput(v: string): void {
    this.value = v;          // refleja lo escrito de inmediato
    this.input$.next(v);     // dispara la búsqueda tras el debounce
  }
  /** Enter: busca ya, sin esperar el debounce. */
  flush(): void { this.emit(this.value); }

  /** Evita emitir el mismo valor dos veces (p. ej. Enter + debounce). */
  private emit(v: string): void {
    if (v === this.lastEmitted) return;
    this.lastEmitted = v;
    this.valueChange.emit(v);
  }
}
