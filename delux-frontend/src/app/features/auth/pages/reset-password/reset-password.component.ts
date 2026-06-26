import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell>
      <div class="text-center mb-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-[#0095f6]/10 dark:bg-[#0095f6]/15
                    grid place-items-center mb-5">
          @if (!success()) {
            <i class="fa-solid fa-key text-[#0095f6] text-[20px]"></i>
          } @else {
            <i class="fa-solid fa-circle-check text-[#0095f6] text-[22px]"></i>
          }
        </div>
        <h1 class="font-bold text-[22px] md:text-[24px]
                   tracking-[-0.015em] leading-tight
                   text-ink-950 dark:text-white">
          @if (!success()) {
            Nueva contraseña
          } @else {
            ¡Listo!
          }
        </h1>
        <p class="text-ink-500 dark:text-white/55 text-[15px] leading-relaxed mt-3 max-w-[320px] mx-auto">
          @if (!success()) {
            Ingresa el código que recibiste y tu nueva contraseña.
          } @else {
            Tu contraseña fue actualizada. Ya puedes iniciar sesión.
          }
        </p>
      </div>

      @if (!success()) {
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3">
          <input [(ngModel)]="email" name="email" type="email" required
                 placeholder="tu@correo.com"
                 class="input-modern" />

          <div class="flex justify-center gap-2 py-2">
            @for (i of [0,1,2,3,4,5]; track i) {
              <input type="text" inputmode="numeric" maxlength="1"
                     [value]="digits[i]"
                     (input)="onDigitInput(i, $event)"
                     (keydown)="onKeyDown(i, $event)"
                     (paste)="onPaste($event)"
                     class="w-12 h-14 text-center text-[20px] font-bold
                            rounded-2xl bg-white dark:bg-transparent
                            border-[1.5px] border-[#d4d4d4] dark:border-[#363636]
                            text-ink-950 dark:text-white
                            focus:outline-none focus:border-[#0095f6] dark:focus:border-[#0095f6]
                            transition" />
            }
          </div>

          <div class="input-modern-wrap">
            <input [(ngModel)]="newPassword" name="new_password" [type]="show() ? 'text' : 'password'"
                   required minlength="8" autocomplete="new-password"
                   placeholder="Nueva contraseña"
                   class="input-modern" />
            @if (newPassword) {
              <button type="button" (click)="show.set(!show())" tabindex="-1"
                      class="input-modern-trailing"
                      style="font-size:14px;font-weight:600;">
                {{ show() ? 'Ocultar' : 'Mostrar' }}
              </button>
            }
          </div>

          @if (error()) {
            <p class="text-rose-600 dark:text-rose-400 text-[14px] text-center pt-1">
              {{ error() }}
            </p>
          }

          <button type="submit" [disabled]="!email || code().length < 6 || newPassword.length < 8 || loading()"
                  class="btn-modern-primary mt-2">
            @if (loading()) {
              <i class="fa-solid fa-spinner fa-spin"></i> Cambiando...
            } @else {
              Cambiar contraseña
            }
          </button>
        </form>
      } @else {
        <a routerLink="/auth/login" class="btn-modern-primary inline-flex">
          Iniciar sesión
        </a>
      }

      <div footer class="text-center mt-6">
        <a routerLink="/auth/forgot-password"
           class="text-[14px] font-semibold text-[#0095f6] hover:underline">
          Reenviar código
        </a>
      </div>
    </dlx-auth-shell>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = '';
  digits: string[] = ['', '', '', '', '', ''];
  newPassword = '';
  show = signal(false);
  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);

  code = () => this.digits.join('');

  ngOnInit() { this.email = this.route.snapshot.queryParamMap.get('email') || ''; }

  onDigitInput(i: number, ev: Event) {
    const v = (ev.target as HTMLInputElement).value.replace(/[^0-9]/g, '').slice(-1);
    this.digits[i] = v;
    (ev.target as HTMLInputElement).value = v;
    if (v && i < 5) {
      const next = (ev.target as HTMLInputElement).parentElement?.querySelectorAll('input')[i + 1] as HTMLInputElement;
      next?.focus();
    }
  }

  onKeyDown(i: number, ev: KeyboardEvent) {
    if (ev.key === 'Backspace' && !this.digits[i] && i > 0) {
      const prev = (ev.target as HTMLInputElement).parentElement?.querySelectorAll('input')[i - 1] as HTMLInputElement;
      prev?.focus();
    }
  }

  onPaste(ev: ClipboardEvent) {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text')?.replace(/[^0-9]/g, '').slice(0, 6) || '';
    for (let i = 0; i < 6; i++) this.digits[i] = text[i] || '';
    const inputs = (ev.target as HTMLInputElement).parentElement?.querySelectorAll('input');
    if (inputs) (inputs[Math.min(text.length, 5)] as HTMLInputElement).focus();
  }

  submit() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword({ email: this.email, code: this.code(), new_password: this.newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: e => {
        this.loading.set(false);
        this.error.set(parseApiError(e).message || 'No pudimos restablecer la contraseña.');
      },
    });
  }
}
