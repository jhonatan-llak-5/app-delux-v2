import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxStatCardComponent } from '@shared/ui';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxConfirmDialogComponent } from '@shared/ui/confirm-dialog.component';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { NewsletterService, Subscriber } from '@features/superadmin/services/newsletter.service';

@Component({
  selector: 'dlx-newsletter-subscribers',
  standalone: true,
  imports: [DlxStatCardComponent, CommonModule, FormsModule, DatePipe, DlxSearchInputComponent, DlxConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Suscriptores</h1>
        <p class="text-slate-500 text-sm mt-1">Personas suscritas para recibir campañas y ofertas.</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button class="btn-secondary text-sm" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
        <button class="btn-secondary text-sm" [disabled]="!rows().length" (click)="exportCsv()"><i class="fa-solid fa-file-csv"></i> CSV</button>
        <button class="btn-secondary text-sm" [disabled]="!rows().length" (click)="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <dlx-stat-card label="Total" [value]="rows().length" icon="fa-envelope" />
      <dlx-stat-card label="Activos" [value]="activeCount()" icon="fa-circle-check" iconBg="bg-emerald-50 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" />
      <dlx-stat-card label="Dados de baja" [value]="rows().length - activeCount()" icon="fa-user-slash" iconBg="bg-slate-100 dark:bg-white/10" iconColor="text-slate-500 dark:text-white/50" />
    </div>

    <div class="card p-3 mb-4">
      <dlx-search-input [fluid]="true" [value]="search" (valueChange)="search = $event; search$.next($event)"
        placeholder="Buscar por correo…" class="max-w-md" />
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (rows().length === 0) {
      <div class="card p-10 text-center text-slate-400">
        <i class="fa-solid fa-envelope-open-text text-3xl mb-3"></i>
        <p>Aún no hay suscriptores.</p>
      </div>
    } @else {
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">#</th>
                <th class="px-4 py-3 font-semibold">Correo</th>
                <th class="px-4 py-3 font-semibold text-center">Estado</th>
                <th class="px-4 py-3 font-semibold">Suscrito</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (s of rows(); track s.id; let i = $index) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-2.5 font-medium">{{ s.email }}</td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          [ngClass]="s.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40'">
                      {{ s.is_active ? 'Activo' : 'Baja' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-slate-500">{{ s.created_at | date:'dd/MM/yyyy' }}</td>
                  <td class="px-4 py-2.5 text-right">
                    @if (s.is_active) {
                      <button class="text-rose-600 hover:text-rose-700 text-sm font-semibold" (click)="ask(s)">
                        <i class="fa-solid fa-user-slash"></i> Dar de baja
                      </button>
                    } @else {
                      <span class="text-slate-400 text-xs">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <dlx-confirm-dialog
      [open]="!!target()"
      title="Dar de baja"
      [message]="target() ? ('Se dará de baja a ' + target()!.email + '. Ya no recibirá campañas.') : ''"
      variant="danger" icon="fa-user-slash" confirmText="Dar de baja" [loading]="saving()"
      (confirmed)="doDeactivate()" (cancelled)="target.set(null)" />
  `,
})
export class NewsletterSubscribersComponent implements OnInit {
  private svc = inject(NewsletterService);
  private notify = inject(NotifyService);

  rows = signal<Subscriber[]>([]);
  loading = signal(true);
  saving = signal(false);
  target = signal<Subscriber | null>(null);
  search = '';
  search$ = new Subject<string>();

  activeCount = computed(() => this.rows().filter(s => s.is_active).length);

  ngOnInit(): void {
    this.load();
    this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.search).subscribe({
      next: r => { this.rows.set(r || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  reload(): void { this.search = ''; this.load(); }

  ask(s: Subscriber): void { this.target.set(s); }

  doDeactivate(): void {
    const s = this.target();
    if (!s) return;
    this.saving.set(true);
    this.svc.deactivate(s.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.target.set(null);
        this.notify.success('Suscriptor dado de baja');
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(parseApiError(e).message || 'No se pudo dar de baja.');
      },
    });
  }

  exportCsv(): void {
    const header = ['#', 'Correo', 'Estado', 'Suscrito'];
    const lines = this.rows().map((s, i) =>
      [i + 1, s.email, s.is_active ? 'Activo' : 'Baja', this.fmt(s.created_at)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `suscriptores-${this.today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  exportPdf(): void {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Suscriptores del newsletter', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generado: ${this.fmt(new Date().toISOString())} · Total: ${this.rows().length}`, 14, 25);
    autoTable(doc, {
      startY: 30,
      head: [['#', 'Correo', 'Estado', 'Suscrito']],
      body: this.rows().map((s, i) => [i + 1, s.email, s.is_active ? 'Activo' : 'Baja', this.fmt(s.created_at)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 149, 246] },
    });
    doc.save(`suscriptores-${this.today()}.pdf`);
  }

  private fmt(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-EC');
  }
  private today(): string { return new Date().toISOString().slice(0, 10); }
}
