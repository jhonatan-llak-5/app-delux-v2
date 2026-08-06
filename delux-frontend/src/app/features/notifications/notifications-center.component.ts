import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { NotificationsService } from '@shared/services/notifications.service';
import { AuthService } from '@core/services/auth.service';

interface Row {
  id: number; type: string; priority: 'P1' | 'P2' | 'P3';
  title: string; message: string; link: string;
  is_read: boolean; created_at: string;
}

const TYPES: { v: string; label: string }[] = [
  { v: 'order_status', label: 'Estado de mis pedidos' },
  { v: 'sale', label: 'Ventas POS' },
  { v: 'order', label: 'Pedidos web' },
  { v: 'order_paid', label: 'Pedidos pagados' },
  { v: 'low_stock', label: 'Stock bajo' },
  { v: 'return', label: 'Devoluciones' },
  { v: 'review', label: 'Reseñas' },
  { v: 'affiliate_commission', label: 'Comisiones (afiliado)' },
  { v: 'affiliate_payout', label: 'Pagos (afiliado)' },
  { v: 'affiliate_new', label: 'Nuevos afiliados' },
  { v: 'customer_new', label: 'Nuevos clientes' },
  { v: 'newsletter_digest', label: 'Suscriptores (resumen)' },
];

// Tipos de notificación visibles según el rol. El cliente solo ve lo suyo
// (estado de sus pedidos); el afiliado, sus comisiones/pagos; el staff, lo
// operativo; y admins/superadmin, todo.
const ROLE_TYPES: Record<string, string[]> = {
  CUSTOMER: ['order_status'],
  AFFILIATE: ['order_status', 'affiliate_commission', 'affiliate_payout'],
  SALESPERSON: ['order_status', 'sale', 'order', 'order_paid', 'low_stock', 'return', 'review', 'customer_new'],
  WAREHOUSE: ['low_stock', 'order'],
};
// GERENTE (BRANCH_MANAGER) y SUPERADMIN ven todos los tipos.

