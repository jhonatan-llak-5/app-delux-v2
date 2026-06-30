import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Campo de búsqueda con ícono de lupa, reutilizable en todas las listas.
 * Uso: <dlx-search-input [(value)]="search" (valueChange)="onSearch($event)" placeholder="Buscar..." />
 */
@Component({
  selector: 'dlx-search-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full" [class.max-w-md]="!fluid">
      <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input [ngModel]="value" (ngModelChange)="onInput($event)"
             [placeholder]="placeholder"
             class="eg-input has-icon-left pr-3" autocomplete="off" />
    </div>
  `,
})
export class DlxSearchInputComponent {
  @Input() value = '';
  @Input() placeholder = 'Buscar…';
  @Input() fluid = false;
  @Output() valueChange = new EventEmitter<string>();

  onInput(v: string): void {
    this.value = v;
    this.valueChange.emit(v);  }
}

