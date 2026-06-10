import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="rootClass()">
      @if (title || subtitle) {
        <div class="mb-5">
          @if (title) { <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">{{ title }}</h2> }
          @if (subtitle) { <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ subtitle }}</p> }
        </div>
      }
      <ng-content />
    </div>
  `,
})
export class DlxCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() padded = true;
  @Input() extraClass = '';

  rootClass() {
    return [this.padded ? 'eg-card-padded' : 'eg-card', this.extraClass].filter(Boolean).join(' ');
  }
}
