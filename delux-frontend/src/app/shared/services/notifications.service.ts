import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { WebSocketService } from '@core/services/websocket.service';
import { AuthService } from '@core/services/auth.service';

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
  private base = `${environment.apiUrl}/notifications`;

  list = signal<AppNotification[]>([]);
  unread = signal(0);
  bellPulse = signal(false);
  prefs = signal<NotifPrefs>({ sound_enabled: true, disabled_types: [], dnd_start: null, dnd_end: null });

  private lastSeenWsId = 0;
  private readonly kindMap: Record<string, NotifKind> = {
    sale: 'sale', order: 'order', order_paid: 'order', low_stock: 'low_stock',
    affiliate_commission: 'sale', affiliate_payout: 'sale', affiliate_new: 'user',
    'return': 'info', review: 'review', review_posted: 'review',
    user_registered: 'user', customer_new: 'user', newsletter_digest: 'info',
  };

  constructor() {
    // Desbloquea el audio en el primer gesto del usuario (política de autoplay
    // del navegador): a partir de ahí, las notificaciones ya pueden sonar.
    if (typeof document !== 'undefined') {
      const unlock = () => this.ensureAudio();
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, unlock, { once: true, passive: true }));
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

  /** Inserta una notificación (viva) evitando duplicados; dispara sonido/pulse. */
  private ingest(s: ServerNotif, live: boolean) {
    const id = String(s.id);
    if (this.list().some(n => n.id === id)) return;
    this.list.update(l => [this.toApp(s), ...l].slice(0, 50));
    if (live && !s.is_read) {
      this.unread.update(c => c + 1);
      this.playSound(s.priority);
      this.triggerPulse();
    }
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

  private audioCtx: AudioContext | null = null;

  /** Crea/reanuda un único AudioContext. Los navegadores lo dejan "suspended"
   *  hasta el primer gesto del usuario; por eso lo desbloqueamos en constructor. */
  private ensureAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    if (!this.audioCtx) { try { this.audioCtx = new AC(); } catch { return null; } }
    if (this.audioCtx.state === 'suspended') { this.audioCtx.resume().catch(() => {}); }
    return this.audioCtx;
  }

  /** Sonido segun prioridad: P1 doble tono fuerte, P2 tono suave, P3 sin sonido. */
  private playSound(priority: 'P1' | 'P2' | 'P3') {
    if (priority === 'P3') return;
    if (!this.prefs().sound_enabled) return;
    if (this.inDnd()) return;
    try {
      const ctx = this.ensureAudio();
      if (!ctx || ctx.state !== 'running') return;
      const beep = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.02);
      };
      if (priority === 'P1') {
        // "cha-ching": dos tonos ascendentes, mas volumen
        beep(880, 0, 0.12, 0.22);
        beep(1320, 0.13, 0.20, 0.22);
      } else {
        // P2: un tono suave
        beep(660, 0, 0.18, 0.12);
      }
    } catch { /* bloqueado por el navegador hasta el primer gesto */ }
  }
}
