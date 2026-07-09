import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { WebSocketService } from '@core/services/websocket.service';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';

export type NotifKind = 'sale' | 'user' | 'low_stock' | 'order' | 'review' | 'info';

export interface AppNotification {
  id: string;                 // id del servidor (string para track)
  kind: NotifKind;
  priority: 'P1' | 'P2' | 'P3';
  title: string;
  message?: string;
  link?: string;
  createdAt: string;
  read: boolean;
  meta?: Record<string, any>;
}

export interface NotifPrefs {
  sound_enabled: boolean;
  disabled_types: string[];
  dnd_start: string | null;
  dnd_end: string | null;
}

interface ServerNotif {
  id: number; type: string; priority: 'P1' | 'P2' | 'P3';
  title: string; message: string; link: string;
  meta: Record<string, any>; is_read: boolean; created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private ws = inject(WebSocketService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private branding = inject(BrandingService);
  private base = `${environment.apiUrl}/notifications`;
  private permAsked = false;

  list = signal<AppNotification[]>([]);
  unread = signal(0);
  bellPulse = signal(false);
  prefs = signal<NotifPrefs>({ sound_enabled: true, disabled_types: [], dnd_start: null, dnd_end: null });

  private lastSeenWsId = 0;
  private readonly kindMap: Record<string, NotifKind> = {
    sale: 'sale', order: 'order', order_paid: 'order', order_status: 'order',
    shipment_updated: 'order', low_stock: 'low_stock',
    affiliate_commission: 'sale', affiliate_payout: 'sale', affiliate_new: 'user',
    'return': 'info', review: 'review', review_posted: 'review',
    user_registered: 'user', customer_new: 'user', newsletter_digest: 'info',
  };

  /** Estado del permiso de notificaciones de escritorio (para la UI). */
  desktopPermission = signal<'default' | 'granted' | 'denied' | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  constructor() {
    // En cada gesto del usuario: desbloquea el audio (autoplay) y, si ya inició
    // sesión, pide una vez el permiso de notificaciones de escritorio.
    if (typeof document !== 'undefined') {
      const onGesture = () => {
        this.primeSound();
        if (!this.permAsked && this.auth.user()) {
          this.permAsked = true;
          this.requestDesktopPermission();
        }
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, onGesture, { passive: true }));
    }

    // Conecta/hidrata al iniciar sesión; limpia al salir.
    effect(() => {
      const u = this.auth.user();
      if (u) { this.hydrate(); this.ws.connect(); }
      else { this.list.set([]); this.unread.set(0); this.ws.disconnect(); }
    }, { allowSignalWrites: true });

    // Fusiona en vivo lo que llega por WebSocket.
    effect(() => {
      const wsList = this.ws.notifications();
      const fresh = wsList.filter(n => n.id > this.lastSeenWsId);
      if (fresh.length === 0) return;
      for (const wsN of [...fresh].reverse()) {
        const s = wsN.data as ServerNotif;
        if (!s || s.id == null) continue;
        this.ingest(s, true);
      }
      this.lastSeenWsId = Math.max(...wsList.map(n => n.id));
    }, { allowSignalWrites: true });
  }

  /** Carga historial + no-leídas desde el servidor (1 sola llamada, sin polling). */
  hydrate() {
    this.http.get<{ results: ServerNotif[] }>(this.base + '/').subscribe({
      next: r => {
        const items = (r.results || []).map(s => this.toApp(s));
        this.list.set(items);
      },
      error: () => {},
    });
    this.http.get<{ count: number }>(this.base + '/unread-count/').subscribe({
      next: r => this.unread.set(r.count || 0),
      error: () => {},
    });
    this.loadPreferences();
  }

  loadPreferences() {
    this.http.get<NotifPrefs>(this.base + '/preferences/').subscribe({
      next: p => this.prefs.set(p),
      error: () => {},
    });
  }

  savePreferences(patch: Partial<NotifPrefs>) {
    this.http.put<NotifPrefs>(this.base + '/preferences/', patch).subscribe({
      next: p => this.prefs.set(p),
      error: () => {},
    });
  }

  private inDnd(): boolean {
    const { dnd_start, dnd_end } = this.prefs();
    if (!dnd_start || !dnd_end) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = dnd_start.split(':').map(Number);
    const [eh, em] = dnd_end.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em;
    if (start === end) return false;
    return start < end ? (cur >= start && cur < end) : (cur >= start || cur < end);
  }

