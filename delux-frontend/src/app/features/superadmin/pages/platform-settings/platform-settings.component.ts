import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, PlatformSettings } from '@features/superadmin/services/admin.service';

@Component({
  selector: 'dlx-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Configuración</h1>
      <p class="text-slate-500 text-sm mt-1">Email, branding, PayPhone y expiraciones de la plataforma.</p>
    </div>

    @if (form()) {
      <form (ngSubmit)="save()" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- SMTP -->
        <section class="card p-5 lg:col-span-2">
          <header class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 grid place-items-center">
              <i class="fa-solid fa-envelope text-sm"></i>
            </div>
            <div>
              <h2 class="font-semibold">Correo saliente (SMTP)</h2>
              <p class="text-xs text-slate-500">Servidor para emails de activación, recuperación y notificaciones.</p>
            </div>
          </header>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Host</span>
              <input class="dlx-input" [(ngModel)]="form()!.smtp_host" name="smtp_host" placeholder="smtp.gmail.com" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Puerto</span>
              <input type="number" class="dlx-input" [(ngModel)]="form()!.smtp_port" name="smtp_port" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Usuario</span>
              <input class="dlx-input" [(ngModel)]="form()!.smtp_username" name="smtp_username" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Contraseña</span>
              <input type="password" class="dlx-input" [(ngModel)]="form()!.smtp_password" name="smtp_password" placeholder="Dejar vacío para no cambiar" />
            </label>
            <label class="flex items-center gap-2 mt-2">
              <input type="checkbox" [(ngModel)]="form()!.smtp_use_tls" name="smtp_use_tls" class="w-4 h-4" />
              <span class="text-sm">Usar TLS</span>
            </label>
            <label class="flex items-center gap-2 mt-2">
              <input type="checkbox" [(ngModel)]="form()!.smtp_use_ssl" name="smtp_use_ssl" class="w-4 h-4" />
              <span class="text-sm">Usar SSL</span>
            </label>
          </div>

          <hr class="my-5 border-slate-200" />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Remitente (email)</span>
              <input class="dlx-input" [(ngModel)]="form()!.default_from_email" name="default_from_email" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Remitente (nombre)</span>
              <input class="dlx-input" [(ngModel)]="form()!.default_from_name" name="default_from_name" />
            </label>
            <label class="block md:col-span-2">
              <span class="text-xs font-semibold text-slate-500">Email de soporte</span>
              <input class="dlx-input" [(ngModel)]="form()!.support_email" name="support_email" />
            </label>
          </div>

          <hr class="my-5 border-slate-200" />

          <div class="flex flex-col md:flex-row gap-3 md:items-end">
            <label class="flex-1 block">
              <span class="text-xs font-semibold text-slate-500">Enviar correo de prueba a</span>
              <input class="dlx-input" [ngModel]="testTo()" (ngModelChange)="testTo.set($event)"
                     name="test_to" placeholder="tu@correo.com" [ngModelOptions]="{standalone: true}" />
            </label>
            <button type="button" (click)="sendTest()" [disabled]="!testTo() || testing()"
                    class="btn-secondary text-sm disabled:opacity-50">
              @if (testing()) { <i class="fa-solid fa-spinner fa-spin"></i> Enviando... }
              @else { <i class="fa-solid fa-paper-plane"></i> Enviar prueba }
            </button>
          </div>
          @if (testResult()) {
            <p class="text-sm mt-2" [class.text-emerald-600]="testOk()" [class.text-rose-600]="!testOk()">
              {{ testResult() }}
            </p>
          }
        </section>

        <!-- General -->
        <section class="card p-5">
          <header class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 grid place-items-center">
              <i class="fa-solid fa-gear text-sm"></i>
            </div>
            <div>
              <h2 class="font-semibold">General</h2>
              <p class="text-xs text-slate-500">Branding y expiraciones de códigos.</p>
            </div>
          </header>

          <div class="space-y-3">
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Nombre de la plataforma</span>
              <input class="dlx-input" [(ngModel)]="form()!.platform_name" name="platform_name" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Eslogan</span>
              <input class="dlx-input" [(ngModel)]="form()!.platform_tagline" name="platform_tagline" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Expiración código activación (min)</span>
              <input type="number" class="dlx-input" [(ngModel)]="form()!.activation_code_ttl_minutes" name="activation_ttl" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Expiración código reset (min)</span>
              <input type="number" class="dlx-input" [(ngModel)]="form()!.password_reset_ttl_minutes" name="reset_ttl" />
            </label>
          </div>
        </section>

        <!-- PayPhone -->
        <section class="card p-5 lg:col-span-3">
          <header class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 grid place-items-center">
              <i class="fa-solid fa-mobile-screen text-sm"></i>
            </div>
            <div class="flex-1">
              <h2 class="font-semibold">PayPhone — Pasarela de pago</h2>
              <p class="text-xs text-slate-500">
                Configura las credenciales de PayPhone. En sandbox o sin token, los pagos se simulan localmente.
              </p>
            </div>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="form()!.payphone_enabled" name="payphone_enabled" class="w-4 h-4 accent-violet-500" />
              <span class="text-sm font-semibold">Habilitado</span>
            </label>
          </header>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="block md:col-span-2">
              <span class="text-xs font-semibold text-slate-500">Token / API Key</span>
              <input class="dlx-input font-mono" [(ngModel)]="form()!.payphone_token" name="payphone_token"
                     [placeholder]="form()!.payphone_token_masked || 'Pegar token de PayPhone'" />
              @if (form()!.payphone_token_masked) {
                <p class="text-[10px] text-slate-400 mt-1">Actual: <span class="font-mono">{{ form()!.payphone_token_masked }}</span> (vacío = no cambiar)</p>
              }
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Store ID</span>
              <input class="dlx-input font-mono" [(ngModel)]="form()!.payphone_store_id" name="payphone_store_id" placeholder="ej. 12345" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">API URL</span>
              <input class="dlx-input" [(ngModel)]="form()!.payphone_api_url" name="payphone_api_url" />
            </label>
            <label class="flex items-center gap-2 mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 md:col-span-2">
              <input type="checkbox" [(ngModel)]="form()!.payphone_sandbox" name="payphone_sandbox" class="w-4 h-4 accent-amber-500" />
              <div>
                <p class="text-sm font-semibold text-amber-700">Modo sandbox</p>
                <p class="text-[11px] text-amber-600">Simula pagos sin llamar al API real. Recomendado en desarrollo.</p>
              </div>
            </label>
          </div>
        </section>

        <div class="lg:col-span-3 flex items-center justify-end gap-3">
          @if (saved()) {
            <span class="text-emerald-600 text-sm">Guardado correctamente.</span>
          }
          <button type="submit" class="btn-primary" [disabled]="saving()">
            <i class="fa-solid fa-floppy-disk"></i>
            {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    } @else {
      <div class="card p-6 text-slate-400">Cargando configuración...</div>
    }
  `,
  styles: [`
    .dlx-input {
      @apply mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200
             focus:bg-white focus:border-slate-400 focus:outline-none text-sm;
    }
  `],
})
export class PlatformSettingsComponent implements OnInit {
  private admin = inject(AdminService);

  form = signal<PlatformSettings | null>(null);
  saving = signal(false);
  saved = signal(false);
  testTo = signal('');
  testing = signal(false);
  testResult = signal<string | null>(null);
  testOk = signal(false);

  ngOnInit() {
    this.admin.getSettings().subscribe(s => this.form.set(s));
  }

  save() {
    const data = this.form();
    if (!data) return;
    this.saving.set(true);
    this.saved.set(false);
    const payload: any = { ...data };
    // No mandar campos vacíos de password/token
    if (!payload.smtp_password) delete payload.smtp_password;
    if (!payload.payphone_token) delete payload.payphone_token;
    delete payload.payphone_token_masked;
    this.admin.updateSettings(payload).subscribe({
      next: s => {
        this.form.set(s);
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => this.saving.set(false),
    });
  }

  sendTest() {
    if (!this.testTo()) return;
    this.testing.set(true);
    this.testResult.set(null);
    this.admin.testEmail(this.testTo()).subscribe({
      next: r => {
        this.testing.set(false);
        this.testResult.set(r.detail || 'Correo enviado.');
        this.testOk.set(true);
      },
      error: e => {
        this.testing.set(false);
        this.testResult.set(e?.error?.detail || 'No se pudo enviar.');
        this.testOk.set(false);
      },
    });
  }
}
