import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlxModalComponent } from './modal.component';
import { DlxButtonComponent } from './button.component';

export type ConfirmVariant = 'info' | 'warning' | 'danger';

@Component({
  selector: 'dlx-confirm-dialog',
  standalone: true,
  imports: [CommonModule, DlxModalComponent, DlxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-modal [open]="open" [maxWidth]="440" (closed)="onCancel()">
      <div class="text-center">
        <div class="w-14 h-14 mx-auto rounded-full grid place-items-center mb-4"
             [ngClass]="iconBgClass()">
          <i class="fa-solid {{ icon }} text-[22px]" [ngClass]="iconColorClass()"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">{{ title }}</h3>
        @if (message) {
          <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ message }}</p>
        }
      </div>

      <div footer class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#1e293b]">
        <dlx-button variant="ghost" (clicked)="onCancel()">{{ cancelText }}</dlx-button>
        <dlx-button [variant]="variant === 'danger' ? 'danger' : 'primary'"
                    [loading]="loading" (clicked)="onConfirm()">
          {{ confirmText }}
        </dlx-button>
      </div>
    </dlx-modal>
  `,
})
export class DlxConfirmDialogComponent {
  @Input() open = false;
  @Input({ required: true }) title = '';
  @Input() message = '';
  @Input() variant: ConfirmVariant = 'warning';
  @Input() icon = 'fa-triangle-exclamation';
  @Input() confirmText = 'Confirmar';
  @Input() cancelText = 'Cancelar';
  @Input() loading = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  iconBgClass() {
    return ({
      info:    'bg-blue-100 dark:bg-blue-500/15',
      warning: 'bg-amber-100 dark:bg-amber-500/15',
      danger:  'bg-rose-100 dark:bg-rose-500/15',
    } as Record<ConfirmVariant, string>)[this.variant];
  }
  iconColorClass() {
    return ({
      info:    'text-blue-600 dark:text-blue-400',
      warning: 'text-amber-600 dark:text-amber-400',
      danger:  'text-rose-600 dark:text-rose-400',
    } as Record<ConfirmVariant, string>)[this.variant];
  }
  onConfirm() { this.confirmed.emit(); }
  onCancel() { this.open = false; this.cancelled.emit(); }
}
