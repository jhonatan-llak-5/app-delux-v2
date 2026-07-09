import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { DlxStatCardComponent } from '@shared/ui';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { NotifyService } from '@shared/services/notify.service';
import { WebSocketService } from '@core/services/websocket.service';

interface ContactMsg {
  id: number; name: string; email: string; phone: string;
  subject: string; message: string; is_read: boolean; created_at: string;
}

@Component({
  selector: 'dlx-contact-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DlxEmptyStateComponent, DlxStatCardComponent, DlxSearchInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-inbox"></i>
          <span class="uppercase tracking-widest font-semibold">Comunicación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mensajes de contacto</h1>
        <p class="text-slate-500 text-sm mt-1">Mensajes recibidos desde el formulario de contacto de la web.</p>
      </div>
      <button class="btn-secondary text-sm" (click)="load()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Total" [value]="rows().length" icon="fa-inbox" />
      <dlx-stat-card label="Sin leer" [value]="unreadCount()" icon="fa-envelope"
                     iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-600 dark:text-amber-400" />
    </div>

    <div class="card p-4 mb-4">
      <dlx-search-input [fluid]="true" [value]="search()" (valueChange)="search.set($event)"
                        placeholder="Buscar por nombre, email, teléfono o mensaje…" class="w-full" />
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
      } @else if (filtered().length === 0) {
        <dlx-empty-state icon="fa-inbox" title="No hay mensajes de contacto." />
      } @else {
        <ul class="divide-y divide-slate-100 dark:divide-white/5">
          @for (m of filtered(); track m.id) {
            <li class="p-4 md:p-5 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition"
                [class.bg-\[var(--dash-primary)\]/5]="!m.is_read">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    @if (!m.is_read) {
                      <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)] shrink-0"></span>
                    }
                    <p class="font-semibold truncate">{{ m.name }}</p>
                    @if (m.subject) {
                      <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500">
                        {{ subjectLabel(m.subject) }}
                      </span>
                    }
                    <span class="text-xs text-slate-400">{{ m.created_at | date:'short' }}</span>
                  </div>
                  <div class="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                    <a [href]="'mailto:' + m.email" class="hover:text-sky-500"><i class="fa-solid fa-envelope w-4"></i> {{ m.email }}</a>
                    <a [href]="waLink(m.phone)" target="_blank" rel="noopener" class="hover:text-emerald-500"><i class="fa-brands fa-whatsapp w-4"></i> {{ m.phone }}</a>
                  </div>
                  <p class="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line">{{ m.message }}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  @if (!m.is_read) {
                    <button (click)="markRead(m)" title="Marcar como leído"
                            class="w-9 h-9 rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition text-slate-400">
                      <i class="fa-solid fa-check text-sm"></i>
                    </button>
                  }
                  <button (click)="remove(m)" title="Eliminar"
                          class="w-9 h-9 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition text-slate-400">
                    <i class="fa-solid fa-trash text-sm"></i>
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class ContactMessagesComponent implements OnInit {
  private http = inject(HttpClient);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private ws = inject(WebSocketService);
  private base = `${environment.apiUrl}/admin/settings/messages`;
  private lastWsId = 0;

  constructor() {
    // Actualiza la lista en vivo cuando llega un mensaje de contacto por WebSocket.
    effect(() => {
      const items = this.ws.notifications();
      const latest = items[0];
      if (latest && latest.type === 'contact_message' && latest.id !== this.lastWsId) {
        this.lastWsId = latest.id;
        this.load();
      }
    }, { allowSignalWrites: true });
  }

  rows = signal<ContactMsg[]>([]);
  loading = signal(true);
  search = signal('');
  unreadCount = computed(() => this.rows().filter(m => !m.is_read).length);
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(m =>
      [m.name, m.email, m.phone, m.subject, m.message].some(v => (v || '').toLowerCase().includes(q)));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<ContactMsg[]>(`${this.base}/`).subscribe({
      next: r => { this.rows.set(r || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  markRead(m: ContactMsg) {
    this.http.post<ContactMsg>(`${this.base}/${m.id}/mark_read/`, {}).subscribe({
      next: () => this.rows.update(list => list.map(x => x.id === m.id ? { ...x, is_read: true } : x)),
      error: () => this.notify.error('No se pudo actualizar.'),
    });
  }

  async remove(m: ContactMsg) {
    const ok = await this.confirm.ask({
      title: 'Eliminar mensaje',
      message: `¿Eliminar el mensaje de ${m.name}? Esta acción es permanente.`,
      variant: 'danger', confirmText: 'Eliminar',
    });
    if (!ok) return;
    this.http.delete(`${this.base}/${m.id}/`).subscribe({
      next: () => { this.rows.update(list => list.filter(x => x.id !== m.id)); this.notify.success('Mensaje eliminado'); },
      error: () => this.notify.error('No se pudo eliminar.'),
    });
  }

  waLink(phone: string) { return 'https://wa.me/' + (phone || '').replace(/[^0-9]/g, ''); }
  subjectLabel(s: string) {
    return ({ compra: 'Cómo comprar', pedido: 'Pedido', producto: 'Producto', pago: 'Pagos', cuenta: 'Cuenta', otro: 'Otro' } as any)[s] || s;
  }
}