@Component({
  selector: 'dlx-notifications-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <header class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold" [style.color]="'var(--dash-text)'">Centro de notificaciones</h1>
          <p class="text-sm" [style.color]="'var(--dash-text-muted)'">
            {{ svc.unread() }} sin leer · {{ count() }} en total
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="eg-btn-ghost text-sm" (click)="showPrefs.set(!showPrefs())">
            <i class="fa-solid fa-sliders"></i> Preferencias
          </button>
          <button class="eg-btn-ghost text-sm" (click)="markAll()" [disabled]="svc.unread() === 0">
            <i class="fa-solid fa-check-double"></i> Marcar todas
          </button>
          <button class="eg-btn-ghost text-sm text-rose-600" (click)="clearAll()">
            <i class="fa-solid fa-trash"></i> Limpiar
          </button>
        </div>
      </header>

      <!-- Preferencias -->
      @if (showPrefs()) {
        <section class="rounded-xl border p-4 mb-5" [style.background-color]="'var(--dash-card)'"
                 [style.border-color]="'var(--dash-border)'">
          <h2 class="font-semibold mb-3" [style.color]="'var(--dash-text)'">Preferencias de sonido y avisos</h2>

          <label class="flex items-center gap-2 mb-4 cursor-pointer text-sm" [style.color]="'var(--dash-text)'">
            <input type="checkbox" [ngModel]="svc.prefs().sound_enabled"
                   (ngModelChange)="toggleSound($event)">
            Reproducir sonido al recibir notificaciones
          </label>

          <div class="mb-4">
            <p class="text-sm font-medium mb-1" [style.color]="'var(--dash-text)'">No molestar (silencia el sonido)</p>
            <div class="flex items-center gap-2 text-sm" [style.color]="'var(--dash-text-muted)'">
              <span>Desde</span>
              <input type="time" class="eg-input w-28" [(ngModel)]="dndStart">
              <span>hasta</span>
              <input type="time" class="eg-input w-28" [(ngModel)]="dndEnd">
              <button class="eg-btn-ghost text-xs" (click)="saveDnd()">Guardar</button>
              <button class="eg-btn-ghost text-xs" (click)="clearDnd()">Quitar</button>
            </div>
          </div>

          <div>
            <p class="text-sm font-medium mb-2" [style.color]="'var(--dash-text)'">Tipos que deseo recibir</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              @for (t of types(); track t.v) {
                <label class="flex items-center gap-2 text-sm cursor-pointer" [style.color]="'var(--dash-text-muted)'">
                  <input type="checkbox" [checked]="!isDisabled(t.v)" (change)="toggleType(t.v)">
                  {{ t.label }}
                </label>
              }
            </div>
          </div>
        </section>
      }

      <!-- Filtros -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <label class="flex items-center gap-1.5 text-sm cursor-pointer" [style.color]="'var(--dash-text-muted)'">
          <input type="checkbox" [(ngModel)]="onlyUnread" (ngModelChange)="reload()"> Solo no leídas
        </label>
        <select class="eg-input text-sm" [(ngModel)]="fType" (ngModelChange)="reload()">
          <option value="">Todos los tipos</option>
          @for (t of types(); track t.v) { <option [value]="t.v">{{ t.label }}</option> }
        </select>
        <select class="eg-input text-sm" [(ngModel)]="fPriority" (ngModelChange)="reload()">
          <option value="">Toda prioridad</option>
          <option value="P1">Urgente</option>
          <option value="P2">Importante</option>
          <option value="P3">Informativa</option>
        </select>
      </div>

      <!-- Lista -->
      <div class="rounded-xl border overflow-hidden" [style.background-color]="'var(--dash-card)'"
           [style.border-color]="'var(--dash-border)'">
        @if (loading()) {
          <div class="p-8 text-center text-sm" [style.color]="'var(--dash-text-muted)'">Cargando…</div>
        } @else if (items().length === 0) {
          <div class="p-10 text-center">
            <i class="fa-regular fa-bell-slash text-2xl mb-2" [style.color]="'var(--dash-text-soft)'"></i>
            <p class="text-sm" [style.color]="'var(--dash-text-muted)'">Sin notificaciones.</p>
          </div>
        } @else {
          @for (n of items(); track n.id) {
            <div class="flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-[var(--dash-hover)]"
                 [style.border-color]="'var(--dash-border)'" [class.opacity-60]="n.is_read" (click)="open(n)">
              <span class="w-2 h-2 rounded-full mt-2 shrink-0" [ngClass]="dot(n.priority)"></span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold" [style.color]="'var(--dash-text)'">{{ n.title }}
                  <span class="text-[10px] font-medium px-1.5 py-0.5 rounded ml-1" [ngClass]="badge(n.priority)">{{ prioLabel(n.priority) }}</span>
                </p>
                @if (n.message) { <p class="text-xs mt-0.5" [style.color]="'var(--dash-text-muted)'">{{ n.message }}</p> }
                <p class="text-[11px] mt-1" [style.color]="'var(--dash-text-soft)'">{{ typeLabel(n.type) }} · {{ n.created_at | date:'short' }}</p>
              </div>
              @if (!n.is_read) {
                <button class="eg-btn-ghost text-xs shrink-0" (click)="$event.stopPropagation(); markOne(n)">Marcar leída</button>
              }
            </div>
          }
        }
      </div>

      <!-- Paginación -->
      @if (pages() > 1) {
        <div class="flex items-center justify-center gap-2 mt-4 text-sm">
          <button class="eg-btn-ghost" [disabled]="page() <= 1" (click)="goto(page() - 1)">Anterior</button>
          <span [style.color]="'var(--dash-text-muted)'">Página {{ page() }} de {{ pages() }}</span>
          <button class="eg-btn-ghost" [disabled]="page() >= pages()" (click)="goto(page() + 1)">Siguiente</button>
        </div>
      }
    </div>
  `,
})
export class NotificationsCenterComponent implements OnInit {
  svc = inject(NotificationsService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private base = `${environment.apiUrl}/notifications`;

  // Tipos visibles según el rol del usuario (los admins ven todos).
  types = computed(() => {
    const role = (this.auth.user()?.role || '').toUpperCase();
    const allowed = ROLE_TYPES[role];
    return allowed ? TYPES.filter(t => allowed.includes(t.v)) : TYPES;
  });
  items = signal<Row[]>([]);
  count = signal(0);
  page = signal(1);
  loading = signal(true);
  showPrefs = signal(false);

  onlyUnread = false;
  fType = '';
  fPriority = '';
  dndStart = '';
  dndEnd = '';

  pages = computed(() => Math.max(1, Math.ceil(this.count() / 20)));

  ngOnInit() {
    const p = this.svc.prefs();
    this.dndStart = (p.dnd_start || '').slice(0, 5);
    this.dndEnd = (p.dnd_end || '').slice(0, 5);
    this.load();
  }

  load() {
    this.loading.set(true);
    let params = new HttpParams().set('page', this.page());
    if (this.onlyUnread) params = params.set('unread', 'true');
    if (this.fType) params = params.set('type', this.fType);
    if (this.fPriority) params = params.set('priority', this.fPriority);
    this.http.get<{ count: number; results: Row[] }>(this.base + '/', { params }).subscribe({
      next: r => { this.items.set(r.results || []); this.count.set(r.count || 0); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }
  reload() { this.page.set(1); this.load(); }
  goto(p: number) { this.page.set(p); this.load(); }

  open(n: Row) {
    if (!n.is_read) this.markOne(n);
    if (n.link) this.router.navigateByUrl(n.link);
  }
  markOne(n: Row) {
    this.http.post(this.base + '/mark-read/', { ids: [n.id] }).subscribe({
      next: () => {
        this.items.update(l => l.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        this.svc.hydrate();
      }, error: () => {},
    });
  }
  markAll() { this.svc.markAllRead(); setTimeout(() => this.load(), 200); }
  clearAll() {
    this.http.delete(this.base + '/clear/').subscribe({
      next: () => { this.svc.list.set([]); this.svc.unread.set(0); this.load(); }, error: () => {},
    });
  }

  // Preferencias
  isDisabled(t: string) { return (this.svc.prefs().disabled_types || []).includes(t); }
  toggleType(t: string) {
    const cur = this.svc.prefs().disabled_types || [];
    const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
    this.svc.savePreferences({ disabled_types: next });
  }
  toggleSound(v: boolean) { this.svc.savePreferences({ sound_enabled: v }); }
  saveDnd() {
    this.svc.savePreferences({
      dnd_start: this.dndStart ? this.dndStart + ':00' : null,
      dnd_end: this.dndEnd ? this.dndEnd + ':00' : null,
    });
  }
  clearDnd() { this.dndStart = ''; this.dndEnd = ''; this.svc.savePreferences({ dnd_start: null, dnd_end: null }); }

  // Etiquetas/estilos
  typeLabel(t: string) { return TYPES.find(x => x.v === t)?.label || t; }
  prioLabel(p: string) { return p === 'P1' ? 'Urgente' : p === 'P2' ? 'Importante' : 'Info'; }
  dot(p: string) { return p === 'P1' ? 'bg-rose-500' : p === 'P2' ? 'bg-amber-500' : 'bg-slate-400'; }
  badge(p: string) {
    return p === 'P1' ? 'bg-rose-100 text-rose-700' : p === 'P2' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  }
}
