import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell>
      <!-- Header centrado: icono en círculo + título + subtítulo -->
      <div class="text-center mb-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-[#0095f6]/10 dark:bg-[#0095f6]/15
                    grid place-items-center mb-5">
          @if (!sent()) {
            <i class="fa-solid fa-envelope text-[#0095f6] text-[20px]"></i>
          } @else {
            <i class="fa-solid fa-circle-check text-[#0095f6] text-[22px]"></i>
          }
        </div>
        <h1 class="font-bold text-[22px] md:text-[24px]
                   tracking-[-0.015em] leading-tight
                   text-ink-950 dark:text-white">
          @if (!sent()) {
            Recuperar contraseña
          } @else {
            Correo enviado
          }
        </h1>
        <p class="text-ink-500 dark:text-white/55 text-[15px] leading-relaxed mt-3 max-w-[320px] mx-auto">
          @if (!sent()) {
            Ingresa tu correo y te enviaremos un código de 6 dígitos.
          } @else {
            Revisa la bandeja de <strong class="text-ink-950 dark:text-white">{{ email }}</strong>.
          }
        </p>
      </div>

      @if (!sent()) {
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3">
          <input [(ngModel)]="email" name="email" type="email" required autocomplete="email"
                 placeholder="tu@correo.com"
                 class="input-modern" />

          @if (error()) {
            <p class="text-rose-600 dark:text-rose-400 text-[14px] text-center pt-1">
              {{ error() }}
            </p>
          }

          <button type="submit" [disabled]="!f.valid || loading()" class="btn-modern-primary mt-2">
            @if (loading()) {
              <i class="fa-solid fa-spinner fa-spin"></i> Enviando...
            } @else {
              Enviar código
            }
          </button>
        </form>
      } @else {
        <a [routerLink]="['/auth/reset-password']" [queryParams]="{ email }"
           class="btn-modern-primary inline-flex">
          Ya tengo el código
        </a>
      }

      <!-- Link simple, sin card -->
      <div footer class="text-center mt-6">
        <a routerLink="/auth/login"
           class="text-[14px] font-semibold text-[#0095f6] hover:underline">
          Volver al inicio de sesión
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
        this.error.set(parseApiError(e).message || 'No pudimos procesar la solicitud.');
      },
    });
  }
}
