import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Mensaje de error de validación debajo de un campo de formulario.
 * Uso: <dlx-field-error [error]="fe('email')" />
 */
@Component({
  selector: 'dlx-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error) {
      <p class="text-xs text-rose-600 mt-1">{{ error }}</p>
    }
  `,
})
export class DlxFieldErrorComponent {
  @Input() error?: string | null;
}
