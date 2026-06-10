import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-page-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        @if (eyebrow) { <span class="eg-section-label">{{ eyebrow }}</span> }
        <h1 class="eg-page-title">{{ title }}</h1>
        @if (subtitle) { <p class="eg-page-subtitle">{{ subtitle }}</p> }
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <ng-content />
      </div>
    </header>
  `,
})
export class DlxPageHeaderComponent {
  @Input() eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
