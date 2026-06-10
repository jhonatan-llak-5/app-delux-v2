import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-action-btn',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="eg-action-btn" [title]="title" [disabled]="disabled"
            (click)="clicked.emit($event)" [attr.aria-label]="title">
      <i class="fa-solid {{ icon }}" [class.text-rose-500]="danger"></i>
    </button>
  `,
})
export class DlxActionBtnComponent {
  @Input({ required: true }) icon = '';
  @Input() title = '';
  @Input() danger = false;
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<MouseEvent>();
}