  /** Inserta una notificación (viva) evitando duplicados; dispara sonido/pulse/escritorio. */
  private ingest(s: ServerNotif, live: boolean) {
    const id = String(s.id);
    if (this.list().some(n => n.id === id)) return;
    this.list.update(l => [this.toApp(s), ...l].slice(0, 50));
    if (live && !s.is_read) {
      this.unread.update(c => c + 1);
      this.playSound(s.priority);
      this.triggerPulse();
      this.notifyDesktop(s);
    }
  }

  /** Pide (o re-consulta) el permiso de notificaciones de escritorio. Puede llamarse
   *  desde un botón explícito (recomendado en Brave, que a veces bloquea el prompt). */
  requestDesktopPermission(): void {
    this.permAsked = true;
    if (typeof Notification === 'undefined') { this.desktopPermission.set('unsupported'); return; }
    if (Notification.permission === 'granted') { this.desktopPermission.set('granted'); return; }
    try {
      Notification.requestPermission().then(p => this.desktopPermission.set(p as any)).catch(() => {});
    } catch {}
  }

  /** Muestra una notificación NATIVA del sistema (fuera del navegador). Solo si el
   *  usuario dio permiso, no está en No Molestar, y el panel no está enfocado. */
  private notifyDesktop(s: ServerNotif) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (this.inDnd()) return;
    try {
      const icon = this.branding.faviconUrl() || this.branding.logoUrl() || 'assets/images/favicon-256.png';
      const note = new Notification(s.title || 'Notificación', {
        body: s.message || '',
        icon,
        tag: 'dlx-notif-' + s.id,
      });
      note.onclick = () => {
        try { window.focus(); } catch {}
        if (s.link) this.router.navigateByUrl(s.link).catch(() => {});
        note.close();
      };
    } catch { /* el navegador puede bloquearlo */ }
  }

  private toApp(s: ServerNotif): AppNotification {
    return {
      id: String(s.id),
      kind: this.kindMap[s.type] || 'info',
      priority: s.priority || 'P2',
      title: s.title,
      message: s.message,
      link: s.link,
      createdAt: s.created_at,
      read: s.is_read,
      meta: s.meta,
    };
  }

  markAsRead(id: string) {
    const n = this.list().find(x => x.id === id);
    if (n && !n.read) this.unread.update(c => Math.max(0, c - 1));
    this.list.update(l => l.map(x => x.id === id ? { ...x, read: true } : x));
    this.http.post(this.base + '/mark-read/', { ids: [Number(id)] }).subscribe({ error: () => {} });
  }

  markAllRead() {
    this.list.update(l => l.map(n => ({ ...n, read: true })));
    this.unread.set(0);
    this.http.post(this.base + '/mark-all-read/', {}).subscribe({ error: () => {} });
  }

  remove(id: string) {
    const n = this.list().find(x => x.id === id);
    if (n && !n.read) this.unread.update(c => Math.max(0, c - 1));
    this.list.update(l => l.filter(x => x.id !== id));
  }

  clear() {
    this.list.set([]);
    this.unread.set(0);
    this.http.post(this.base + '/mark-all-read/', {}).subscribe({ error: () => {} });
  }

  private triggerPulse() {
    this.bellPulse.set(true);
    setTimeout(() => this.bellPulse.set(false), 900);
  }

  private readonly soundUrl = 'assets/sounds/sound-notification.mp3';
  private audioEl: HTMLAudioElement | null = null;
  private soundPrimed = false;

  private ensureSound(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.audioEl) {
      this.audioEl = new Audio(this.soundUrl);
      this.audioEl.preload = 'auto';
    }
    return this.audioEl;
  }

  /** "Desbloquea" el audio en el primer gesto (reproduce mudo y pausa), para que
   *  luego play() funcione aunque la notificación llegue sin interacción directa. */
  private primeSound(): void {
    if (this.soundPrimed) return;
    const a = this.ensureSound();
    if (!a) return;
    this.soundPrimed = true;
    const vol = a.volume;
    a.volume = 0;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = vol; })
      .catch(() => { a.volume = vol; });
  }

  /** Sonido de notificación (archivo mp3). P3 no suena. */
  private playSound(priority: 'P1' | 'P2' | 'P3') {
    if (priority === 'P3') return;
    if (!this.prefs().sound_enabled) return;
    if (this.inDnd()) return;
    const a = this.ensureSound();
    if (!a) return;
    try {
      a.currentTime = 0;
      a.volume = priority === 'P1' ? 1.0 : 0.6;
      a.play().catch(() => {});
    } catch { /* bloqueado hasta el primer gesto */ }
  }
}
