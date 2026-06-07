import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell
      title="Nueva contraseña"
      subtitle="Ingresa el código que te enviamos y elige una nueva contraseña.">
      @if (!success()) {
        <form (ngSubmit)="submit()" #f="ngForm" class="space-y-5">
          <div>
            <label class="eyebrow mb-1.5 block">Correo</label>
            <div class="relative">
              <i class="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
              <input [(ngModel)]="email" name="email" type="email" required
                     class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
            </div>
          </div>

          <div>
            <label class="eyebrow mb-3 block text-center">Código de 6 dígitos</label>
            <div class="flex justify-center gap-2">
              @for (i of [0,1,2,3,4,5]; track i) {
                <input type="text" inputmode="numeric" maxlength="1"
                       [value]="digits[i]"
                       (input)="onDigitInput(i, $event)"
                       (keydown)="onKeyDown(i, $event)"
                       (paste)="onPaste($event)"
                       class="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-display font-bold
                              rounded-xl bg-ink-50 dark:bg-white/5 border-2 border-ink-200 dark:border-white/10
                              focus:outline-none focus:border-accent-500 dark:focus:border-accent-400 transition" />
              }
            </div>
          </div>

          <div>
            <label class="eyebrow mb-1.5 block">Nueva contraseña</label>
            <div class="relative">
              <i class="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
              <input [(ngModel)]="newPassword" name="new_password" [type]="show() ? 'text' : 'password'"
                     required minlength="8" autocomplete="new-password"
                     class="w-full pl-10 pr-12 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
              <button type="button" (click)="show.set(!show())"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-white">
                <i class="fa-solid text-sm" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()"></i>
              </button>
            </div>
            <p class="text-[10px] text-ink-500 dark:text-white/40 mt-1.5">Mínimo 8 caracteres.</p>
          </div>

          @if (error()) {
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm">
              <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
            </div>
          }

          <button type="submit" [disabled]="!email || code().length < 6 || newPassword.length < 8 || loading()"
                  class="w-full btn-accent text-sm uppercase tracking-widest py-4 disabled:opacity-50">
            @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Cambiando... }
            @else { <i class="fa-solid fa-shield-halved"></i> Cambiar contraseña }
          </button>
        </form>
      } @else {
        <div class="text-center py-8">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center mx-auto mb-6 animate-cta-pulse">
            <i class="fa-solid fa-circle-check text-white text-3xl"></i>
          </div>
          <h3 class="font-display font-bold text-2xl text-ink-950 dark:text-white mb-3">¡Contraseña actualizada!</h3>
          <p class="text-ink-700 dark:text-white/60 mb-6">
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <a routerLink="/auth/login" class="btn-accent text-xs uppercase tracking-widest px-8 py-4 inline-flex">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión
          </a>
        </div>
      }

      <div footer class="text-center text-sm text-ink-700 dark:text-white/60">
        <a routerLink="/auth/forgot-password" class="text-ink-950 dark:text-white font-semibold hover:underline">
          <i class="fa-solid fa-arrow-left text-xs"></i> Reenviar código
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

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
  }

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
        this.error.set(e?.error?.detail || 'No pudimos restablecer la contraseña.');
      },
    });
  }
}
