import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeService, MeAddress } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-addresses-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editorial-card p-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-display font-bold text-2xl text-ink-950 dark:text-white">Direcciones</h2>
        <button (click)="openCreate()" class="btn-outline text-sm font-semibold px-4 py-2">
          <i class="fa-solid fa-plus text-[10px]"></i> Nueva
        </button>
      </div>
      <p class="text-sm text-ink-700 dark:text-white/60 mb-6">Para envíos a domicilio y facturación.</p>

      @if (addresses().length === 0) {
        <div class="text-center py-10">
          <i class="fa-solid fa-location-dot text-3xl text-ink-300 dark:text-white/30 mb-3"></i>
          <p class="text-ink-700 dark:text-white/70">Aún no tienes direcciones registradas.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (a of addresses(); track a.id) {
            <div class="p-4 rounded-xl border-2 transition relative"
                 [class.border-accent-500]="a.is_default"
                 [class.dark:border-accent-400]="a.is_default"
                 [class.border-ink-200]="!a.is_default"
                 [class.dark:border-white/10]="!a.is_default">
              @if (a.is_default) {
                <span class="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-accent-700 dark:text-accent-300 bg-accent-100 dark:bg-accent-500/20 px-2 py-0.5 rounded-full">
                  Predeterminada
                </span>
              }
              <p class="text-xs font-semibold uppercase tracking-widest text-ink-500 dark:text-white/50 mb-1">{{ a.label }}</p>
              <p class="font-semibold text-ink-950 dark:text-white">{{ a.line1 }}</p>
              @if (a.line2) { <p class="text-sm text-ink-700 dark:text-white/70">{{ a.line2 }}</p> }
              <p class="text-sm text-ink-700 dark:text-white/70 mt-1">{{ a.city }}@if (a.region) {, {{ a.region }}} · {{ a.country }}</p>

              <div class="mt-4 flex gap-2">
                @if (!a.is_default) {
                  <button (click)="setDefault(a)" class="text-xs text-accent-700 dark:text-accent-300 hover:underline">
                    <i class="fa-solid fa-star text-[10px]"></i> Predeterminada
                  </button>
                }
                <button (click)="openEdit(a)" class="text-xs text-ink-700 dark:text-white/60 hover:underline ml-auto">
                  <i class="fa-solid fa-pen text-[10px]"></i> Editar
                </button>
                <button (click)="remove(a)" class="text-xs text-rose-600 hover:underline">
                  <i class="fa-solid fa-trash text-[10px]"></i> Eliminar
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" (click)="onBackdrop($event)">
        <form (ngSubmit)="save()" class="w-full max-w-lg rounded-2xl bg-white dark:bg-ink-900 shadow-2xl p-6 space-y-4">
          <h3 class="font-display font-bold text-xl text-ink-950 dark:text-white">
            {{ editing()?.id ? 'Editar dirección' : 'Nueva dirección' }}
          </h3>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Etiqueta</label>
            <input [(ngModel)]="form.label" name="label" placeholder="Casa, oficina..."
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Dirección *</label>
            <input [(ngModel)]="form.line1" name="line1" required
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none" />
          </div>
          <div>
            <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Departamento, suite, etc.</label>
            <input [(ngModel)]="form.line2" name="line2"
                   class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Ciudad *</label>
              <input [(ngModel)]="form.city" name="city" required
                     class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Provincia</label>
              <input [(ngModel)]="form.region" name="region"
                     class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none" />
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" [(ngModel)]="form.is_default" name="is_default" class="w-4 h-4 accent-accent-500" />
            <span class="text-sm">Predeterminada</span>
          </label>

          <div class="flex justify-end gap-2 pt-2 border-t border-ink-100 dark:border-white/10">
            <button type="button" (click)="closeForm()" class="px-4 py-2.5 rounded-lg bg-ink-100 dark:bg-white/10 text-sm font-semibold">Cancelar</button>
            <button type="submit" class="btn-accent text-sm font-semibold px-5 py-2.5">Guardar</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class AddressesTabComponent implements OnInit {
  private me = inject(MeService);
  addresses = signal<MeAddress[]>([]);
  showForm = signal(false);
  editing = signal<MeAddress | null>(null);

  form: MeAddress = this.emptyForm();

  ngOnInit() { this.reload(); }
  reload() { this.me.addresses().subscribe(r => this.addresses.set(r.results)); }

  emptyForm(): MeAddress {
    return { label: 'Principal', line1: '', line2: '', city: '', region: '',
             country: 'Ecuador', postal_code: '', is_default: false };
  }

  openCreate() { this.editing.set(null); this.form = this.emptyForm(); this.showForm.set(true); }
  openEdit(a: MeAddress) { this.editing.set(a); this.form = { ...a }; this.showForm.set(true); }
  closeForm() { this.showForm.set(false); }
  onBackdrop(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeForm(); }

  save() {
    const obs = this.editing()?.id
      ? this.me.updateAddress(this.editing()!.id!, this.form)
      : this.me.createAddress(this.form);
    obs.subscribe(() => { this.closeForm(); this.reload(); });
  }

  setDefault(a: MeAddress) {
    if (!a.id) return;
    this.me.setDefaultAddress(a.id).subscribe(() => this.reload());
  }
  remove(a: MeAddress) {
    if (!a.id || !confirm('¿Eliminar esta dirección?')) return;
    this.me.deleteAddress(a.id).subscribe(() => this.reload());
  }
}
