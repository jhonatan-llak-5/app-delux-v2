import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DlxBtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type DlxBtnSize    = 'sm' | 'md' | 'lg';

/**
 * <dlx-button variant="primary" size="md" [loading]="saving()" icon="fa-check">
 *   Guardar
 * </dlx-button>
 *
 * Variantes: primary (azul) · secondary (outline) · ghost (transparente) · danger (rojo)
 * Tamaños: sm (36px) · md (44px) · lg (52px)
 */
@Component({
  selector: 'dlx-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button [type]="type" [disabled]="disabled || loading" (click)="onClick($event)"
            [class]="classes()">
      @if (loading) {
        <i class="fa-solid fa-spinner fa-spin"></i>
      } @else if (icon) {
        <i class="fa-solid {{ icon }}" [class.text-xs]="size === 'sm'"></i>
      }
      <ng-content />
      @if (iconRight && !loading) {
        <i class="fa-solid {{ iconRight }} text-xs"></i>
      }
    </button>
  `,
})
export class DlxButtonComponent {
  @Input() variant: DlxBtnVariant = 'primary';
  @Input() size: DlxBtnSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() icon?: string;
  @Input() iconRight?: string;
  @Input() fullWidth = false;
  @Input() extraClass = '';
  @Output() clicked = new EventEmitter<MouseEvent>();

  onClick(ev: MouseEvent) {
    if (this.disabled || this.loading) return;
    this.clicked.emit(ev);
  }

  classes() {
    const base = {
      primary:   'eg-btn-primary',
      secondary: 'eg-btn-secondary',
      ghost:     'eg-btn-ghost',
      danger:    'eg-btn-danger',
    }[this.variant];
    const size = this.size === 'sm' ? 'eg-btn-sm' : '';
    const full = this.fullWidth ? 'w-full' : '';
    return [base, size, full, this.extraClass].filter(Boolean).join(' ');
  }
}
