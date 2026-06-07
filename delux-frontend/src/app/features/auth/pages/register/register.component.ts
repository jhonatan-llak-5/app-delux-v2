import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell title="Crear cuenta en Delux">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-2.5">

        <input [(ngModel)]="form.email" name="email" type="email" required
               autocomplete="email" placeholder="Correo electrónico"
               class="input-modern" />

        <input [(ngModel)]="form.full_name" name="full_name" required minlength="2" maxlength="160"
               autocomplete="name" placeholder="Nombre completo"
               class="input-modern" />

        <input [(ngModel)]="form.username" name="username" required minlength="3" maxlength="40"
               autocomplete="username" placeholder="Nombre de usuario"
               (ngModelChange)="form.username = $event.toLowerCase()"
               class="input-modern" />

        <div class="input-modern-wrap">
          <input [(ngModel)]="form.password" name="password" [type]="show() ? 'text' : 'password'"
                 required minlength="8" autocomplete="new-password"
                 placeholder="Contraseña"
                 class="input-modern" />
          @if (form.password) {
            <button type="button" (click)="show.set(!show())" tabindex="-1"
                    class="input-modern-trailing"
                    style="font-size:13px;font-weight:600;">
              {{ show() ? 'Ocultar' : 'Mostrar' }}
            </button>
          }
        </div>

        <p class="text-[12px] text-ink-500 dark:text-white/55 text-center leading-relaxed pt-2">
          Al registrarte aceptas nuestros
          <a routerLink="/" class="text-[#0095f6]">términos</a>
          y la
          <a routerLink="/" class="text-[#0095f6]">política de privacidad</a>.
        </p>

        @if (error()) {
          <p class="text-rose-600 dark:text-rose-400 text-[13px] text-center pt-1">
            {{ error() }}
          </p>
        }

        <button type="submit" [disabled]="!f.valid || loading()" class="btn-modern-primary mt-2">
          @if (loading()) {
            <i class="fa-solid fa-spinner fa-spin"></i> Creando...
          } @else {
            Registrarte
          }
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
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  form = { full_name: '', username: '', email: '', password: '' };
  show = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.register(this.form).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/auth/activate'], { queryParams: { email: this.form.email } });
      },
      error: e => {
        this.loading.set(false);
        const err = e?.error || {};
        const msg = err.detail || err.email?.[0] || err.username?.[0] || err.password?.[0] || 'No pudimos crear la cuenta.';
        this.error.set(msg);
      },
    });
  }
}
