import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeService, MeProfile } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-profile-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editorial-card p-6">
      <h2 class="font-display font-bold text-2xl text-ink-950 dark:text-white mb-2">Perfil</h2>
      <p class="text-sm text-ink-700 dark:text-white/60 mb-6">Tus datos personales para drops, envíos y notificaciones.</p>

      @if (profile()) {
        <form (ngSubmit)="save()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Nombre completo</label>
            <input [(ngModel)]="profile()!.full_name" name="full_name" required
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Email</label>
            <input [value]="profile()!.email" disabled
                   class="w-full px-3 py-3 rounded-lg bg-ink-100 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm text-ink-500 dark:text-white/50" />
            <p class="text-[10px] text-ink-500 dark:text-white/40 mt-1">El email no se puede cambiar.</p>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Teléfono</label>
            <input [(ngModel)]="profile()!.phone" name="phone"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <div class="md:col-span-2">
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Cédula / Documento</label>
            <input [(ngModel)]="profile()!.document_id" name="document_id"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white font-mono" />
          </div>
          <label class="md:col-span-2 flex items-center gap-3 cursor-pointer p-4 rounded-lg bg-ink-50 dark:bg-white/5 hover:bg-ink-100 dark:hover:bg-white/10 transition">
            <input type="checkbox" [(ngModel)]="profile()!.accepts_marketing" name="accepts_marketing" class="w-4 h-4 accent-accent-500" />
            <div>
              <p class="text-sm font-semibold text-ink-950 dark:text-white">Quiero recibir notificaciones de drops</p>
              <p class="text-xs text-ink-500 dark:text-white/50">Te avisaremos cuando lleguen colecciones exclusivas.</p>
            </div>
          </label>

          @if (saved()) {
            <p class="md:col-span-2 text-emerald-600 text-sm flex items-center gap-1.5">
              <i class="fa-solid fa-circle-check"></i> Cambios guardados.
            </p>
          }

          <div class="md:col-span-2 flex justify-end">
            <button type="submit" [disabled]="saving()"
                    class="btn-accent text-sm font-semibold px-8 py-4 disabled:opacity-50">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
              @else { Guardar cambios }
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class ProfileTabComponent implements OnInit {
  private me = inject(MeService);
  profile = signal<MeProfile | null>(null);
  saving = signal(false);
  saved = signal(false);

  ngOnInit() { this.me.profile().subscribe(p => this.profile.set(p)); }

  save() {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.saved.set(false);
    this.me.updateProfile({
      full_name: p.full_name, phone: p.phone,
      document_id: p.document_id, accepts_marketing: p.accepts_marketing,
    }).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 3000); },
      error: () => this.saving.set(false),
    });
  }
}
