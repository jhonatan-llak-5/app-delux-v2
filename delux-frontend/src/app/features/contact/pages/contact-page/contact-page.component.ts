import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { parseApiError } from '@shared/utils/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { PublicFormsService } from '@shared/services/public-forms.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-contact-page',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- HEADER -->
    <section class="bg-white dark:bg-slate-950 pt-32 pb-16">
      <div class="max-w-[1100px] mx-auto px-6 md:px-10 text-center">
        <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-4">
          Contacto
        </p>
        <h1 class="font-bold text-[44px] md:text-[64px] tracking-[-0.03em] leading-[1.05]
                   text-ink-950 dark:text-white">
          Hablemos.<br/>
          <span class="text-ink-500 dark:text-white/45">Estamos aquí.</span>
        </h1>
        <p class="text-ink-600 dark:text-white/55 text-[16px] mt-6 leading-relaxed max-w-xl mx-auto">
          ¿Tienes una pregunta sobre tu pedido, una colaboración, o quieres saber más de un drop?
          Nuestro equipo responde en menos de 24 horas.
        </p>
      </div>
    </section>

    <!-- CANALES DE CONTACTO -->
    <section class="bg-white dark:bg-slate-950 pb-20">
      <div class="max-w-[1100px] mx-auto px-6 md:px-10">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (ch of channels; track ch.title) {
            <a [href]="ch.link" target="_blank" rel="noopener"
               class="group block p-7 rounded-3xl
                      bg-white dark:bg-slate-800
                      border border-ink-200 dark:border-white/[0.08]
                      hover:border-[#0095f6] dark:hover:border-[#0095f6]
                      hover:shadow-lg hover:-translate-y-1
                      transition-all duration-300">
              <div class="w-12 h-12 rounded-full bg-[#0095f6]/10 dark:bg-[#0095f6]/15
                          grid place-items-center mb-5
                          group-hover:bg-[#0095f6] group-hover:text-white transition-colors">
                <i class="fa-solid {{ ch.icon }} text-[#0095f6] group-hover:text-white text-[18px] transition-colors"></i>
              </div>
              <h3 class="font-bold text-[16px] text-ink-950 dark:text-white mb-1">{{ ch.title }}</h3>
              <p class="text-[15px] font-semibold text-ink-950 dark:text-white">{{ ch.value }}</p>
              <p class="text-[12px] text-ink-500 dark:text-white/45 mt-2">{{ ch.detail }}</p>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- FORM + INFO -->
    <section class="bg-ink-50 dark:bg-slate-900 py-24 md:py-32">
      <div class="max-w-[1100px] mx-auto px-6 md:px-10
                  grid grid-cols-1 lg:grid-cols-12 gap-12">

        <!-- Info izquierda -->
        <div class="lg:col-span-5">
          <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-3">
            Envíanos un mensaje
          </p>
          <h2 class="font-bold text-[36px] md:text-[44px] tracking-[-0.025em] leading-[1.1]
                     text-ink-950 dark:text-white">
            Cuéntanos qué necesitas.
          </h2>
          <p class="text-ink-600 dark:text-white/55 text-[15px] mt-5 leading-relaxed">
            Llena el formulario y un miembro de nuestro equipo te contactará pronto.
          </p>

          <div class="mt-10 space-y-6">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-[#0095f6]/10 grid place-items-center shrink-0">
                <i class="fa-solid fa-clock text-[#0095f6] text-[14px]"></i>
              </div>
              <div>
                <h4 class="font-bold text-[14px] text-ink-950 dark:text-white">Soporte 24/7</h4>
                <p class="text-ink-600 dark:text-white/55 text-[14px] mt-1">Lun a Dom · 8:00 a 22:00</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-[#0095f6]/10 grid place-items-center shrink-0">
                <i class="fa-solid fa-location-dot text-[#0095f6] text-[14px]"></i>
              </div>
              <div>
                <h4 class="font-bold text-[14px] text-ink-950 dark:text-white">Oficina central</h4>
                <p class="text-ink-600 dark:text-white/55 text-[14px] mt-1">Av. Amazonas N24-03 y Colón<br/>Quito, Ecuador</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-[#0095f6]/10 grid place-items-center shrink-0">
                <i class="fa-solid fa-share-nodes text-[#0095f6] text-[14px]"></i>
              </div>
              <div>
                <h4 class="font-bold text-[14px] text-ink-950 dark:text-white">Síguenos</h4>
                <div class="flex gap-2 mt-3">
                  @for (s of socials; track s.icon) {
                    <a [href]="s.url" target="_blank" rel="noopener"
                       class="w-10 h-10 rounded-full bg-white dark:bg-white/[0.06]
                              border border-ink-200 dark:border-white/[0.08]
                              grid place-items-center
                              hover:bg-[#0095f6] hover:border-[#0095f6] hover:text-white
                              text-ink-700 dark:text-white/75 transition">
                      <i class="fa-brands {{ s.icon }} text-[14px]"></i>
                    </a>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Form derecha -->
        <div class="lg:col-span-7">
          <form (ngSubmit)="submit()" class="bg-white dark:bg-slate-800
                                              border border-ink-200 dark:border-white/[0.08]
                                              rounded-3xl p-8 md:p-10 space-y-4">

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input [(ngModel)]="form.name" name="name" required maxlength="120" placeholder="Tu nombre *" class="input-modern" />
                <dlx-field-error [error]="fe(\'name\')" />
              </div>
              <div>
                <input [(ngModel)]="form.email" name="email" type="email" required placeholder="tu@correo.com *" class="input-modern" />
                <dlx-field-error [error]="fe(\'email\')" />
              </div>
            </div>

            <select [(ngModel)]="form.subject" name="subject" class="input-modern">
              <option value="">Selecciona un tema</option>
              <option value="order">Consulta sobre pedido</option>
              <option value="product">Información de producto</option>
              <option value="return">Cambios y devoluciones</option>
              <option value="partner">Colaboración / partnership</option>
              <option value="other">Otro</option>
            </select>

            <textarea [(ngModel)]="form.message" name="message" rows="6" required
                      placeholder="Cuéntanos en qué podemos ayudarte... *"
                      class="input-modern resize-none"></textarea>
            <dlx-field-error [error]="fe(\'message\')" />

            <div class="flex items-center justify-between flex-wrap gap-4 pt-2">
              <p class="text-[12px] text-ink-500 dark:text-white/45">
                Respuesta en menos de 24h hábiles.
              </p>
              <button type="submit" class="btn-modern-primary" style="width:auto;padding:0 32px;">
                Enviar mensaje
                <i class="fa-solid fa-paper-plane text-[12px]"></i>
              </button>
            </div>

            @if (sent()) {
              <div class="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10
                          border border-emerald-200 dark:border-emerald-500/30
                          text-emerald-700 dark:text-emerald-300 text-[14px] text-center font-medium">
                <i class="fa-solid fa-circle-check"></i> ¡Mensaje enviado! Te contactaremos pronto.
              </div>
            }
          </form>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="bg-white dark:bg-slate-950 py-24 md:py-32">
      <div class="max-w-[900px] mx-auto px-6 md:px-10">
        <div class="text-center mb-14">
          <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-3">
            FAQ
          </p>
          <h2 class="font-bold text-[36px] md:text-[48px] tracking-[-0.025em] leading-[1.1]
                     text-ink-950 dark:text-white">
            Preguntas frecuentes.
          </h2>
        </div>

        <div class="space-y-3">
          @for (item of faqs; track item.q) {
            <details class="group rounded-2xl bg-ink-50 dark:bg-slate-800
                            border border-ink-200 dark:border-white/[0.08]
                            hover:border-[#0095f6] dark:hover:border-[#0095f6] transition">
              <summary class="flex items-center justify-between cursor-pointer list-none p-6">
                <span class="font-semibold text-[15px] text-ink-950 dark:text-white pr-4">{{ item.q }}</span>
                <div class="w-8 h-8 rounded-full bg-white dark:bg-white/[0.06]
                            grid place-items-center shrink-0
                            group-open:bg-[#0095f6] group-open:text-white transition-colors">
                  <i class="fa-solid fa-chevron-down text-[11px] text-ink-500 dark:text-white/55
                            group-open:text-white group-open:rotate-180 transition-transform"></i>
                </div>
              </summary>
              <p class="text-[14px] text-ink-600 dark:text-white/65 leading-relaxed px-6 pb-6">
                {{ item.a }}
              </p>
            </details>
          }
        </div>
      </div>
    </section>
  `,
})
export class ContactPageComponent {
  private forms = inject(PublicFormsService);
  private notify = inject(NotifyService);
  form = { name: '', email: '', subject: '', message: '' };
  sent = signal(false);
  saving = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  readonly channels = [
    { icon: 'fa-envelope', title: 'Email', value: 'hola@delux.com.ec', detail: 'Respuesta en < 24h', link: 'mailto:hola@delux.com.ec' },
    { icon: 'fa-phone', title: 'Llámanos', value: '+593 2 000 0000', detail: 'Lun-Dom 8h-22h', link: 'tel:+59320000000' },
    { icon: 'fa-comments', title: 'Chat en vivo', value: 'Abierto ahora', detail: 'Respuesta inmediata', link: '#' },
    { icon: 'fa-brands fa-whatsapp', title: 'WhatsApp', value: '+593 99 123 4567', detail: 'Envío de fotos OK', link: 'https://wa.me/593991234567' },
  ];

  readonly socials = [
    { icon: 'fa-instagram', url: 'https://instagram.com' },
    { icon: 'fa-tiktok', url: 'https://tiktok.com' },
    { icon: 'fa-x-twitter', url: 'https://x.com' },
    { icon: 'fa-facebook', url: 'https://facebook.com' },
  ];

  readonly faqs = [
    { q: '¿Cuáles son los tiempos de envío?',
      a: 'Procesamos pedidos en menos de 24 horas. Quito y Guayaquil reciben en 24-48h, otras ciudades en 48-72h. Envío gratis sobre $50.' },
    { q: '¿Puedo retirar en sucursal sin costo?',
      a: 'Sí. Selecciona "Retiro en tienda" en el checkout y elige tu sucursal preferida. Estará listo en 2-4 horas hábiles.' },
    { q: '¿Cómo funcionan los cambios y devoluciones?',
      a: 'Tienes 14 días desde la entrega para solicitar cambio o devolución. El producto debe estar en perfecto estado y con etiquetas.' },
    { q: '¿Aceptan tarjetas internacionales?',
      a: 'Sí, aceptamos Visa, Mastercard, Diners y American Express. Procesamos pagos vía PayPhone con encriptación segura.' },
    { q: '¿Cuándo llegan los drops nuevos?',
      a: 'Los drops se anuncian con anticipación en nuestro newsletter e Instagram. Suscríbete para no perderte ningún lanzamiento.' },
    { q: '¿Tienen guía de tallas?',
      a: 'Cada producto tiene su guía específica en la página de detalle. Si tienes dudas, escríbenos por WhatsApp y te ayudamos.' },
  ];

  submit() {
    const errs: Record<string, string> = {};
    if (!this.form.name?.trim()) errs['name'] = 'Este campo es obligatorio.';
    if (!this.form.email?.trim()) errs['email'] = 'Este campo es obligatorio.';
    if (!this.form.message?.trim()) errs['message'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;
    this.saving.set(true);
    this.forms.contact(this.form).subscribe({
      next: r => {
        this.saving.set(false);
        this.sent.set(true);
        this.notify.success(r.detail || 'Mensaje enviado.');
        setTimeout(() => this.sent.set(false), 5000);
        this.form = { name: '', email: '', subject: '', message: '' };
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        if (p.message && !Object.keys(p.fieldErrors).length) this.notify.error(p.message);
      },
    });
  }
}
