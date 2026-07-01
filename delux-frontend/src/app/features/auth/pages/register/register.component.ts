import { AfterViewInit, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DlxPasswordInputComponent } from '@shared/ui/password-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-register',
  standalone: true,
  imports: [DlxPasswordInputComponent, CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell title="Crear cuenta en Delux">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3">

        <div>
          <label class="block text-[12px] font-semibold text-ink-700 dark:text-white/70 mb-2">¿Cómo quieres registrarte? <span class="text-rose-500">*</span></label>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" (click)="form.accountType = 'customer'"
                    class="relative rounded-2xl border-2 p-4 text-left transition-all"
                    [ngClass]="form.accountType === 'customer'
                      ? 'border-[#0095f6] bg-[#0095f6]/[0.06] shadow-[0_10px_30px_-14px_rgba(0,149,246,0.6)]'
                      : 'border-ink-200 dark:border-white/10 hover:border-ink-300 dark:hover:border-white/20'">
              @if (form.accountType === 'customer') {
                <span class="absolute top-2.5 right-2.5 grid place-items-center w-5 h-5 rounded-full bg-[#0095f6] text-white text-[10px]"><i class="fa-solid fa-check"></i></span>
              }
              <span class="grid place-items-center w-11 h-11 rounded-xl mb-3"
                    [ngClass]="form.accountType === 'customer' ? 'bg-[#0095f6] text-white' : 'bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-white/60'">
                <i class="fa-solid fa-bag-shopping"></i>
              </span>
              <span class="block font-bold text-[15px] text-ink-950 dark:text-white">Cliente</span>
              <span class="block text-[12px] text-ink-500 dark:text-white/50 mt-0.5">Comprar en la tienda</span>
            </button>

            <button type="button" (click)="form.accountType = 'affiliate'"
                    class="relative rounded-2xl border-2 p-4 text-left transition-all"
                    [ngClass]="form.accountType === 'affiliate'
                      ? 'border-[#0095f6] bg-[#0095f6]/[0.06] shadow-[0_10px_30px_-14px_rgba(0,149,246,0.6)]'
                      : 'border-ink-200 dark:border-white/10 hover:border-ink-300 dark:hover:border-white/20'">
              @if (form.accountType === 'affiliate') {
                <span class="absolute top-2.5 right-2.5 grid place-items-center w-5 h-5 rounded-full bg-[#0095f6] text-white text-[10px]"><i class="fa-solid fa-check"></i></span>
              }
              <span class="grid place-items-center w-11 h-11 rounded-xl mb-3"
                    [ngClass]="form.accountType === 'affiliate' ? 'bg-[#0095f6] text-white' : 'bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-white/60'">
                <i class="fa-solid fa-hand-holding-dollar"></i>
              </span>
              <span class="block font-bold text-[15px] text-ink-950 dark:text-white">Afiliado</span>
              <span class="block text-[12px] text-ink-500 dark:text-white/50 mt-0.5">Ganar comisiones</span>
            </button>
          </div>

          @if (form.accountType === 'affiliate') {
            <div class="mt-3 flex items-start gap-2.5 rounded-xl border border-[#0095f6]/25 bg-[#0095f6]/[0.06] px-3.5 py-3">
              <i class="fa-solid fa-circle-info text-[#0095f6] mt-0.5"></i>
              <p class="text-[12.5px] text-ink-700 dark:text-white/75 leading-snug">
                Ganarás <strong class="text-[#0095f6]">{{ branding.affiliateCommissionRate() }}%</strong> por cada venta que traigas.
                Activa tu cuenta por correo y recibe tu código de afiliado.
                <a routerLink="/afiliados/terminos" class="text-[#0095f6] underline">Ver términos</a>
              </p>
            </div>
          }
        </div>

        <div>
          <label class="block text-[12px] font-semibold text-ink-700 dark:text-white/70 mb-1">Correo electrónico <span class="text-rose-500">*</span></label>
          <input [(ngModel)]="form.email" name="email" type="email" required (ngModelChange)="persist()"
                 autocomplete="email" placeholder="tucorreo@ejemplo.com" class="input-modern" />
          @if (fieldErrors()['email']) { <p class="text-rose-600 dark:text-rose-400 text-[12px] mt-1">{{ fieldErrors()['email'] }}</p> }
        </div>

        <div>
          <label class="block text-[12px] font-semibold text-ink-700 dark:text-white/70 mb-1">Nombre completo <span class="text-rose-500">*</span></label>
          <input [(ngModel)]="form.full_name" name="full_name" required minlength="2" maxlength="160" (ngModelChange)="persist()"
                 autocomplete="name" placeholder="Tu nombre y apellido" class="input-modern" />
          @if (fieldErrors()['full_name']) { <p class="text-rose-600 dark:text-rose-400 text-[12px] mt-1">{{ fieldErrors()['full_name'] }}</p> }
        </div>

        <div>
          <label class="block text-[12px] font-semibold text-ink-700 dark:text-white/70 mb-1">Nombre de usuario <span class="text-rose-500">*</span></label>
          <input [(ngModel)]="form.username" name="username" required minlength="3" maxlength="40"
                 autocomplete="username" placeholder="solo minúsculas, sin espacios"
                 (ngModelChange)="form.username = $event.toLowerCase(); persist()" class="input-modern" />
          @if (fieldErrors()['username']) { <p class="text-rose-600 dark:text-rose-400 text-[12px] mt-1">{{ fieldErrors()['username'] }}</p> }
        </div>

        <div>
          <label class="block text-[12px] font-semibold text-ink-700 dark:text-white/70 mb-1">Contraseña <span class="text-rose-500">*</span></label>
          <dlx-password-input [(ngModel)]="form.password" name="password" required minlength="8"
                              autocomplete="new-password" (focused)="pwFocused.set(true)"
                              placeholder="Crea una contraseña segura" inputClass="input-modern pr-10" />

          @if (pwFocused() || form.password) {
            <div class="mt-2 p-3 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10">
              <p class="text-[11px] font-semibold text-ink-600 dark:text-white/60 mb-1.5">Tu contraseña debe tener:</p>
              <ul class="space-y-1">
                @for (r of pwRules(); track r.label) {
                  <li class="flex items-center gap-2 text-[12px]"
                      [class.text-emerald-600]="r.ok" [class.text-ink-400]="!r.ok" [class.dark:text-white/40]="!r.ok">
                    <i class="fa-solid text-[10px]" [class.fa-circle-check]="r.ok" [class.fa-circle]="!r.ok"></i>
                    {{ r.label }}
                  </li>
                }
              </ul>
            </div>
          }
          @if (fieldErrors()['password']) { <p class="text-rose-600 dark:text-rose-400 text-[12px] mt-1">{{ fieldErrors()['password'] }}</p> }
        </div>

        @if (branding.recaptchaSiteKey()) {
          <div id="dlx-recaptcha" class="flex justify-center pt-1"></div>
        }

        <p class="text-[12px] text-ink-500 dark:text-white/55 text-center leading-relaxed pt-1">
          Al registrarte aceptas nuestros
          <a href="/terms" target="_blank" rel="noopener" class="text-[#0095f6]">términos</a> y la
          <a href="/privacy" target="_blank" rel="noopener" class="text-[#0095f6]">política de privacidad</a>.
        </p>

        @if (error()) {
          <p class="text-rose-600 dark:text-rose-400 text-[13px] text-center pt-1">{{ error() }}</p>
        }

        <button type="submit" [disabled]="!f.valid || !passwordValid() || loading()" class="btn-modern-primary mt-2">
          @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Creando... }
          @else { Registrarte }
        </button>
      </form>

      <div footer class="mt-12 space-y-3">
        <a routerLink="/auth/login" class="btn-modern-ghost">
          Ya tengo una cuenta
        </a>

        <p class="text-center text-[12px] text-ink-400 dark:text-white/35 pt-4">
          © 2026 Delux · Quito, Ecuador
        </p>
      </div>
    </dlx-auth-shell>
  `,
})
export class RegisterComponent implements AfterViewInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  branding = inject(BrandingService);
  private widgetId: number | null = null;

  form = { full_name: '', username: '', email: '', password: '', accountType: 'customer' as 'customer' | 'affiliate' };
  private readonly STORE = 'dlx_register_form';
  show = signal(false);
  pwFocused = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  pwRules() {
    const p = this.form.password || '';
    return [
      { label: 'Al menos 8 caracteres', ok: p.length >= 8 },
      { label: 'Una letra mayúscula', ok: /[A-Z]/.test(p) },
      { label: 'Una letra minúscula', ok: /[a-z]/.test(p) },
      { label: 'Un número', ok: /[0-9]/.test(p) },
    ];
  }
  passwordValid(): boolean { return this.pwRules().every(r => r.ok); }

  ngAfterViewInit(): void {
    this.restore();
    // Preselecciona "Afiliado" si vienen desde la landing (?type=affiliate).
    if (this.route.snapshot.queryParamMap.get('type') === 'affiliate') {
      this.form.accountType = 'affiliate';
    }
    if (this.branding.recaptchaSiteKey()) {
      setTimeout(() => this.renderRecaptcha(), 300);
    }
  }

  persist(): void {
    if (Object.keys(this.fieldErrors()).length) this.fieldErrors.set({});
    if (typeof sessionStorage === 'undefined') return;
    const { full_name, username, email } = this.form;
    sessionStorage.setItem(this.STORE, JSON.stringify({ full_name, username, email }));
  }

  private restore(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(this.STORE);
      if (raw) { const d = JSON.parse(raw); this.form = { ...this.form, ...d }; }
    } catch {}
  }

  private renderRecaptcha(retries = 20): void {
    if (typeof document === 'undefined') return;
    const g = (window as any).grecaptcha;
    const el = document.getElementById('dlx-recaptcha');
    if (!el) return;
    if (!document.getElementById('recaptcha-script')) {
      const sc = document.createElement('script');
      sc.id = 'recaptcha-script';
      sc.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      sc.async = true; sc.defer = true;
      document.head.appendChild(sc);
    }
    if (g && g.render && el.childElementCount === 0) {
      try { this.widgetId = g.render(el, { sitekey: this.branding.recaptchaSiteKey() }); } catch {}
      return;
    }
    if (retries > 0) setTimeout(() => this.renderRecaptcha(retries - 1), 250);
  }

  private resetCaptcha(): void {
    const g = (window as any).grecaptcha;
    if (g && this.widgetId !== null) { try { g.reset(this.widgetId); } catch {} }
  }

  submit() {
    let token = '';
    if (this.branding.recaptchaSiteKey()) {
      const g = (window as any).grecaptcha;
      token = (g && this.widgetId !== null ? g.getResponse(this.widgetId) : '') || '';
      if (!token) { this.error.set('Por favor completa el reCAPTCHA.'); return; }
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.register({ ...this.form, account_type: this.form.accountType, recaptcha_token: token }).subscribe({
      next: () => {
        this.loading.set(false);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(this.STORE);
        this.router.navigate(['/auth/activate'], { queryParams: { email: this.form.email } });
      },
      error: e => {
        this.loading.set(false);
        this.resetCaptcha();
        const { fieldErrors, message } = parseApiError(e);
        this.fieldErrors.set(fieldErrors);
        // Solo mostramos el mensaje general si NO hay errores por campo.
        this.error.set(Object.keys(fieldErrors).length ? null : (message || 'No pudimos crear la cuenta.'));
      },
    });
  }
}
