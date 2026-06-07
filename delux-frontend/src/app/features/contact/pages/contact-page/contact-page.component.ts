import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'dlx-contact-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pt-32 pb-20">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-16">
        <div class="lg:col-span-7">
          <p class="eyebrow">/ Contacto</p>
          <h1 class="display-xl text-5xl md:text-7xl mt-6 leading-[0.95]">
            Hablemos.<br/>
            <span class="text-ink-500 dark:text-white/50">Estamos aquí.</span>
          </h1>
        </div>
        <div class="lg:col-span-5">
          <p class="text-ink-700 dark:text-white/70 leading-relaxed max-w-md">
            ¿Tienes una pregunta sobre tu pedido, una colaboración, o quieres
            saber más de un drop? Nuestro equipo responde en menos de 24 horas.
          </p>
        </div>
      </div>
    </section>

    <!-- Channels grid -->
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pb-20">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        @for (ch of channels; track ch.title) {
          <div class="editorial-card p-8 hover:shadow-lg transition group cursor-pointer">
            <div class="w-12 h-12 rounded-full bg-accent-400/10 text-accent-500 dark:text-accent-400 grid place-items-center mb-4
                        group-hover:bg-accent-400 group-hover:text-ink-950 transition">
              <i class="fa-solid {{ ch.icon }} text-lg"></i>
            </div>
            <h3 class="font-display font-bold text-lg text-ink-950 dark:text-white">{{ ch.title }}</h3>
            <p class="text-ink-700 dark:text-white/70 text-sm mt-1">{{ ch.value }}</p>
            <p class="text-ink-500 dark:text-white/50 text-xs mt-3">{{ ch.detail }}</p>
          </div>
        }
      </div>
    </section>

    <!-- Form -->
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pb-32">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">

        <!-- Left -->
        <div class="lg:col-span-5">
          <p class="eyebrow">/ Envíanos un mensaje</p>
          <h2 class="display-xl text-4xl md:text-5xl mt-6 leading-[0.95]">
            Cuéntanos<br/>
            qué necesitas.
          </h2>

          <div class="mt-12 space-y-8">
            <div>
              <h4 class="font-semibold text-sm text-ink-950 dark:text-white">Soporte 24/7</h4>
              <p class="text-ink-700 dark:text-white/70 text-sm mt-1">Lun a Dom · 8:00 a 22:00</p>
            </div>

            <div>
              <h4 class="font-semibold text-sm text-ink-950 dark:text-white">Oficina central</h4>
              <p class="text-ink-700 dark:text-white/70 text-sm mt-1">Av. Amazonas N24-03 y Colón<br/>Quito, Ecuador</p>
            </div>

            <div>
              <h4 class="font-semibold text-sm text-ink-950 dark:text-white mb-3">Síguenos</h4>
              <div class="flex gap-2">
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:hover:bg-white/10 transition cursor-pointer">
                  <i class="fa-brands fa-instagram"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:hover:bg-white/10 transition cursor-pointer">
                  <i class="fa-brands fa-tiktok"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:hover:bg-white/10 transition cursor-pointer">
                  <i class="fa-brands fa-x-twitter"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:hover:bg-white/10 transition cursor-pointer">
                  <i class="fa-brands fa-facebook"></i>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Right form -->
        <div class="lg:col-span-7">
          <form (ngSubmit)="submit()" class="editorial-card p-8 space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label class="block">
                <span class="text-sm font-semibold text-ink-800 dark:text-white/80">Nombre</span>
                <input [(ngModel)]="form.name" name="name" required
                       class="mt-1.5 w-full px-4 py-3 rounded-lg bg-white dark:bg-white/5
                              border border-ink-200 dark:border-white/10 text-sm shadow-sm
                              text-ink-950 dark:text-white placeholder:text-ink-400 dark:placeholder:text-white/30
                              focus:outline-none focus:border-accent-500 dark:focus:border-accent-400
                              focus:ring-2 focus:ring-accent-500/10 transition"
                       placeholder="Tu nombre" />
              </label>
              <label class="block">
                <span class="text-sm font-semibold text-ink-800 dark:text-white/80">Email</span>
                <input type="email" [(ngModel)]="form.email" name="email" required
                       class="mt-1.5 w-full px-4 py-3 rounded-lg bg-white dark:bg-white/5
                              border border-ink-200 dark:border-white/10 text-sm shadow-sm
                              text-ink-950 dark:text-white placeholder:text-ink-400 dark:placeholder:text-white/30
                              focus:outline-none focus:border-accent-500 dark:focus:border-accent-400
                              focus:ring-2 focus:ring-accent-500/10 transition"
                       placeholder="tu@correo.com" />
              </label>
            </div>

            <label class="block">
              <span class="text-sm font-semibold text-ink-800 dark:text-white/80">Asunto</span>
              <select [(ngModel)]="form.subject" name="subject"
                      class="mt-1.5 w-full px-4 py-3 rounded-lg bg-white dark:bg-white/5
                             border border-ink-200 dark:border-white/10 text-sm shadow-sm
                             text-ink-950 dark:text-white
                             focus:outline-none focus:border-accent-500 dark:focus:border-accent-400
                             focus:ring-2 focus:ring-accent-500/10 transition cursor-pointer">
                <option value="">Selecciona un tema</option>
                <option value="order">Consulta sobre pedido</option>
                <option value="product">Información de producto</option>
                <option value="return">Cambios y devoluciones</option>
                <option value="partner">Colaboración / partnership</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm font-semibold text-ink-800 dark:text-white/80">Mensaje</span>
              <textarea [(ngModel)]="form.message" name="message" rows="6" required
                        class="mt-1.5 w-full px-4 py-3 rounded-lg bg-white dark:bg-white/5
                               border border-ink-200 dark:border-white/10 text-sm shadow-sm
                               text-ink-950 dark:text-white placeholder:text-ink-400 dark:placeholder:text-white/30
                               focus:outline-none focus:border-accent-500 dark:focus:border-accent-400
                               focus:ring-2 focus:ring-accent-500/10 transition resize-none"
                        placeholder="Cuéntanos en qué podemos ayudarte..."></textarea>
            </label>

            <div class="flex items-center justify-between">
              <p class="text-xs text-ink-500 dark:text-white/50">Te responderemos en menos de 24h hábiles.</p>
              <button type="submit" class="btn-accent text-sm font-semibold px-5 py-3">
                Enviar mensaje
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>

            @if (sent()) {
              <p class="text-emerald-500 text-sm animate-fade-in">
                <i class="fa-solid fa-circle-check"></i> ¡Mensaje enviado! Te contactaremos pronto.
              </p>
            }
          </form>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pb-32">
      <p class="eyebrow">/ FAQ</p>
      <h2 class="display-xl text-3xl md:text-5xl mt-6 mb-12 leading-[0.95]">
        Preguntas frecuentes.
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (item of faqs; track item.q; let i = $index) {
          <details class="editorial-card p-6 group">
            <summary class="flex items-center justify-between cursor-pointer list-none">
              <span class="font-semibold text-ink-950 dark:text-white pr-4">{{ item.q }}</span>
              <i class="fa-solid fa-chevron-down text-ink-500 dark:text-white/50 group-open:rotate-180 transition"></i>
            </summary>
            <p class="text-sm text-ink-700 dark:text-white/70 leading-relaxed mt-4">{{ item.a }}</p>
          </details>
        }
      </div>
    </section>
  `,
})
export class ContactPageComponent {
  form = { name: '', email: '', subject: '', message: '' };
  sent = signal(false);

  readonly channels = [
    { icon: 'fa-envelope', title: 'Email', value: 'hola@delux.com.ec', detail: 'Respuesta en < 24h' },
    { icon: 'fa-phone', title: 'Llámanos', value: '+593 2 000 0000', detail: 'Lun-Dom 8h-22h' },
    { icon: 'fa-comments', title: 'Chat en vivo', value: 'Abierto ahora', detail: 'Respuesta inmediata' },
    { icon: 'fa-brands fa-whatsapp', title: 'WhatsApp', value: '+593 99 123 4567', detail: 'Envío de fotos OK' },
  ];

  readonly faqs = [
    { q: '¿Cuáles son los tiempos de envío?',
      a: 'Procesamos pedidos en menos de 24 horas. Quito y Guayaquil reciben en 24-48h, otras ciudades en 48-72h. Envío gratis sobre $50.' },
    { q: '¿Puedo retirar en sucursal sin costo?',
      a: 'Sí. Selecciona "Retiro en tienda" en el checkout y elige tu sucursal preferida. Estará listo en 2-4 horas hábiles.' },
    { q: '¿Cómo funcionan los cambios y devoluciones?',
      a: 'Tienes 14 días desde la entrega para solicitar cambio o devolución. El producto debe estar en perfecto estado y con etiquetas.' },
    { q: '¿Aceptan tarjetas internacionales?',
      a: 'Sí, aceptamos todas las tarjetas Visa, Mastercard, Diners y American Express. Procesamos pagos vía PayPhone con encriptación segura.' },
    { q: '¿Cuándo llegan los drops nuevos?',
      a: 'Los drops se anuncian con anticipación en nuestro newsletter e Instagram. Suscríbete para no perderte ningún lanzamiento.' },
    { q: '¿Tienen guía de tallas?',
      a: 'Cada producto tiene su guía específica en la página de detalle. Si tienes dudas, escríbenos por WhatsApp y te ayudamos.' },
  ];

  submit() {
    this.sent.set(true);
    setTimeout(() => this.sent.set(false), 5000);
    this.form = { name: '', email: '', subject: '', message: '' };
  }
}
