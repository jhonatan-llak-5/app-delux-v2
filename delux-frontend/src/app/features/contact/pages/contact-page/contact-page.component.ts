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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-px" style="background: rgba(var(--text), 0.08);">
        @for (ch of channels; track ch.title) {
          <div class="bg-white dark:bg-ink-950 p-8 hover:bg-ink-100 dark:bg-ink-800 transition group cursor-pointer">
            <div class="w-12 h-12 rounded-full bg-accent-400/10 text-accent-400 grid place-items-center mb-4
                        group-hover:bg-accent-400 group-hover:text-ink-950 transition">
              <i class="fa-solid {{ ch.icon }} text-lg"></i>
            </div>
            <h3 class="font-display font-bold text-lg">{{ ch.title }}</h3>
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
              <h4 class="font-semibold text-sm">Soporte 24/7</h4>
              <p class="text-ink-700 dark:text-white/70 text-sm mt-1">Lun a Dom · 8:00 a 22:00</p>
            </div>

            <div>
              <h4 class="font-semibold text-sm">Oficina central</h4>
              <p class="text-ink-700 dark:text-white/70 text-sm mt-1">Av. Amazonas N24-03 y Colón<br/>Quito, Ecuador</p>
            </div>

            <div>
              <h4 class="font-semibold text-sm mb-3">Síguenos</h4>
              <div class="flex gap-2">
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:bg-ink-800 transition">
                  <i class="fa-brands fa-instagram"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:bg-ink-800 transition">
                  <i class="fa-brands fa-tiktok"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:bg-ink-800 transition">
                  <i class="fa-brands fa-x-twitter"></i>
                </a>
                <a class="w-11 h-11 grid place-items-center rounded-full glass hover:bg-ink-100 dark:bg-ink-800 transition">
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
                <span class="text-xs font-bold uppercase tracking-widest text-ink-700 dark:text-white/70">Nombre</span>
                <input [(ngModel)]="form.name" name="name" required
                       class="mt-2 w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm focus:outline-none focus:border-accent-400 transition"
                       style="border-color: rgba(var(--text), 0.1);" placeholder="Tu nombre" />
              </label>
              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-ink-700 dark:text-white/70">Email</span>
                <input type="email" [(ngModel)]="form.email" name="email" required
                       class="mt-2 w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm focus:outline-none focus:border-accent-400 transition"
                       style="border-color: rgba(var(--text), 0.1);" placeholder="tu@correo.com" />
              </label>
            </div>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-ink-700 dark:text-white/70">Asunto</span>
              <select [(ngModel)]="form.subject" name="subject"
                      class="mt-2 w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm focus:outline-none focus:border-accent-400 transition"
                      style="border-color: rgba(var(--text), 0.1);">
                <option value="">Selecciona un tema</option>
                <option value="order">Consulta sobre pedido</option>
                <option value="product">Información de producto</option>
                <option value="return">Cambios y devoluciones</option>
                <option value="partner">Colaboración / partnership</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-ink-700 dark:text-white/70">Mensaje</span>
              <textarea [(ngModel)]="form.message" name="message" rows="6" required
                        class="mt-2 w-full px-4 py-3 rounded-lg bg-ink-100 dark:bg-ink-800 border text-sm focus:outline-none focus:border-accent-400 transition"
                        style="border-color: rgba(var(--text), 0.1);"
                        placeholder="Cuéntanos en qué podemos ayudarte..."></textarea>
            </label>

            <div class="flex items-center justify-between">
              <p class="text-xs text-ink-500 dark:text-white/50">Te responderemos en menos de 24h hábiles.</p>
              <button type="submit" class="btn-accent text-xs uppercase tracking-widest font-bold">
                Enviar mensaje
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>

            @if (sent()) {
              <p class="text-emerald-400 text-sm animate-fade-in">
                <i class="fa-solid fa-check-circle"></i> ¡Mensaje enviado! Te contactaremos pronto.
              </p>
            }
          </form>
        </div>
      </div>
    </section>

    <!-- FAQ rápida -->
    <section class="max-w-[1600px] mx-auto px-6 md:px-10 pb-32">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-4">
          <p class="eyebrow">/ FAQ</p>
          <h2 class="display-xl text-3xl md:text-5xl mt-6 leading-[0.95]">
            Preguntas<br/>frecuentes.
          </h2>
        </div>
        <div class="lg:col-span-8 space-y-3">
          @for (q of faqs; track q.q) {
            <details class="editorial-card group">
              <summary class="cursor-pointer p-6 font-semibold flex items-center justify-between list-none">
                <span>{{ q.q }}</span>
                <i class="fa-solid fa-plus text-sm group-open:rotate-45 transition-transform"></i>
              </summary>
              <p class="px-6 pb-6 text-ink-700 dark:text-white/70 text-sm leading-relaxed">{{ q.a }}</p>
            </details>
          }
        </div>
      </div>
    </section>
  `,
})
export class ContactPageComponent {
  sent = signal(false);
  form = { name: '', email: '', subject: '', message: '' };

  readonly channels = [
    { icon: 'fa-envelope', title: 'Email', value: 'hola@delux.com', detail: 'Respuesta en 24h' },
    { icon: 'fa-phone', title: 'Teléfono', value: '+593 2 256 7890', detail: 'Lun a Sáb 9:00-18:00' },
    { icon: 'fa-comments', title: 'Chat en vivo', value: 'Abierto ahora', detail: 'Respuesta inmediata' },
    { icon: 'fa-brands fa-whatsapp', title: 'WhatsApp', value: '+593 99 123 4567', detail: 'Envío de fotos OK' },
  ];

  readonly faqs = [
    { q: '¿Cuáles son los tiempos de envío?',
      a: 'Procesamos pedidos en menos de 24 horas. Quito y Guayaquil reciben en 24-48h, otras ciudades en 48-72h. Envío gratis sobre $50.' },
    { q: '¿Puedo retirar en sucursal sin costo?',
      a: 'Sí. Selecciona "Retiro en tienda" en el checkout y elige tu sucursal preferida. Estará listo en 2-4 horas hábiles.' },
    { q: '¿Cómo sé que el producto es original?',
      a: 'Todos nuestros productos son 100% originales con factura oficial y certificado de autenticidad. Trabajamos directamente con distribuidores autorizados.' },
    { q: '¿Cuál es la política de cambios?',
      a: 'Tienes 14 días para cambiar tu producto sin preguntas. Sin uso, con etiquetas y empaque original. Cambios gratis en sucursal o con costo de logística reverso a domicilio.' },
    { q: '¿Aceptan pago en cuotas?',
      a: 'Sí. Aceptamos tarjetas de crédito en 3, 6 y 12 meses sin interés con bancos seleccionados. También PayPhone, transferencia y efectivo en sucursal.' },
  ];

  submit() {
    if (!this.form.email || !this.form.message) return;
    this.sent.set(true);
    this.form = { name: '', email: '', subject: '', message: '' };
    setTimeout(() => this.sent.set(false), 5000);
  }
}
