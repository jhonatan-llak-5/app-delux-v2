import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Botón de recargar reutilizable — solo ícono.
 *
 * <dlx-reload-button [loading]="loading()" (reload)="reload()" />
 *
 * Usa el mismo estilo que `btn-secondary` pero cuadrado (icon-only). El ícono
 * gira mientras `loading` es true.
 */
@Component({
  selector: 'dlx-reload-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="reload.emit()" [disabled]="loading"
            class="btn-secondary !h-9 !w-9 !px-0 grid place-items-center"
            [attr.aria-label]="label" [attr.title]="label">
      <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loading"></i>
    </button>
  `,
})
export class DlxReloadButtonComponent {
  /** Muestra el ícono girando y deshabilita el botón. */
  @Input() loading = false;
  /** Texto accesible (tooltip / aria-label). */
  @Input() label = 'Recargar';
  @Output() reload = new EventEmitter<void>();
}
