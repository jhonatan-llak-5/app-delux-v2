import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell
      title="¿Olvidaste tu contraseña?"
      subtitle="Ingresa tu correo y te enviaremos un código de 6 dígitos para recuperarla.">
      @if (!sent()) {
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-5">
          <div>
            <label class="text-sm font-semibold text-ink-700 dark:text-white/70 mb-1.5 block">Correo electrónico</label>
            <div class="relative">
              <i class="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
              <input [(ngModel)]="email" name="email" type="email" required autocomplete="email"
                     placeholder="tu@correo.com"
                     class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-white dark:bg-white/5 border border-ink-200 dark:border-white/10 shadow-sm text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
            </div>
          </div>

          @if (error()) {
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <button type="submit" [disabled]="!f.valid || loading()"
                  class="w-full btn-accent text-sm font-semibold py-4 disabled:opacity-50">
            @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Enviando... }
            @else { <i class="fa-solid fa-paper-plane"></i> Enviar código }
          </button>
        </form>
      } @else {
        <div class="text-center py-8">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center mx-auto mb-6 animate-cta-pulse">
            <i class="fa-solid fa-envelope-circle-check text-white text-3xl"></i>
          </div>
          <h3 class="font-display font-bold text-2xl text-ink-950 dark:text-white mb-3">¡Correo enviado!</h3>
          <p class="text-ink-700 dark:text-white/60 mb-6">
            Si <strong class="text-ink-950 dark:text-white">{{ email }}</strong> existe en nuestra base,
            recibirás un código de 6 dígitos.
          </p>
          <a [routerLink]="['/auth/reset-password']" [queryParams]="{ email }"
             class="btn-accent text-sm font-semibold px-8 py-4 inline-flex">
            Ya tengo el código <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </a>
        </div>
      }

      <div footer class="text-center text-sm text-ink-700 dark:text-white/60">
        <a routerLink="/auth/login" class="text-ink-950 dark:text-white font-semibold hover:underline">
          <i class="fa-solid fa-arrow-left text-xs"></i> Volver a login
        </a>
      </div>
    </dlx-auth-shell>
  `,
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  submit() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.forgotPassword(this.email).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'No pudimos procesar la solicitud.');
      },
    });
  }
}
