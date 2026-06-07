import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type Variant = 'accent' | 'ghost' | 'primary' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

@Component({
  selector: 'dlx-ui-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button [type]="type" [disabled]="disabled" [ngClass]="classes">
      <ng-content />
    </button>
  `
})
export class UiButtonComponent {
  @Input() variant: Variant = 'primary';
  @Input() size: Size = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;

  get classes(): string[] {
    const base = ['inline-flex', 'items-center', 'gap-2', 'font-semibold', 'transition', 'disabled:opacity-50'];
    const sizes: Record<Size, string[]> = {
      sm: ['text-xs', 'px-3', 'py-2', 'rounded-md'],
      md: ['text-sm', 'px-4', 'py-2.5', 'rounded-lg'],
      lg: ['text-base', 'px-6', 'py-3', 'rounded-full']
    };
    const variants: Record<Variant, string[]> = {
      accent: ['bg-accent-400', 'text-ink-950', 'hover:bg-accent-300'],
      ghost: ['border', 'border-white/20', 'text-white/90', 'hover:bg-white/10'],
      primary: ['bg-ink-900', 'text-white', 'hover:bg-ink-800'],
      secondary: ['bg-white', 'border', 'border-slate-200', 'text-ink-800', 'hover:bg-slate-50']
    };
    return [...base, ...sizes[this.size], ...variants[this.variant]];
  }
}
