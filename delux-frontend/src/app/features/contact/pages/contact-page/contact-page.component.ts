import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { parseApiError } from '@shared/utils/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { PublicFormsService } from '@shared/services/public-forms.service';
import { NotifyService } from '@shared/services/notify.service';
import { BrandingService } from '@core/services/branding.service';

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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 max-w-2xl mx-auto">
          @for (ch of channels(); track ch.title) {
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
                <i class="{{ ch.icon }} text-[#0095f6] group-hover:text-white text-[18px] transition-colors"></i>
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
            @if (socials().length) {
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-[#0095f6]/10 grid place-items-center shrink-0">
                  <i class="fa-solid fa-share-nodes text-[#0095f6] text-[14px]"></i>
                </div>
                <div>
                  <h4 class="font-bold text-[14px] text-ink-950 dark:text-white">Síguenos</h4>
                  <div class="flex gap-2 mt-3 flex-wrap">
                    @for (s of socials(); track s.key) {
                      <a [href]="s.url" target="_blank" rel="noopener" [title]="s.label"
                         class="w-10 h-10 rounded-full bg-white dark:bg-white/[0.06]
                                border border-ink-200 dark:border-white/[0.08]
                                grid place-items-center
                                hover:bg-[#0095f6] hover:border-[#0095f6] hover:text-white
                                text-ink-700 dark:text-white/75 transition">
                        <i class="{{ s.icon }} text-[14px]"></i>
                      </a>
                    }
                  </div>
                </div>
              </div>
            }
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

            <div>
              <input [(ngModel)]="form.phone" name="phone" required maxlength="30" placeholder="Teléfono de contacto *" class="input-modern" />
              <dlx-field-error [error]="fe(\'phone\')" />
            </div>

            <select [(ngModel)]="form.subject" name="subject"
                    class="input-modern text-ink-950 dark:text-white dark:bg-slate-800 [&>option]:text-ink-950 [&>option]:bg-white dark:[&>option]:text-white dark:[&>option]:bg-slate-800">
              <option value="">Selecciona un tema</option>
              <option value="compra">Cómo comprar en línea</option>
              <option value="pedido">Consulta sobre mi pedido</option>
              <option value="producto">Información de producto o tallas</option>
              <option value="pago">Pagos (transferencia / DE UNA)</option>
              <option value="cuenta">Mi cuenta</option>
              <option value="otro">Otro</option>
            </select>

            <textarea [(ngModel)]="form.message" name="message" rows="6" required
                      placeholder="Cuéntanos en qué podemos ayudarte... *"
                      class="input-modern resize-none"></textarea>
            <dlx-field-error [error]="fe(\'message\')" />

            @if (branding.recaptchaSiteKey()) {
              <div id="dlx-recaptcha" class="pt-1"></div>
            }
            @if (captchaError()) {
              <p class="text-[13px] text-rose-600 dark:text-rose-400">{{ captchaError() }}</p>
            }

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
export class ContactPageComponent implements OnInit {
  private forms = inject(PublicFormsService);
  private notify = inject(NotifyService);
  branding = inject(BrandingService);
  form = { name: '', email: '', phone: '', subject: '', message: '' };
  sent = signal(false);
  saving = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  captchaError = signal<string | null>(null);
  private widgetId: number | null = null;
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }

  ngOnInit(): void {
    if (this.branding.recaptchaSiteKey()) setTimeout(() => this.renderRecaptcha(), 300);
  }

  private renderRecaptcha(retries = 20): void {
    if (typeof document === 'undefined') return;
    const g = (window as any).grecaptcha;
    const el = document.getElementById('dlx-recaptcha');
    if (!el) return;
    if (!document.getElementById('recaptcha-script')) {
      const sc = document.createElement('script');
      sc.id = 'recaptcha-script';
      sc.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      sc.async = true; sc.defer = true;
      document.head.appendChild(sc);
    }
    if (g && g.render && el.childElementCount === 0) {
      try { this.widgetId = g.render(el, { sitekey: this.branding.recaptchaSiteKey() }); } catch {}
      return;
    }
    if (retries > 0) setTimeout(() => this.renderRecaptcha(retries - 1), 250);
  }

  private resetCaptcha(): void {
    const g = (window as any).grecaptcha;
    if (g && this.widgetId !== null) { try { g.reset(this.widgetId); } catch {} }
  }

  /** Canales de contacto, tomados de la configuración del superadmin. */
  readonly channels = computed(() => {
    const email = this.branding.contactEmail();
    const wa = this.branding.whatsappNumber();
    const list: { icon: string; title: string; value: string; detail: string; link: string }[] = [];
    if (email) list.push({ icon: 'fa-solid fa-envelope', title: 'Email', value: email, detail: 'Respuesta en < 24h', link: 'mailto:' + email });
    if (wa) list.push({ icon: 'fa-brands fa-whatsapp', title: 'WhatsApp', value: wa, detail: 'Escríbenos por WhatsApp', link: this.branding.whatsappLink() });
    return list;
  });

  /** Redes sociales configuradas (solo las que tienen enlace). */
  readonly socials = computed(() => this.branding.socialLinks());

  readonly faqs = [
    { q: '¿Cómo hago una compra en línea?',
      a: 'Elige tu producto, selecciona talla y color, agrégalo al carrito y ve al checkout. Completa tus datos, elige recibirlo a domicilio o retirarlo en la sucursal, y confirma el pago por transferencia o DE UNA.' },
    { q: '¿Necesito crear una cuenta para comprar?',
      a: 'Puedes crear tu cuenta gratis con tu correo: recibirás un código de activación para confirmarla. Con tu cuenta guardas tus datos, ves el estado de tus pedidos y tu historial de compras.' },
    { q: '¿Qué formas de pago aceptan?',
      a: 'Los pagos son por transferencia bancaria y por DE UNA. Al finalizar la compra verás los datos de la cuenta o el código QR, y deberás subir el comprobante para que validemos tu pedido.' },
    { q: '¿Puedo recibir a domicilio o retirar en la tienda?',
      a: 'Ambas opciones. En el checkout eliges "Envío a domicilio" (indicas tu dirección) o "Retiro en tienda" (eliges la sucursal y pasas a recogerlo).' },
    { q: '¿Qué productos manejan y qué tallas hay?',
      a: 'Manejamos calzado DLUX, ropa y accesorios urbanos. Cada producto muestra las tallas y colores disponibles en su página de detalle; solo puedes agregar al carrito las combinaciones con stock.' },
    { q: '¿Cómo sé si mi compra fue confirmada?',
      a: 'Al subir tu comprobante, tu pedido queda registrado y nuestro equipo lo valida. Podrás ver el estado en la sección "Mis compras" de tu cuenta.' },
  ];

  submit() {
    const errs: Record<string, string> = {};
    const email = this.form.email?.trim() || '';
    if (!this.form.name?.trim()) errs['name'] = 'Este campo es obligatorio.';
    if (!email) errs['email'] = 'Este campo es obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs['email'] = 'Ingresa un correo válido.';
    if (!this.form.phone?.trim()) errs['phone'] = 'Este campo es obligatorio.';
    if (!this.form.message?.trim()) errs['message'] = 'Este campo es obligatorio.';
    this.fieldErrors.set(errs);
    if (Object.keys(errs).length) return;

    // reCAPTCHA solo si el superadmin lo configuró.
    this.captchaError.set(null);
    let token = '';
    if (this.branding.recaptchaSiteKey()) {
      const g = (window as any).grecaptcha;
      token = (g && this.widgetId !== null ? g.getResponse(this.widgetId) : '') || '';
      if (!token) { this.captchaError.set('Por favor completa el reCAPTCHA.'); return; }
    }

    this.saving.set(true);
    this.forms.contact({ ...this.form, recaptcha_token: token }).subscribe({
      next: r => {
        this.saving.set(false);
        this.sent.set(true);
        this.notify.success(r.detail || 'Mensaje enviado.');
        setTimeout(() => this.sent.set(false), 5000);
        this.form = { name: '', email: '', phone: '', subject: '', message: '' };
        this.resetCaptcha();
      },
      error: e => {
        this.saving.set(false);
        this.resetCaptcha();
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        if (p.message && !Object.keys(p.fieldErrors).length) this.notify.error(p.message);
      },
    });
  }
}
