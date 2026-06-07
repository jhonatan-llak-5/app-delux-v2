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
    <dlx-auth-shell title="Confirma tu cuenta" subtitle="Te enviamos un código de 6 dígitos a tu correo.">
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
              <input #boxInput type="text" inputmode="numeric" maxlength="1"
                     [value]="digits[i]"
                     (input)="onDigitInput(i, $event)"
                     (keydown)="onKeyDown(i, $event)"
                     (paste)="onPaste($event)"
                     class="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-display font-bold
                            rounded-xl bg-ink-50 dark:bg-white/5 border-2 border-ink-200 dark:border-white/10
                            focus:outline-none focus:border-accent-500 dark:focus:border-accent-400
                            transition" />
            }
          </div>
        </div>

        @if (error()) {
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm">
            <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        @if (success()) {
          <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm">
            <i class="fa-solid fa-circle-check"></i> ¡Cuenta activada! Redirigiendo a login...
          </div>
        }

        <button type="submit" [disabled]="!email || !code() || code().length < 6 || loading()"
                class="w-full btn-accent text-sm uppercase tracking-widest py-4 disabled:opacity-50">
          @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Verificando... }
          @else { <i class="fa-solid fa-check"></i> Activar cuenta }
        </button>

        <button type="button" (click)="resend()" [disabled]="resending() || !email"
                class="w-full text-xs uppercase tracking-widest text-ink-500 dark:text-white/50 hover:text-ink-950 dark:hover:text-white py-2 disabled:opacity-40">
          @if (resending()) { <i class="fa-solid fa-spinner fa-spin"></i> Enviando... }
          @else { <i class="fa-solid fa-rotate"></i> Reenviar código }
        </button>
      </form>

      <div footer class="text-center text-sm text-ink-700 dark:text-white/60">
        <a routerLink="/auth/login" class="text-ink-950 dark:text-white font-semibold hover:underline">← Volver a login</a>
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
    // foco al último ingresado
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
