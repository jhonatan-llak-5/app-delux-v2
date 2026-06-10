import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eg-card-padded text-center py-12">
      <div class="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-4">
        <i class="fa-solid {{ icon }} text-slate-400 dark:text-white/35 text-[20px]"></i>
      </div>
      <h3 class="font-bold text-[16px] text-slate-900 dark:text-white mb-2">{{ title }}</h3>
      @if (description) {
        <p class="text-sm text-slate-500 dark:text-white/55 max-w-md mx-auto">{{ description }}</p>
      }
      <div class="mt-5"><ng-content /></div>
    </div>
  `,
})
export class DlxEmptyStateComponent {
  @Input() icon = 'fa-inbox';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
