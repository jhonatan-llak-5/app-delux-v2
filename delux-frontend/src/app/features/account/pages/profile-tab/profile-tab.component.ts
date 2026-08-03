import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeService, MeProfile } from '@features/account/services/me.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { DlxDocTypeSelectComponent } from '@shared/ui/doc-type-select.component';
import { DlxProvinceSelectComponent } from '@shared/ui/province-select.component';
import { DlxPhoneInputComponent } from '@shared/ui/phone-input.component';

@Component({
  selector: 'dlx-profile-tab',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule, DlxDocTypeSelectComponent, DlxProvinceSelectComponent, DlxPhoneInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <i class="fa-solid fa-user"></i>
            <span class="uppercase tracking-widest font-semibold">Mi cuenta</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Mi perfil</h1>
          <p class="text-slate-500 text-sm mt-1">Tus datos personales y de facturación.</p>
        </div>
      </div>

      @if (profile()) {
        <div class="card p-6">
        <form (ngSubmit)="save()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Nombre completo *</label>
            <input [(ngModel)]="profile()!.full_name" name="full_name" required maxlength="160"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white"
                   [class.border-rose-400]="fe('full_name')" [class.border-ink-200]="!fe('full_name')" [class.dark:border-white/10]="!fe('full_name')" />
            <dlx-field-error [error]="fe(\'full_name\')" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Email</label>
            <input [value]="profile()!.email" disabled
                   class="w-full px-3 py-3 rounded-lg bg-ink-100 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm text-ink-500 dark:text-white/50" />
            <p class="text-[10px] text-ink-500 dark:text-white/40 mt-1">El email no se puede cambiar.</p>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Teléfono</label>
            <dlx-phone-input [(ngModel)]="profile()!.phone" name="phone" />
            <dlx-field-error [error]="fe(\'phone\')" />
          </div>

          <!-- ══ Datos de facturación (por defecto para tus facturas) ══ -->
          <div class="md:col-span-2 mt-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
            <p class="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <i class="fa-solid fa-file-invoice"></i> Datos de facturación
            </p>
            <p class="text-xs text-amber-800/80 dark:text-amber-200/70 mt-1 leading-relaxed">
              Estos son los datos con los que emitiremos tus facturas <b>por defecto</b>.
              No es obligatorio llenarlos para comprar: al momento de facturar,
              confirmarás con el vendedor a nombre de quién deseas la factura.
            </p>
          </div>

          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Identificación SRI</label>
            <dlx-doc-type-select [(ngModel)]="profile()!.document_type" name="document_type" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Número de identificación</label>
            <input [(ngModel)]="profile()!.document_id" name="document_id" maxlength="30"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white font-mono" />
            <dlx-field-error [error]="fe(\'document_id\')" />
          </div>
          <div class="md:col-span-2">
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Razón social / Nombre comercial</label>
            <input [(ngModel)]="profile()!.business_name" name="business_name" maxlength="160"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <div class="md:col-span-2">
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Dirección</label>
            <input [(ngModel)]="profile()!.address" name="address" maxlength="240"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Ciudad</label>
            <input [(ngModel)]="profile()!.city" name="city" maxlength="80"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Provincia</label>
            <dlx-province-select [(ngModel)]="profile()!.province" name="province" />
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
        </div>
      }
    </div>
  `,
})
export class ProfileTabComponent implements OnInit {
  private me = inject(MeService);
  profile = signal<MeProfile | null>(null);
  saving = signal(false);
  saved = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  ngOnInit() { this.me.profile().subscribe(p => this.profile.set(p)); }

  save() {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.saved.set(false);
    this.fieldErrors.set({});
    this.me.updateProfile({
      full_name: p.full_name, phone: p.phone,
      document_id: p.document_id, accepts_marketing: p.accepts_marketing,
      document_type: p.document_type, business_name: p.business_name,
      address: p.address, city: p.city, province: p.province,
    }).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 3000); },
      error: (e) => { this.saving.set(false); this.fieldErrors.set(parseApiError(e).fieldErrors); },
    });
  }
}
