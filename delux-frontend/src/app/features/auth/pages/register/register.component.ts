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
    <dlx-auth-shell title="Crear cuenta" subtitle="Únete a Delux y accede a drops exclusivos.">
      <form (ngSubmit)="submit()" #f="ngForm" class="space-y-4">
        <div>
          <label class="eyebrow mb-1.5 block">Nombre completo *</label>
          <div class="relative">
            <i class="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="form.full_name" name="full_name" required minlength="2" maxlength="160"
                   autocomplete="name" placeholder="Ej. Yessenia Macías"
                   class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
        </div>

        <div>
          <label class="eyebrow mb-1.5 block">Nombre de usuario *</label>
          <div class="relative">
            <i class="fa-solid fa-at absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="form.username" name="username" required minlength="3" maxlength="40"
                   autocomplete="username" placeholder="yessi_macias"
                   (ngModelChange)="form.username = $event.toLowerCase()"
                   class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <p class="text-[10px] text-ink-500 dark:text-white/40 mt-1.5">
            Solo letras, números, punto y guion bajo. Mínimo 3 caracteres.
          </p>
        </div>

        <div>
          <label class="eyebrow mb-1.5 block">Correo electrónico *</label>
          <div class="relative">
            <i class="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="form.email" name="email" type="email" required
                   autocomplete="email" placeholder="tu@correo.com"
                   class="w-full pl-10 pr-3 py-3.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
        </div>

        <div>
          <label class="eyebrow mb-1.5 block">Contraseña *</label>
          <div class="relative">
            <i class="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm"></i>
            <input [(ngModel)]="form.password" name="password" [type]="show() ? 'text' : 'password'"
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

        <button type="submit" [disabled]="!f.valid || loading()"
                class="w-full btn-accent text-sm uppercase tracking-widest py-4 disabled:opacity-50">
          @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> Creando... }
          @else { <i class="fa-solid fa-user-plus"></i> Crear cuenta }
        </button>

        <p class="text-[10px] text-center text-ink-500 dark:text-white/40 leading-relaxed">
          Al crear tu cuenta aceptas nuestros términos y política de privacidad.
        </p>
      </form>

      <div footer class="text-center text-sm text-ink-700 dark:text-white/60">
        ¿Ya tienes cuenta?
        <a routerLink="/auth/login" class="text-ink-950 dark:text-white font-semibold hover:underline">Inicia sesión</a>
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
