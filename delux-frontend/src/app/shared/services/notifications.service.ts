import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { NotifyService } from './notify.service';
import { WebSocketService } from '@core/services/websocket.service';

export type NotifKind = 'sale' | 'user' | 'low_stock' | 'order' | 'review' | 'info';

export interface AppNotification {
  id: string;
  kind: NotifKind;
  title: string;
  message?: string;
  link?: string;
  createdAt: string;
  read: boolean;
  /** Datos extra (productId, orderId, etc.) */
  meta?: Record<string, any>;
}

const STORAGE_KEY = 'dlx_notifs_v1';
const MAX_NOTIFS = 50;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private notify = inject(NotifyService);
  private ws = inject(WebSocketService);

  list = signal<AppNotification[]>(this.loadFromStorage());
  unread = computed(() => this.list().filter(n => !n.read).length);

  /** Animación efímera del campanazo */
  bellPulse = signal(false);

  private lastSeenWsId = 0;
  private readonly kindMap: Record<string, NotifKind> = {
    sale_created: 'sale',
    user_registered: 'user',
    low_stock: 'low_stock',
    order_placed: 'order',
    review_posted: 'review',
  };

  constructor() {
    // Effect: cuando WebSocketService recibe nuevas notificaciones,
    // las traducimos a nuestro formato y disparamos sonido/pulse/toast.
    effect(() => {
      const wsList = this.ws.notifications();
      // Solo procesar los nuevos (ids mayores al último visto)
      const fresh = wsList.filter(n => n.id > this.lastSeenWsId);
      if (fresh.length === 0) return;
      // wsList viene ordenado DESC por id; procesar de viejo a nuevo
      for (const wsN of [...fresh].reverse()) {
        const kind = this.kindMap[wsN.type];
        if (!kind) continue;
        this.push({
          kind,
          title: wsN.title || this.defaultTitle(kind),
          message: wsN.message,
          link: (wsN.data as any)?.link,
          meta: (wsN.data as any)?.meta,
        });
      }
      this.lastSeenWsId = Math.max(...wsList.map(n => n.id));
    });
  }

  private defaultTitle(kind: NotifKind): string {
    return ({
      sale: 'Nueva venta',
      user: 'Nuevo usuario registrado',
      low_stock: 'Stock bajo',
      order: 'Nueva orden',
      review: 'Nueva reseña',
      info: 'Notificación',
    } as Record<NotifKind, string>)[kind];
  }

  /** Agrega una notificación + dispara feedback (sonido + pulse + toast). */
  push(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
    const notif: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...n,
    };
    const next = [notif, ...this.list()].slice(0, MAX_NOTIFS);
    this.list.set(next);
    this.persist();
    this.playSound();
    this.triggerPulse();
    this.notify.info(notif.title, { description: notif.message });
  }

  markAsRead(id: string) {
    const next = this.list().map(n => n.id === id ? { ...n, read: true } : n);
    this.list.set(next);
    this.persist();
  }
  markAllRead() {
    this.list.set(this.list().map(n => ({ ...n, read: true })));
    this.persist();
  }
  remove(id: string) {
    this.list.set(this.list().filter(n => n.id !== id));
    this.persist();
  }
  clear() {
    this.list.set([]);
    this.persist();
  }

  private triggerPulse() {
    this.bellPulse.set(true);
    setTimeout(() => this.bellPulse.set(false), 900);
  }

  private playSound() {
    try {
      // Beep corto con WebAudio (no requiere archivo)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch { /* silencio si bloqueado por browser */ }
  }

  private loadFromStorage(): AppNotification[] {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list())); } catch {}
  }
}
