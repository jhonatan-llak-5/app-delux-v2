import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService, AppNotification } from '@core/services/websocket.service';

interface ToastItem extends AppNotification {
  timeoutId?: any;
  exiting?: boolean;
}

@Component({
  selector: 'dlx-toast-host',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      @for (t of visible(); track t.id) {
        <div class="pointer-events-auto bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-2xl p-4 flex gap-3 animate-slide-down"
             [class.opacity-0]="t.exiting">
          <div class="w-10 h-10 rounded-lg grid place-items-center text-white shrink-0"
               [ngClass]="iconBg(t.type)">
            <i class="fa-solid {{ icon(t.type) }}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-ink-950 dark:text-white text-sm">{{ t.title }}</p>
            <p class="text-xs text-ink-700 dark:text-white/60 mt-0.5">{{ t.message }}</p>
            <p class="text-[10px] text-ink-400 dark:text-white/40 mt-1">{{ t.receivedAt | date:'shortTime' }}</p>
          </div>
          <button (click)="dismiss(t.id)" class="text-ink-400 dark:text-white/40 hover:text-ink-700 dark:hover:text-white">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent implements OnInit {
  private ws = inject(WebSocketService);
  visible = signal<ToastItem[]>([]);
  private seenIds = new Set<number>();

  ngOnInit() {
    this.ws.connect();
    // Polling visual: cuando llega una nueva notification al signal, la mostramos
    setInterval(() => this.syncFromWs(), 500);
  }

  private syncFromWs() {
    const all = this.ws.notifications();
    for (const n of all) {
      if (!this.seenIds.has(n.id)) {
        this.seenIds.add(n.id);
        this.addToast(n);
      }
    }
  }

  private addToast(n: AppNotification) {
    const t: ToastItem = { ...n };
    t.timeoutId = setTimeout(() => this.dismiss(n.id), 6000);
    this.visible.update(list => [t, ...list].slice(0, 4));
  }

  dismiss(id: number) {
    this.visible.update(list => list.filter(x => x.id !== id));
  }

  icon(type: string) {
    return ({
      new_sale: 'fa-cash-register',
      low_stock: 'fa-triangle-exclamation',
      order_paid: 'fa-circle-check',
    } as any)[type] || 'fa-bell';
  }

  iconBg(type: string) {
    return ({
      new_sale: 'bg-emerald-500',
      low_stock: 'bg-amber-500',
      order_paid: 'bg-violet-500',
    } as any)[type] || 'bg-ink-950';
  }
}
