import { Injectable, signal } from '@angular/core';
import { environment } from '@env/environment';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  receivedAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket?: WebSocket;
  private retryTimeout?: any;
  private idCounter = 0;

  connected = signal(false);
  notifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);

  connect() {
    if (this.socket && this.socket.readyState <= 1) return;
    // Derivar URL: si apiUrl es http(s)://X/api/v1 → ws(s)://X/ws/admin/notifications/
    const apiUrl = environment.apiUrl;
    const wsUrl = apiUrl
      .replace(/^http/, 'ws')
      .replace('/api/v1', '') + '/ws/admin/notifications/';
    try {
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => this.connected.set(true);
      this.socket.onmessage = ev => this.onMessage(ev);
      this.socket.onclose = () => { this.connected.set(false); this.scheduleRetry(); };
      this.socket.onerror = () => this.connected.set(false);
    } catch (e) {
      console.warn('WS connect failed', e);
      this.scheduleRetry();
    }
  }

  disconnect() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.socket?.close();
    this.socket = undefined;
  }

  markAllRead() {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.unreadCount.set(0);
  }

  private scheduleRetry() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = setTimeout(() => this.connect(), 5000);
  }

  private onMessage(ev: MessageEvent) {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === 'welcome') return;
      const n: AppNotification = {
        id: ++this.idCounter,
        type: data.type,
        title: data.title || 'Notificación',
        message: data.message || '',
        data,
        receivedAt: new Date(),
        read: false,
      };
      this.notifications.update(list => [n, ...list].slice(0, 50));
      this.unreadCount.update(c => c + 1);
    } catch (e) {
      console.warn('WS parse error', e);
    }
  }
}
