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
    <dlx-auth-shell title="Iniciar sesión" subtitle="Bienvenido de vuelta a Delux.">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-4">
        <div>
          <label class="eyebrow mb-1.5 block">Usuario o correo</label>
          <div class="relative">
            <i class="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="identifier" name="identifier" required autocomplete="username"
                   placeholder="tucuenta o tu@correo.com"
                   class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
        </div>

        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <label class="eyebrow block">Contraseña</label>
            <a routerLink="/auth/forgot-password" class="text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50 hover:text-ink-950 dark:hover:text-white">¿Olvidaste?</a>
          </div>
          <div class="relative">
            <i class="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="password" name="password" [type]="show() ? 'text' : 'password'"
                   required minlength="8" autocomplete="current-password"
                   class="w-full pl-10 pr-12 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
            <button type="button" (click)="show.set(!show())"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-white">
              <i class="fa-solid text-sm" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()"></i>
            </button>
          </div>
        </div>

        @if (error()) {
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm">
            <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        <button type="submit" [disabled]="!f.valid || loading()"
                class="w-full btn-accent text-sm uppercase tracking-widest py-4 disabled:opacity-50">
          @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Entrando... }
          @else { <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión }
        </button>
      </form>

      <div footer class="text-center text-sm text-ink-700 dark:text-white/60">
        ¿No tienes cuenta?
        <a routerLink="/auth/register" class="text-ink-950 dark:text-white font-semibold hover:underline">Crear una</a>
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
        // Redirigir según rol
        const role = r.user.role;
        if (role === 'SUPERADMIN' || role === 'TENANT_ADMIN' || role === 'BRANCH_MANAGER') {
          this.router.navigate(['/app/admin/overview']);
        } else {
          this.router.navigate(['/account']);
        }
      },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'No pudimos iniciar sesión.');
      },
    });
  }
}
