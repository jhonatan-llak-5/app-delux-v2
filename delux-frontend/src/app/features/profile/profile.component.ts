import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">Mi perfil</h1>
      <p class="text-slate-500 text-sm mb-6">Tus datos de cuenta y tu contraseña.</p>

      <!-- Datos -->
      <div class="card p-6 mb-5">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--dash-primary)] to-[var(--dash-primary-d)] grid place-items-center text-white font-bold">
            {{ initials() }}
          </div>
          <div>
            <p class="font-semibold">{{ auth.user()?.full_name || '—' }}</p>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              {{ roleLabel() }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="eg-label">Nombre completo</label>
            <input [(ngModel)]="fullName" class="eg-input w-full" />
          </div>
          <div>
            <label class="eg-label">Teléfono</label>
            <input [(ngModel)]="phone" class="eg-input w-full" />
          </div>
          <div>
            <label class="eg-label">Correo</label>
            <input [value]="auth.user()?.email || ''" disabled class="eg-input w-full disabled:bg-slate-100 disabled:text-slate-400" />
            <p class="text-[11px] text-slate-400 mt-1">El correo lo cambia un administrador.</p>
          </div>
        </div>

        <div class="flex justify-end mt-5">
          <button class="eg-btn-primary" [disabled]="savingProfile()" (click)="saveProfile()">
            @if (savingProfile()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
            @else { <i class="fa-solid fa-floppy-disk"></i> Guardar cambios }
          </button>
        </div>
      </div>

      <!-- Contraseña -->
      <div class="card p-6">
        <h2 class="font-bold mb-4">Cambiar contraseña</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="eg-label">Contraseña actual</label>
            <input type="password" autocomplete="current-password" [(ngModel)]="curPw" class="eg-input w-full" />
          </div>
          <div>
            <label class="eg-label">Nueva contraseña</label>
            <input type="password" autocomplete="new-password" [(ngModel)]="newPw" class="eg-input w-full" />
          </div>
          <div>
            <label class="eg-label">Repetir nueva</label>
            <input type="password" autocomplete="new-password" [(ngModel)]="newPw2" class="eg-input w-full" />
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres.</p>
        @if (pwError()) { <p class="text-rose-600 text-sm mt-2">{{ pwError() }}</p> }
        <div class="flex justify-end mt-4">
          <button class="eg-btn-primary" [disabled]="savingPw()" (click)="changePassword()">
            @if (savingPw()) { <i class="fa-solid fa-spinner fa-spin"></i> Actualizando... }
            @else { <i class="fa-solid fa-key"></i> Actualizar contraseña }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private notify = inject(NotifyService);

  fullName = '';
  phone = '';
  curPw = '';
  newPw = '';
  newPw2 = '';
  savingProfile = signal(false);
  savingPw = signal(false);
  pwError = signal<string | null>(null);

  initials = computed(() => {
    const n = this.auth.user()?.full_name || this.auth.user()?.email || '?';
    return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  });

  roleLabel = computed(() => ({
    SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin', BRANCH_MANAGER: 'Gerente',
    SALESPERSON: 'Vendedor', CUSTOMER: 'Cliente',
  } as Record<string, string>)[this.auth.user()?.role || ''] || '');

  ngOnInit(): void {
    this.fullName = this.auth.user()?.full_name || '';
    this.phone = this.auth.user()?.phone || '';
    // Refrescar desde el backend (trae teléfono actualizado).
    this.auth.me().subscribe({
      next: (u) => { this.fullName = u.full_name || ''; this.phone = u.phone || ''; },
      error: () => {},
    });
  }

  saveProfile(): void {
    this.savingProfile.set(true);
    this.auth.updateProfile({ full_name: this.fullName.trim(), phone: this.phone.trim() }).subscribe({
      next: () => { this.savingProfile.set(false); this.notify.success('Perfil actualizado'); },
      error: (e) => { this.savingProfile.set(false); this.notify.error(parseApiError(e).message || 'No se pudo guardar.'); },
    });
  }

  changePassword(): void {
    this.pwError.set(null);
    if (this.newPw.length < 8) { this.pwError.set('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (this.newPw !== this.newPw2) { this.pwError.set('Las contraseñas no coinciden.'); return; }
    this.savingPw.set(true);
    this.auth.changePassword(this.curPw, this.newPw).subscribe({
      next: () => {
        this.savingPw.set(false);
        this.curPw = this.newPw = this.newPw2 = '';
        this.notify.success('Contraseña actualizada');
      },
      error: (e) => { this.savingPw.set(false); this.pwError.set(parseApiError(e).message || 'No se pudo actualizar.'); },
    });
  }
}
