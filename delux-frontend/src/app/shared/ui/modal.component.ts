import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dlx-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
           (click)="onBackdrop($event)">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"></div>
        <div class="relative w-full max-h-[90vh] overflow-auto rounded-2xl
                    bg-white dark:bg-[#0f172a]
                    border border-slate-200 dark:border-[#334155]
                    shadow-2xl animate-slide-down"
             [style.max-width.px]="maxWidth">
          <header class="flex items-start justify-between gap-4 p-6 border-b border-slate-100 dark:border-[#1e293b]">
            <div>
              @if (title) { <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ title }}</h2> }
              @if (subtitle) { <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ subtitle }}</p> }
            </div>
            @if (closable) {
              <button (click)="close()" class="eg-action-btn shrink-0" aria-label="Cerrar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            }
          </header>
          <div class="p-6"><ng-content /></div>
          <ng-content select="[footer]" />
        </div>
      </div>
    }
  `,
})
export class DlxModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() maxWidth = 540;
  @Input() closable = true;
  @Input() backdropClose = true;
  @Output() closed = new EventEmitter<void>();

  close() { this.open = false; this.closed.emit(); }
  onBackdrop(ev: MouseEvent) {
    if (!this.backdropClose) return;
    if (ev.target === ev.currentTarget) this.close();
  }
  @HostListener('document:keydown.escape')
  onEsc() { if (this.open && this.closable) this.close(); }
}
