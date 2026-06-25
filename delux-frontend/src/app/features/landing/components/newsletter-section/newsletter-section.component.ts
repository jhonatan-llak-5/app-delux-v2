import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { inject } from '@angular/core';
import { PublicFormsService } from '@shared/services/public-forms.service';
import { NotifyService } from '@shared/services/notify.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'dlx-newsletter-section',
  standalone: true,
  imports: [CommonModule, FormsModule, RevealOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative max-w-[1600px] mx-auto px-6 md:px-10 py-20 md:py-32 bg-white dark:bg-ink-950">
      <div class="relative overflow-hidden rounded-3xl border
                  border-ink-200 dark:border-white/10
                  bg-gradient-to-br from-ink-50 to-white
                  dark:from-ink-900 dark:via-ink-900 dark:to-ink-950
                  p-12 md:p-20 reveal" dlxReveal>
        <div class="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full
                    bg-fluid-hero opacity-20 dark:opacity-30 blur-3xl animate-fluid-drift"></div>
        <div class="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full
                    bg-fluid-hero opacity-20 dark:opacity-30 blur-3xl animate-fluid-drift"></div>
        <div class="absolute inset-0 noise"></div>

        <div class="relative grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div class="lg:col-span-7">
            <p class="eyebrow">/ Newsletter</p>
            <h2 class="display-xl text-4xl md:text-6xl mt-6 leading-[0.95] text-ink-950 dark:text-white">
              Sé el primero<br/>
              <span class="text-ink-400 dark:text-white/40">en saber.</span>
            </h2>
            <p class="text-ink-700 dark:text-white/60 mt-6 max-w-md leading-relaxed">
              Recibe lanzamientos exclusivos, descuentos personalizados y acceso
              anticipado a nuestras colecciones. Sin spam, solo lo bueno.
            </p>
          </div>

          <div class="lg:col-span-5">
            <form (ngSubmit)="submit()" class="space-y-3">
              <div class="relative">
                <input type="email" required
                       [ngModel]="email()" (ngModelChange)="email.set($event)" name="email"
                       placeholder="tu@correo.com"
                       class="w-full px-6 py-5 rounded-full
                              bg-white dark:bg-white/5
                              border border-ink-200 dark:border-white/10
                              text-ink-950 dark:text-white
                              focus:border-accent-400 focus:outline-none
                              placeholder:text-ink-400 dark:placeholder:text-white/30 text-base" />
                <button type="submit"
                        class="absolute right-2 top-1/2 -translate-y-1/2 btn-accent text-xs uppercase
                               tracking-widest font-bold px-6 py-3 group">
                  Suscribir
                  <i class="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition"></i>
                </button>
              </div>
              <p class="text-xs text-ink-500 dark:text-white/40 tracking-wide">
                Al suscribirte aceptas nuestros <a class="underline">términos</a> y
                <a class="underline">política de privacidad</a>.
              </p>
            </form>

            @if (sent()) {
              <p class="mt-4 text-accent-600 dark:text-accent-400 text-sm animate-fade-in">
                ¡Gracias! Pronto sabrás del próximo drop.
              </p>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class NewsletterSectionComponent {
  private forms = inject(PublicFormsService);
  private notify = inject(NotifyService);
  email = signal('');
  sent = signal(false);
  saving = signal(false);
  submit() {
    if (!this.email().includes('@')) { this.notify.warning('Ingresa un correo válido'); return; }
    this.saving.set(true);
    this.forms.subscribeNewsletter(this.email()).subscribe({
      next: r => { this.saving.set(false); this.sent.set(true); this.notify.success(r.detail || '¡Suscrito!'); this.email.set(''); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.detail || 'No se pudo suscribir.'); },
    });
  }
}
