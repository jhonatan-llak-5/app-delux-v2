import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';

@Component({
  selector: 'dlx-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell title="Iniciar sesión en Delux">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-2.5">

        <input [(ngModel)]="identifier" name="identifier" required autocomplete="username"
               placeholder="Usuario, correo o teléfono"
               class="input-modern" />

        <div class="input-modern-wrap">
          <input [(ngModel)]="password" name="password" [type]="show() ? 'text' : 'password'"
                 required minlength="8" autocomplete="current-password"
                 placeholder="Contraseña"
                 class="input-modern" />
          @if (password) {
            <button type="button" (click)="show.set(!show())" tabindex="-1"
                    class="input-modern-trailing"
                    style="font-size:13px;font-weight:600;">
              {{ show() ? 'Ocultar' : 'Mostrar' }}
            </button>
          }
        </div>

        @if (error()) {
          <p class="text-rose-600 dark:text-rose-400 text-[13px] text-center pt-1">
            {{ error() }}
          </p>
        }

        <button type="submit" [disabled]="!f.valid || loading()" class="btn-modern-primary mt-3">
          @if (loading()) {
            <i class="fa-solid fa-spinner fa-spin"></i> Entrando...
          } @else {
            Iniciar sesión
          }
        </button>

        <a routerLink="/auth/forgot-password"
           class="block text-center text-[13px] font-semibold text-ink-950 dark:text-white pt-4">
          ¿Has olvidado la contraseña?
        </a>
      </form>

      <div footer class="mt-12 space-y-3">
        <button type="button" disabled
                class="btn-modern-secondary opacity-50 cursor-not-allowed">
          <i class="fa-brands fa-facebook text-[#0866ff]"></i>
          Iniciar sesión con Facebook
        </button>

        <a routerLink="/auth/register" class="btn-modern-ghost">
          Crear una cuenta
        </a>

        <p class="text-center text-[12px] text-ink-400 dark:text-white/35 pt-4">
          © 2026 Delux · Quito, Ecuador
        </p>
      </div>
    </dlx-auth-shell>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  identifier = '';
  password = '';
  show = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.identifier.trim(), this.password).subscribe({
      next: r => {
        this.loading.set(false);
        const role = r.user.role;
        if (role === 'SUPERADMIN' || role === 'TENANT_ADMIN' || role === 'BRANCH_MANAGER') {
          this.router.navigate(['/app/admin/overview']);
        } else {
          this.router.navigate(['/account']);
        }
      },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'Datos incorrectos. Verifica e intenta de nuevo.');
      },
    });
  }
}
