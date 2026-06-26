import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { StaffService, StaffPayload, SalesMetrics } from '@features/superadmin/services/staff.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-staff-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
      <a routerLink="/app/admin/staff" class="hover:text-ink-950">Equipo</a>
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
      <span class="uppercase tracking-widest font-semibold">
        {{ isEdit() ? 'Editar' : 'Nuevo' }}
      </span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-6">
      {{ isEdit() ? payload.full_name : 'Agregar miembro al equipo' }}
    </h1>

    <form (ngSubmit)="save()" #f="ngForm" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-6 space-y-4">
          <h2 class="font-bold tracking-tight">Información personal</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Nombre completo *</label>
              <input [(ngModel)]="payload.full_name" name="full_name" required maxlength="160"
                     class="eg-input" />
            </div>
            <div>
              <label class="eg-label">Email *</label>
              <input [(ngModel)]="payload.email" name="email" type="email" required
                     [disabled]="isEdit()"
                     class="eg-input disabled:bg-slate-100 disabled:text-slate-400" />
            </div>
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="payload.phone" name="phone" maxlength="30"
                     class="eg-input"
                     placeholder="+593 99 999 9999" />
            </div>
            <div>
              <label class="eg-label">Cédula / Documento</label>
              <input [(ngModel)]="payload.document_id" name="document_id" maxlength="30"
                     class="eg-input font-mono" />
            </div>
          </div>

          @if (!isEdit()) {
            <div>
              <label class="eg-label">Contraseña inicial</label>
              <input [(ngModel)]="payload.password" name="password" type="text" minlength="8"
                     class="eg-input font-mono"
                     placeholder="Mínimo 8 caracteres (se genera automáticamente si vacío)" />
              <p class="text-[10px] text-slate-400 mt-1">
                Si lo dejas en blanco, se genera una contraseña aleatoria. El usuario debe cambiarla en su primer login.
              </p>
            </div>
          }
        </div>

        @if (isEdit() && metrics()) {
          <div class="card p-6">
            <h2 class="font-bold tracking-tight mb-4 flex items-center gap-2">
              <i class="fa-solid fa-chart-line text-emerald-500"></i> Métricas de ventas
            </h2>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div class="p-3 rounded-lg bg-slate-50">
                <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Hoy</p>
                <p class="text-xl font-bold mt-1">{{ metrics()!.today_sales }}</p>
              </div>
              <div class="p-3 rounded-lg bg-slate-50">
                <p class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total ventas</p>
                <p class="text-xl font-bold mt-1">{{ metrics()!.total_sales }}</p>
              </div>
              <div class="p-3 rounded-lg bg-emerald-50">
                <p class="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">Hoy $</p>
                <p class="text-xl font-bold text-emerald-700 mt-1">\${{ metrics()!.today_revenue | number:'1.2-2' }}</p>
              </div>
              <div class="p-3 rounded-lg bg-emerald-50">
                <p class="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">Total $</p>
                <p class="text-xl font-bold text-emerald-700 mt-1">\${{ metrics()!.total_revenue | number:'1.2-2' }}</p>
              </div>
              <div class="p-3 rounded-lg bg-violet-50">
                <p class="text-[10px] uppercase tracking-widest text-violet-600 font-semibold">Comisión</p>
                <p class="text-xl font-bold text-violet-700 mt-1">\${{ metrics()!.commission_total | number:'1.2-2' }}</p>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="space-y-4">
        <div class="card p-6 space-y-4 lg:sticky lg:top-4">
          <h2 class="font-bold tracking-tight">Rol y asignación</h2>

          <div>
            <label class="eg-label">Rol *</label>
            <div class="grid grid-cols-1 gap-2">
              <button type="button" (click)="payload.role = 'TENANT_ADMIN'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition text-left flex items-center gap-3"
                      [class.bg-blue-100]="payload.role === 'TENANT_ADMIN'"
                      [class.border-blue-400]="payload.role === 'TENANT_ADMIN'"
                      [class.text-blue-700]="payload.role === 'TENANT_ADMIN'"
                      [class.border-slate-200]="payload.role !== 'TENANT_ADMIN'"
                      [class.text-slate-600]="payload.role !== 'TENANT_ADMIN'">
                <i class="fa-solid fa-shield-halved w-5 text-center"></i>
                <span>
                  <span class="block">Admin de tienda</span>
                  <span class="block text-[11px] font-normal opacity-70">Acceso total excepto Configuración del sitio</span>
                </span>
              </button>
              <button type="button" (click)="payload.role = 'BRANCH_MANAGER'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition text-left flex items-center gap-3"
                      [class.bg-violet-100]="payload.role === 'BRANCH_MANAGER'"
                      [class.border-violet-400]="payload.role === 'BRANCH_MANAGER'"
                      [class.text-violet-700]="payload.role === 'BRANCH_MANAGER'"
                      [class.border-slate-200]="payload.role !== 'BRANCH_MANAGER'"
                      [class.text-slate-600]="payload.role !== 'BRANCH_MANAGER'">
                <i class="fa-solid fa-user-tie w-5 text-center"></i>
                <span>
                  <span class="block">Gerente</span>
                  <span class="block text-[11px] font-normal opacity-70">Gestiona su sucursal: equipo, stock y ventas</span>
                </span>
              </button>
              <button type="button" (click)="payload.role = 'SALESPERSON'"
                      class="px-3 py-3 rounded-lg border text-sm font-semibold transition text-left flex items-center gap-3"
                      [class.bg-sky-100]="payload.role === 'SALESPERSON'"
                      [class.border-sky-400]="payload.role === 'SALESPERSON'"
                      [class.text-sky-700]="payload.role === 'SALESPERSON'"
                      [class.border-slate-200]="payload.role !== 'SALESPERSON'"
                      [class.text-slate-600]="payload.role !== 'SALESPERSON'">
                <i class="fa-solid fa-user-tag w-5 text-center"></i>
                <span>
                  <span class="block">Vendedor</span>
                  <span class="block text-[11px] font-normal opacity-70">Acceso al punto de venta de su sucursal</span>
                </span>
              </button>
            </div>
          </div>

          @if (payload.role !== 'TENANT_ADMIN') {
            <div>
              <label class="eg-label">Sucursal asignada *</label>
              <select [(ngModel)]="payload.branch" name="branch" required
                      class="eg-input">
                <option [ngValue]="null">— Seleccionar —</option>
                @for (b of branches(); track b.id) { <option [ngValue]="b.id">{{ b.name }} · {{ b.city }}</option> }
              </select>
            </div>
          }

          <div>
            <label class="eg-label">Fecha de ingreso</label>
            <input [(ngModel)]="payload.hire_date" name="hire_date" type="date"
                   class="eg-input" />
          </div>

          <div>
            <label class="eg-label">
              Comisión por venta (%)
            </label>
            <div class="relative">
              <input type="number" [(ngModel)]="payload.commission_rate" name="commission_rate"
                     min="0" max="100" step="0.5"
                     class="eg-input pr-8" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">
              Aplica sobre el monto total de cada venta cerrada por este vendedor.
            </p>
          </div>
        </div>

        @if (error()) {
          <div class="card p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        <div class="flex flex-col gap-2">
          <button type="submit" [disabled]="!f.valid || saving()"
                  class="px-5 py-3 rounded-lg bg-ink-950 text-white text-sm font-semibold
                         hover:bg-ink-900 disabled:opacity-50 transition flex items-center justify-center gap-2">
            @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
            @else { <i class="fa-solid fa-floppy-disk"></i> {{ isEdit() ? 'Guardar cambios' : 'Crear miembro' }} }
          </button>
          <a routerLink="/app/admin/staff"
             class="px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-center transition">
            Cancelar
          </a>
        </div>
      </div>
    </form>

    @if (createdCreds(); as c) {
      <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl
                    border border-ink-200 dark:border-white/10 overflow-hidden">
          <div class="p-6 text-center border-b border-ink-100 dark:border-white/10">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 grid place-items-center mx-auto mb-3">
              <i class="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
            </div>
            <h2 class="font-bold text-xl text-ink-950 dark:text-white">Usuario creado</h2>
            <p class="text-sm text-slate-500 mt-1">
              @if (c.generated) { Se generó una contraseña automática. }
              Guarda o comparte estas credenciales — la contraseña no se vuelve a mostrar.
            </p>
          </div>
          <div class="p-6 space-y-3">
            <div class="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Email</p>
                <p class="font-mono text-sm text-ink-950 dark:text-white truncate">{{ c.email }}</p>
              </div>
              <button (click)="copy(c.email)" class="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-xs font-semibold hover:bg-slate-300 transition">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
            <div class="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Contraseña</p>
                <p class="font-mono text-sm text-ink-950 dark:text-white truncate">{{ c.password }}</p>
              </div>
              <button (click)="copy(c.password)" class="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-xs font-semibold hover:bg-slate-300 transition">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
            <button (click)="copy(c.email + ' / ' + c.password)"
                    class="w-full h-10 rounded-xl border border-slate-200 dark:border-white/15 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition">
              <i class="fa-regular fa-clipboard"></i> Copiar ambos
            </button>
            <p class="text-[11px] text-center mt-1"
               [class.text-emerald-600]="c.emailed" [class.text-slate-400]="!c.emailed">
              <i class="fa-solid" [class.fa-envelope-circle-check]="c.emailed" [class.fa-circle-info]="!c.emailed"></i>
              {{ c.emailed ? 'También enviamos las credenciales por correo.' : 'Correo no enviado (configura el SMTP en Configuración para enviarlas automáticamente).' }}
            </p>
          </div>
          <div class="p-4 border-t border-ink-100 dark:border-white/10 flex gap-2">
            <button (click)="createAnother()" class="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-white/10 text-sm font-semibold hover:bg-slate-200 transition">
              Crear otro
            </button>
            <button (click)="goToList()" class="flex-1 h-11 rounded-xl bg-[#1e40af] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition">
              Ir a la lista
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class StaffFormComponent implements OnInit {
  private svc = inject(StaffService);
  private adminSvc = inject(AdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  branches = signal<AdminBranch[]>([]);
  staffId = signal<number | null>(null);
  isEdit = computed(() => this.staffId() !== null);
  saving = signal(false);
  error = signal<string | null>(null);
  metrics = signal<SalesMetrics | null>(null);
  createdCreds = signal<{ email: string; password: string; generated: boolean; emailed: boolean } | null>(null);

  payload: StaffPayload = {
    email: '', full_name: '', phone: '', document_id: '',
    role: 'SALESPERSON', branch: null as any,
    commission_rate: 5, hire_date: null,
    password: '',
  };

  ngOnInit() {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.staffId.set(+id);
      this.svc.get(+id).subscribe(s => {
        this.payload = {
          email: s.email, full_name: s.full_name,
          phone: s.phone, document_id: s.document_id,
          role: s.role, branch: s.branch!,
          commission_rate: +s.commission_rate,
          hire_date: s.hire_date,
        };
      });
      this.svc.metrics(+id).subscribe(m => this.metrics.set(m));
    }
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    const body = { ...this.payload };
    if (!body.password) delete body.password;
    const obs = this.isEdit()
      ? this.svc.update(this.staffId()!, body)
      : this.svc.create(body);
    obs.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (this.isEdit()) {
          this.router.navigate(['/app/admin/staff']);
        } else {
          // Mostrar credenciales una sola vez.
          this.createdCreds.set({
            email: res?.email || this.payload.email,
            password: res?.temp_password || this.payload.password || '(definida por ti)',
            generated: !!res?.password_generated,
            emailed: !!res?.credentials_emailed,
          });
        }
      },
      error: e => {
        this.saving.set(false);
        this.error.set(parseApiError(e).message || 'Error al guardar');
      },
    });
  }

  copy(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  goToList() { this.router.navigate(['/app/admin/staff']); }

  createAnother() {
    this.createdCreds.set(null);
    this.payload = {
      email: '', full_name: '', phone: '', document_id: '',
      role: 'SALESPERSON', branch: null as any,
      commission_rate: 5, hire_date: null, password: '',
    };
  }
}
