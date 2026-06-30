import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DlxPasswordInputComponent } from '@shared/ui/password-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '@features/auth/components/auth-shell/auth-shell.component';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-login',
  standalone: true,
  imports: [DlxPasswordInputComponent, CommonModule, FormsModule, RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-auth-shell title="Iniciar sesión en Delux">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-2.5">

        <input [(ngModel)]="identifier" name="identifier" required autocomplete="username"
               placeholder="Usuario, correo o teléfono *"
               class="input-modern" />

        <dlx-password-input [(ngModel)]="password" name="password" required minlength="8"
                            autocomplete="current-password" placeholder="Contraseña *"
                            inputClass="input-modern pr-10" />

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
        } else if (role === 'SALESPERSON') {
          this.router.navigate(['/app/admin/pos']);
        } else {
          this.router.navigate(['/app/account/profile']);
        }
      },
      error: e => {
        this.loading.set(false);
        // Cuenta con credenciales correctas pero sin verificar: ir a ingresar el código.
        const body: any = e?.error ?? {};
        const code = body?.code ?? body?.error?.code;
        const email = body?.email ?? body?.error?.email;
        if (e?.status === 403 && (code === 'email_not_verified' || email)) {
          this.router.navigate(['/auth/activate'], { queryParams: { email } });
          return;
        }
        // Mensaje genérico por seguridad: no revelamos si falló el correo o la clave.
        this.error.set(parseApiError(e).message || 'Datos incorrectos. Verifica e intenta de nuevo.');
      },
    });
  }
}
