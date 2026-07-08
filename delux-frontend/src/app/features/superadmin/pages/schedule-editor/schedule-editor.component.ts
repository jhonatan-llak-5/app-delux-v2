import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleService, BranchSchedule } from '@features/superadmin/services/schedule.service';
import { parseApiError } from '@shared/utils/api-error.util';

interface DayRow {
  weekday: number;
  label: string;
  short: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const WEEKDAYS = [
  { weekday: 0, label: 'Lunes',     short: 'L' },
  { weekday: 1, label: 'Martes',    short: 'M' },
  { weekday: 2, label: 'Miércoles', short: 'X' },
  { weekday: 3, label: 'Jueves',    short: 'J' },
  { weekday: 4, label: 'Viernes',   short: 'V' },
  { weekday: 5, label: 'Sábado',    short: 'S' },
  { weekday: 6, label: 'Domingo',   short: 'D' },
];

@Component({
  selector: 'dlx-schedule-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-clock"></i>
          <span class="uppercase tracking-widest font-semibold">Operación</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Horarios de atención</h1>
        <p class="text-slate-500 text-sm mt-1">Define apertura y cierre por día. Usa el selector de sucursal de la parte superior.</p>
      </div>
    </div>

    @if (!branchId()) {
      <div class="card p-8 text-center border-2 border-dashed border-[var(--dash-primary)]/40 bg-[var(--dash-primary)]/5">
        <div class="w-14 h-14 rounded-full bg-[var(--dash-primary)]/15 text-[var(--dash-primary)] grid place-items-center mx-auto mb-4">
          <i class="fa-solid fa-store text-2xl"></i>
        </div>
        <h3 class="font-bold text-lg text-[var(--dash-primary-d)] dark:text-blue-300">Selecciona una sucursal</h3>
        <p class="text-slate-500 text-sm mt-1 max-w-md mx-auto">
          Elige una sucursal en el selector <b>de la parte superior</b> para establecer su horario de atención.
        </p>
      </div>
    } @else {
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Tabla editor -->
        <div class="lg:col-span-2">
          <div class="card overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Día</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Apertura</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Cierre</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Cerrado</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                @for (d of days(); track d.weekday; let i = $index) {
                  <tr class="border-t border-slate-100">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2.5">
                        <span class="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center font-bold text-xs">
                          {{ d.short }}
                        </span>
                        <span class="font-semibold text-sm">{{ d.label }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <input type="time" [(ngModel)]="d.open_time" [disabled]="d.is_closed"
                             class="eg-input disabled:opacity-40 disabled:cursor-not-allowed" />
                    </td>
                    <td class="px-4 py-3">
                      <input type="time" [(ngModel)]="d.close_time" [disabled]="d.is_closed"
                             class="eg-input disabled:opacity-40 disabled:cursor-not-allowed" />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" [(ngModel)]="d.is_closed" class="w-4 h-4 accent-rose-500" />
                      </label>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button type="button" (click)="copyToAll(d)" title="Copiar a todos los días"
                              class="text-xs text-slate-500 hover:text-ink-950">
                        <i class="fa-solid fa-copy"></i>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (savedAt()) {
            <p class="text-xs text-emerald-600 mt-3 flex items-center gap-1.5">
              <i class="fa-solid fa-circle-check"></i>
              Guardado a las {{ savedAt() | date:'shortTime' }}
            </p>
          }

          @if (error()) {
            <div class="card p-4 mt-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }
        </div>

        <!-- Preview + acciones -->
        <div class="space-y-4">
          <div class="card p-5">
            <h3 class="font-bold tracking-tight mb-3 flex items-center gap-2">
              <i class="fa-solid fa-eye text-slate-400"></i> Vista previa
            </h3>
            <ul class="space-y-1.5 text-sm">
              @for (d of days(); track d.weekday) {
                <li class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span class="font-semibold text-slate-700">{{ d.label }}</span>
                  @if (d.is_closed) {
                    <span class="text-rose-600 text-xs font-semibold">Cerrado</span>
                  } @else {
                    <span class="font-mono text-xs text-slate-600">
                      {{ d.open_time || '—' }} - {{ d.close_time || '—' }}
                    </span>
                  }
                </li>
              }
            </ul>
          </div>

          <div class="card p-5 space-y-2">
            <h3 class="font-bold tracking-tight mb-2">Plantillas rápidas</h3>
            <button type="button" (click)="applyTemplate('weekdays')" class="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 text-xs font-semibold text-left">
              <i class="fa-solid fa-briefcase text-slate-500"></i> Lun-Vie 09:00-18:00
            </button>
            <button type="button" (click)="applyTemplate('mall')" class="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 text-xs font-semibold text-left">
              <i class="fa-solid fa-shopping-bag text-slate-500"></i> Todos los días 10:00-21:00
            </button>
            <button type="button" (click)="applyTemplate('weekend')" class="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 text-xs font-semibold text-left">
              <i class="fa-solid fa-umbrella-beach text-slate-500"></i> Solo sáb-dom 11:00-20:00
            </button>
          </div>

          <button type="button" (click)="save()" [disabled]="saving()"
                  class="w-full px-5 py-3 rounded-lg bg-ink-950 text-white text-sm font-semibold
                         hover:bg-ink-900 disabled:opacity-50 transition flex items-center justify-center gap-2">
            @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
            @else { <i class="fa-solid fa-floppy-disk"></i> Guardar horario }
          </button>
        </div>
      </div>
    }
  `,
})
export class ScheduleEditorComponent {
  auth = inject(AuthService);
  branchCtx = inject(BranchContextService);
  private svc = inject(ScheduleService);

  branchId = signal<number | null>(null);
  days = signal<DayRow[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);
  savedAt = signal<Date | null>(null);

  constructor() {
    // Sigue el selector global de sucursal del header.
    effect(() => {
      const id = this.branchCtx.current();
      this.branchId.set(id);
      if (id) this.loadBranch();
      else this.days.set([]);
    }, { allowSignalWrites: true });
  }

  loadBranch() {
    const id = this.branchId();
    if (!id) return;
    this.savedAt.set(null);
    // Cargar horarios existentes o crear default
    this.svc.list(id).subscribe(r => {
      const existing = new Map(r.results.map(s => [s.weekday, s]));
      const rows: DayRow[] = WEEKDAYS.map(w => {
        const found = existing.get(w.weekday);
        return {
          weekday: w.weekday, label: w.label, short: w.short,
          open_time: found?.open_time?.slice(0, 5) || '10:00',
          close_time: found?.close_time?.slice(0, 5) || '20:00',
          is_closed: found?.is_closed || false,
        };
      });
      this.days.set(rows);
    });
  }

  copyToAll(d: DayRow) {
    const list = this.days().map(x => ({ ...x, open_time: d.open_time, close_time: d.close_time, is_closed: d.is_closed }));
    this.days.set(list);
  }

  applyTemplate(t: 'weekdays' | 'mall' | 'weekend') {
    const list = this.days().map(d => {
      if (t === 'weekdays') {
        return { ...d, open_time: '09:00', close_time: '18:00', is_closed: d.weekday > 4 };
      }
      if (t === 'mall') {
        return { ...d, open_time: '10:00', close_time: '21:00', is_closed: false };
      }
      // weekend
      return { ...d, open_time: '11:00', close_time: '20:00', is_closed: d.weekday < 5 };
    });
    this.days.set(list);
  }

  save() {
    const id = this.branchId();
    if (!id) return;
    this.saving.set(true);
    this.error.set(null);
    const payload: BranchSchedule[] = this.days().map(d => ({
      branch: id,
      weekday: d.weekday,
      open_time: d.is_closed ? null : `${d.open_time}:00`,
      close_time: d.is_closed ? null : `${d.close_time}:00`,
      is_closed: d.is_closed,
    }));
    this.svc.bulkSave(payload).subscribe({
      next: () => { this.saving.set(false); this.savedAt.set(new Date()); },
      error: e => {
        this.saving.set(false);
        this.error.set(parseApiError(e).message || 'Error al guardar');
      },
    });
  }
}
