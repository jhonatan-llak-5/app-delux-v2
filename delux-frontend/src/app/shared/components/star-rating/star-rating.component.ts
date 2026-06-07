import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-star-rating',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center gap-0.5">
      @for (i of [1,2,3,4,5]; track i) {
        @if (interactive) {
          <button type="button" (click)="onClick(i)" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(0)"
                  class="transition" [class.scale-110]="(hover() || value) === i">
            <i class="fa-solid fa-star {{ sizeClass }}"
               [class.text-amber-400]="(hover() || value) >= i"
               [class.text-ink-200]="(hover() || value) < i"
               [class.dark:text-white/20]="(hover() || value) < i"></i>
          </button>
        } @else {
          <i class="fa-solid fa-star {{ sizeClass }}"
             [class.text-amber-400]="value >= i"
             [class.text-ink-200]="value < i"
             [class.dark:text-white/20]="value < i"></i>
        }
      }
    </div>
  `,
})
export class StarRatingComponent {
  @Input() value = 0;
  @Input() interactive = false;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  @Output() rated = new EventEmitter<number>();

  hover = signal(0);

  get sizeClass() {
    return ({ xs: 'text-[10px]', sm: 'text-xs', md: 'text-sm', lg: 'text-lg' } as any)[this.size];
  }

  onClick(v: number) {
    this.value = v;
    this.rated.emit(v);
  }
}
