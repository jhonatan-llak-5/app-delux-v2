import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-activate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell>
      <div class="text-center mb-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-[#0095f6]/10 dark:bg-[#0095f6]/15
                    grid place-items-center mb-5">
          <i class="fa-solid fa-shield-halved text-[#0095f6] text-[20px]"></i>
        </div>
        <h1 class="font-bold text-[22px] md:text-[24px]
                   tracking-[-0.015em] leading-tight
                   text-ink-950 dark:text-white">
          Confirma tu correo
        </h1>
        <p class="text-ink-500 dark:text-white/55 text-[15px] leading-relaxed mt-3 max-w-[320px] mx-auto">
          Ingresa el código de 6 dígitos que enviamos a tu correo.
        </p>
      </div>

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

        @if (error()) {
          <p class="text-rose-600 dark:text-rose-400 text-[14px] text-center pt-1">
            {{ error() }}
          </p>
        }

        @if (success()) {
          <p class="text-emerald-600 dark:text-emerald-400 text-[14px] text-center pt-1">
            ¡Cuenta activada! Redirigiendo...
          </p>
        }

        <button type="submit" [disabled]="!email || code().length < 6 || loading()" class="btn-modern-primary mt-2">
          @if (loading()) {
            <i class="fa-solid fa-spinner fa-spin"></i> Verificando...
          } @else {
            Activar cuenta
          }
        </button>
      </form>

      <div footer class="text-center mt-6 space-y-3">
        <button type="button" (click)="resend()" [disabled]="resending() || !email"
                class="text-[14px] font-semibold text-[#0095f6]
                       hover:underline disabled:opacity-40">
          @if (resending()) {
            Enviando...
          } @else {
            Reenviar código
          }
        </button>
        <div>
          <a routerLink="/auth/login"
             class="text-[14px] font-semibold text-ink-500 dark:text-white/55 hover:underline">
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </dlx-auth-shell>
  `,
})
export class ActivateComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = '';
  digits: string[] = ['', '', '', '', '', ''];
  loading = signal(false);
  resending = signal(false);
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
    this.auth.activate(this.email, this.code()).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'Código inválido o expirado.');
      },
    });
  }

  resend() {
    this.resending.set(true);
    this.auth.resendCode(this.email).subscribe({
      next: () => this.resending.set(false),
      error: () => this.resending.set(false),
    });
  }
}
