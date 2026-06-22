import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'dlx-confirm-host',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.open()) {
      @if (confirm.opts(); as o) {
        <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4"
             role="alertdialog" aria-modal="true">
          <div class="absolute inset-0 bg-ink-950/55 backdrop-blur-sm animate-fade-in"
               (click)="confirm.cancel()"></div>

          <div class="relative w-full max-w-[400px] bg-white dark:bg-[#0f172a]
                      border border-slate-200 dark:border-white/10
                      rounded-2xl shadow-2xl shadow-ink-950/25 overflow-hidden animate-confirm-pop">
            <div class="p-6 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl grid place-items-center mb-4"
                   [ngClass]="iconBg(o.variant)">
                <i class="fa-solid {{ o.icon || defaultIcon(o.variant) }} text-[22px]"
                   [ngClass]="iconColor(o.variant)"></i>
              </div>
              <h3 class="text-lg font-bold text-ink-950 dark:text-white">{{ o.title }}</h3>
              @if (o.message) {
                <p class="text-sm text-slate-600 dark:text-white/65 leading-relaxed mt-2">{{ o.message }}</p>
              }
            </div>

            <div class="flex gap-2 p-4 pt-0">
              <button (click)="confirm.cancel()"
                      class="flex-1 h-11 rounded-xl text-sm font-semibold
                             bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80
                             hover:bg-slate-200 dark:hover:bg-white/15 transition">
                {{ o.cancelText }}
              </button>
              <button (click)="confirm.accept()" #confirmBtn
                      class="flex-1 h-11 rounded-xl text-sm font-semibold text-white transition"
                      [ngClass]="confirmBtnClass(o.variant)">
                {{ o.confirmText }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    @keyframes confirm-pop {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    .animate-confirm-pop { animation: confirm-pop .2s cubic-bezier(.16,1,.3,1); }
    .animate-fade-in { animation: fade-in .2s ease-out; }
  `],
})
export class ConfirmHostComponent {
  confirm = inject(ConfirmService);

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (!this.confirm.open()) return;
    if (ev.key === 'Escape') this.confirm.cancel();
    else if (ev.key === 'Enter') this.confirm.accept();
  }

  defaultIcon(v: string) {
    return ({
      danger: 'fa-trash-can', warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info', success: 'fa-circle-check',
    } as Record<string, string>)[v] || 'fa-circle-question';
  }
  iconBg(v: string) {
    return ({
      danger: 'bg-rose-100 dark:bg-rose-500/15',
      warning: 'bg-amber-100 dark:bg-amber-500/15',
      info: 'bg-sky-100 dark:bg-sky-500/15',
      success: 'bg-emerald-100 dark:bg-emerald-500/15',
    } as Record<string, string>)[v] || 'bg-slate-100 dark:bg-white/10';
  }
  iconColor(v: string) {
    return ({
      danger: 'text-rose-600 dark:text-rose-400',
      warning: 'text-amber-600 dark:text-amber-400',
      info: 'text-sky-600 dark:text-sky-400',
      success: 'text-emerald-600 dark:text-emerald-400',
    } as Record<string, string>)[v] || 'text-slate-600';
  }
  confirmBtnClass(v: string) {
    return ({
      danger: 'bg-rose-600 hover:bg-rose-700',
      warning: 'bg-amber-600 hover:bg-amber-700',
      info: 'bg-[#1e40af] hover:bg-[#1d4ed8]',
      success: 'bg-emerald-600 hover:bg-emerald-700',
    } as Record<string, string>)[v] || 'bg-[#1e40af] hover:bg-[#1d4ed8]';
  }
}
