import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface RowAction {
  label: string;
  icon?: string;                 // clase FontAwesome, ej. 'fa-pen'
  run?: () => void;              // acción a ejecutar
  link?: any[] | string;        // o navegación (routerLink)
  variant?: 'primary' | 'default' | 'danger';
  hidden?: boolean;
  disabled?: boolean;
}

/**
 * Acciones de fila reutilizables: botón principal + dropdown con el resto.
 * Si solo hay una acción visible, muestra solo el botón. Uso:
 *   <dlx-row-actions [actions]="rowActions(item)" />
 */
@Component({
  selector: 'dlx-row-actions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (primary(); as p) {
      <div class="relative inline-flex items-center text-left">
        <div class="inline-flex rounded-lg overflow-hidden shadow-sm">
          @if (p.link) {
            <a [routerLink]="p.link" [class]="primaryClass(p)">
              @if (p.icon) { <i class="fa-solid {{ p.icon }}"></i> } {{ p.label }}
            </a>
          } @else {
            <button type="button" [disabled]="p.disabled" (click)="exec(p)" [class]="primaryClass(p)">
              @if (p.icon) { <i class="fa-solid {{ p.icon }}"></i> } {{ p.label }}
            </button>
          }
          @if (rest().length) {
            <button type="button" (click)="toggleMenu($event)"
                    class="px-2 py-1.5 grid place-items-center border-l border-white/25 bg-[#1e40af] text-white hover:bg-[#1d4ed8] transition"
                    aria-label="Más acciones">
              <i class="fa-solid fa-chevron-down text-[10px]"></i>
            </button>
          }
        </div>

        @if (open() && rest().length) {
          <div class="fixed inset-0 z-[60]" (click)="open.set(false)"></div>
          <div class="fixed w-48 py-1 z-[61]
                      bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10
                      rounded-lg shadow-xl overflow-hidden"
               [style.top.px]="menuPos().top" [style.bottom.px]="menuPos().bottom" [style.right.px]="menuPos().right">
            @for (a of rest(); track a.label) {
              @if (a.link) {
                <a [routerLink]="a.link" (click)="open.set(false)"
                   class="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition"
                   [class.text-rose-600]="a.variant === 'danger'"
                   [class.text-slate-700]="a.variant !== 'danger'"
                   [class.dark:text-white/80]="a.variant !== 'danger'">
                  @if (a.icon) { <i class="fa-solid {{ a.icon }} w-4 text-center"></i> } {{ a.label }}
                </a>
              } @else {
                <button type="button" [disabled]="a.disabled" (click)="exec(a)"
                        class="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition disabled:opacity-40"
                        [class.text-rose-600]="a.variant === 'danger'"
                        [class.text-slate-700]="a.variant !== 'danger'"
                        [class.dark:text-white/80]="a.variant !== 'danger'">
                  @if (a.icon) { <i class="fa-solid {{ a.icon }} w-4 text-center"></i> } {{ a.label }}
                </button>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class RowActionsComponent {
  @Input() actions: RowAction[] = [];
  open = signal(false);
  menuPos = signal<{ top: number | null; bottom: number | null; right: number }>({ top: 0, bottom: null, right: 0 });

  toggleMenu(ev: MouseEvent): void {
    if (this.open()) { this.open.set(false); return; }
    const btn = ev.currentTarget as HTMLElement;
    const r = btn.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const menuH = Math.min(8 + this.rest().length * 44, 320);
    const openUp = r.bottom + menuH > vh - 8;
    this.menuPos.set({
      right: Math.max(8, vw - r.right),
      top: openUp ? null : Math.round(r.bottom + 4),
      bottom: openUp ? Math.round(vh - r.top + 4) : null,
    });
    this.open.set(true);
  }

  visible(): RowAction[] { return (this.actions || []).filter(a => !a.hidden); }
  primary(): RowAction | null { return this.visible()[0] ?? null; }
  rest(): RowAction[] { return this.visible().slice(1); }

  exec(a: RowAction): void { this.open.set(false); a.run?.(); }

  primaryClass(a: RowAction): string {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap';
    let color = 'bg-[#1e40af] text-white hover:bg-[#1d4ed8]';            // primary/undefined
    if (a.variant === 'danger') color = 'bg-rose-600 text-white hover:bg-rose-700';
    else if (a.variant === 'default') color = 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20';
    return `${base} ${color}`;
  }
}
