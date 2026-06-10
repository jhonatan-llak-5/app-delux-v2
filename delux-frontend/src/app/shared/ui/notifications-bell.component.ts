import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationsService, NotifKind } from '@shared/services/notifications.service';

@Component({
  selector: 'dlx-notifications-bell',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" #wrap>
      <button type="button" (click)="open.set(!open())"
              class="relative w-10 h-10 grid place-items-center rounded-lg
                     hover:bg-[var(--dash-hover)] transition"
              aria-label="Notificaciones">
        <i class="fa-solid fa-bell text-[15px]"
           [class.animate-bell-ring]="svc.bellPulse()"
           [style.color]="'var(--dash-text-muted)'"></i>
        @if (svc.unread() > 0) {
          <span class="absolute top-1 right-1 min-w-[18px] h-[18px] px-1
                       rounded-full bg-rose-500 text-white text-[11px] font-bold
                       grid place-items-center ring-2 ring-[var(--dash-card)]"
                [class.animate-pulse]="svc.bellPulse()">
            {{ svc.unread() > 99 ? '99+' : svc.unread() }}
          </span>
        }
      </button>

      @if (open()) {
        <div class="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] overflow-hidden
                    rounded-xl border shadow-xl animate-slide-down z-50 flex flex-col"
             [style.background-color]="'var(--dash-card)'"
             [style.border-color]="'var(--dash-border)'">

          <!-- Header -->
          <header class="flex items-center justify-between px-4 py-3 border-b shrink-0"
                  [style.border-color]="'var(--dash-border)'">
            <div>
              <h3 class="font-bold text-[15px]" [style.color]="'var(--dash-text)'">Notificaciones</h3>
              <p class="text-xs" [style.color]="'var(--dash-text-muted)'">
                {{ svc.unread() }} sin leer · {{ svc.list().length }} en total
              </p>
            </div>
            @if (svc.unread() > 0) {
              <button (click)="svc.markAllRead()"
                      class="text-xs font-semibold hover:underline"
                      [style.color]="'var(--dash-primary)'">
                Marcar todas leídas
              </button>
            }
          </header>

          <!-- Lista -->
          <div class="overflow-y-auto flex-1 scrollbar-thin">
            @if (svc.list().length === 0) {
              <div class="text-center py-10 px-6">
                <i class="fa-regular fa-bell-slash text-2xl mb-2"
                   [style.color]="'var(--dash-text-soft)'"></i>
                <p class="text-sm" [style.color]="'var(--dash-text-muted)'">
                  Sin notificaciones por ahora.
                </p>
              </div>
            } @else {
              @for (n of svc.list(); track n.id) {
                <div class="flex items-start gap-3 px-4 py-3 border-b transition cursor-pointer
                            hover:bg-[var(--dash-hover)]"
                     [style.border-color]="'var(--dash-border)'"
                     [class.opacity-60]="n.read"
                     (click)="onClick(n)">
                  <div class="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                       [ngClass]="iconBg(n.kind)">
                    <i class="fa-solid {{ icon(n.kind) }} text-[13px]"
                       [ngClass]="iconColor(n.kind)"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold leading-tight" [style.color]="'var(--dash-text)'">
                      {{ n.title }}
                      @if (!n.read) {
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--dash-primary)] ml-1.5 align-middle"></span>
                      }
                    </p>
                    @if (n.message) {
                      <p class="text-xs mt-0.5 line-clamp-2" [style.color]="'var(--dash-text-muted)'">
                        {{ n.message }}
                      </p>
                    }
                    <p class="text-[11px] mt-1" [style.color]="'var(--dash-text-soft)'">
                      {{ timeAgo(n.createdAt) }}
                    </p>
                  </div>
                  <button (click)="$event.stopPropagation(); svc.remove(n.id)"
                          class="opacity-0 group-hover:opacity-100 eg-action-btn shrink-0"
                          title="Eliminar">
                    <i class="fa-solid fa-xmark text-[11px]"></i>
                  </button>
                </div>
              }
            }
          </div>

          @if (svc.list().length > 0) {
            <footer class="px-4 py-2 border-t shrink-0 flex items-center justify-between"
                    [style.border-color]="'var(--dash-border)'">
              <button (click)="svc.clear()"
                      class="text-xs text-rose-600 hover:underline">
                Limpiar todo
              </button>
            </footer>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes bell-ring {
      0%   { transform: rotate(0); }
      20%  { transform: rotate(-15deg); }
      40%  { transform: rotate(12deg); }
      60%  { transform: rotate(-8deg); }
      80%  { transform: rotate(6deg); }
      100% { transform: rotate(0); }
    }
    .animate-bell-ring { animation: bell-ring 0.9s ease-in-out; transform-origin: top center; }
  `],
})
export class DlxNotificationsBellComponent {
  svc = inject(NotificationsService);
  private router = inject(Router);
  private host = inject(ElementRef);

  open = signal(false);

  onClick(n: ReturnType<NotificationsService['list']>[number]) {
    this.svc.markAsRead(n.id);
    if (n.link) {
      this.router.navigateByUrl(n.link);
      this.open.set(false);
    }
  }

  icon(kind: NotifKind): string {
    return ({
      sale: 'fa-cash-register', user: 'fa-user-plus', low_stock: 'fa-triangle-exclamation',
      order: 'fa-bag-shopping', review: 'fa-star', info: 'fa-circle-info',
    } as Record<NotifKind, string>)[kind];
  }
  iconBg(kind: NotifKind): string {
    return ({
      sale: 'bg-emerald-100 dark:bg-emerald-500/15',
      user: 'bg-blue-100 dark:bg-blue-500/15',
      low_stock: 'bg-amber-100 dark:bg-amber-500/15',
      order: 'bg-violet-100 dark:bg-violet-500/15',
      review: 'bg-pink-100 dark:bg-pink-500/15',
      info: 'bg-slate-100 dark:bg-slate-700/40',
    } as Record<NotifKind, string>)[kind];
  }
  iconColor(kind: NotifKind): string {
    return ({
      sale: 'text-emerald-600 dark:text-emerald-400',
      user: 'text-blue-600 dark:text-blue-400',
      low_stock: 'text-amber-600 dark:text-amber-400',
      order: 'text-violet-600 dark:text-violet-400',
      review: 'text-pink-600 dark:text-pink-400',
      info: 'text-slate-600 dark:text-slate-300',
    } as Record<NotifKind, string>)[kind];
  }

  timeAgo(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'hace ' + Math.floor(diff) + 's';
    if (diff < 3600)  return 'hace ' + Math.floor(diff / 60) + 'min';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
    return 'hace ' + Math.floor(diff / 86400) + 'd';
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }
}
