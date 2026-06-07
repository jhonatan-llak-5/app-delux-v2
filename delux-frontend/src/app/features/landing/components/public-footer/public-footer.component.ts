import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dlx-public-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="bg-white dark:bg-[#0a0a0a] border-t border-ink-100 dark:border-white/[0.06]">

      <!-- ─────── Newsletter strip (premium) ─────── -->
      <div class="border-b border-ink-100 dark:border-white/[0.06]">
        <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-12
                    grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div class="md:col-span-7">
            <h3 class="font-bold text-[22px] md:text-[26px] tracking-[-0.015em] leading-tight
                       text-ink-950 dark:text-white">
              Suscríbete y recibe los drops antes que nadie.
            </h3>
            <p class="text-ink-600 dark:text-white/55 text-[14px] mt-2">
              Sin spam. Sólo lanzamientos y ofertas exclusivas para suscriptores.
            </p>
          </div>
          <form class="md:col-span-5 flex gap-2">
            <input type="email" required placeholder="tu@correo.com"
                   class="input-modern flex-1" />
            <button type="submit" class="btn-modern-primary" style="width:auto;padding:0 24px;">
              Suscribirme
            </button>
          </form>
        </div>
      </div>

      <!-- ─────── Grid de columnas ─────── -->
      <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-16
                  grid grid-cols-2 md:grid-cols-12 gap-10">

        <!-- Brand block -->
        <div class="col-span-2 md:col-span-4">
          <a routerLink="/" class="flex items-center gap-2.5 w-fit">
            <div class="w-10 h-10 rounded-xl bg-ink-950 dark:bg-white grid place-items-center
                        font-bold text-white dark:text-ink-950 text-base">D</div>
            <span class="font-bold text-xl tracking-tight text-ink-950 dark:text-white">Delux</span>
          </a>
          <p class="text-ink-600 dark:text-white/55 text-[14px] leading-relaxed mt-5 max-w-sm">
            Streetwear premium en Ecuador. Drops exclusivos de las marcas que definen
            la cultura urbana, envío en 24h y retiro en sucursales.
          </p>

          <!-- Social row -->
          <div class="flex items-center gap-2 mt-6">
            @for (s of socials; track s.icon) {
              <a [href]="s.url" target="_blank" rel="noopener"
                 [attr.aria-label]="s.label"
                 class="w-10 h-10 grid place-items-center rounded-full
                        bg-ink-50 dark:bg-white/[0.04]
                        text-ink-700 dark:text-white/70
                        hover:bg-[#0095f6] hover:text-white
                        transition-colors">
                <i class="fa-brands {{ s.icon }} text-[14px]"></i>
              </a>
            }
          </div>

          <!-- Pago / envío badges -->
          <div class="mt-7 flex items-center gap-4 text-ink-400 dark:text-white/30 text-[18px]">
            <i class="fa-brands fa-cc-visa" title="Visa"></i>
            <i class="fa-brands fa-cc-mastercard" title="Mastercard"></i>
            <i class="fa-brands fa-cc-amex" title="Amex"></i>
            <i class="fa-brands fa-cc-diners-club" title="Diners"></i>
            <span class="w-px h-5 bg-ink-200 dark:bg-white/15"></span>
            <span class="text-[11px] font-semibold uppercase tracking-wider">PayPhone</span>
          </div>
        </div>

        <!-- Columnas de links -->
        @for (col of columns; track col.title) {
          <div class="md:col-span-2">
            <h4 class="font-bold text-[12px] uppercase tracking-[0.2em]
                       text-ink-950 dark:text-white mb-5">
              {{ col.title }}
            </h4>
            <ul class="space-y-3">
              @for (item of col.items; track item.label) {
                <li>
                  <a [routerLink]="item.route" [queryParams]="item.qp || null"
                     class="text-[14px] text-ink-600 dark:text-white/55
                            hover:text-[#0095f6] dark:hover:text-[#0095f6] transition">
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        <!-- Contacto -->
        <div class="md:col-span-2">
          <h4 class="font-bold text-[12px] uppercase tracking-[0.2em]
                     text-ink-950 dark:text-white mb-5">
            Contacto
          </h4>
          <ul class="space-y-3 text-[14px] text-ink-600 dark:text-white/55">
            <li class="flex items-start gap-2">
              <i class="fa-solid fa-envelope text-[#0095f6] text-[12px] mt-1"></i>
              <a href="mailto:hola@delux.com.ec" class="hover:text-[#0095f6] transition">
                hola@delux.com.ec
              </a>
            </li>
            <li class="flex items-start gap-2">
              <i class="fa-brands fa-whatsapp text-[#0095f6] text-[13px] mt-0.5"></i>
              <a href="https://wa.me/593991234567" class="hover:text-[#0095f6] transition">
                +593 99 123 4567
              </a>
            </li>
            <li class="flex items-start gap-2">
              <i class="fa-solid fa-location-dot text-[#0095f6] text-[12px] mt-1"></i>
              <span>Quito, Ecuador</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- ─────── Bottom bar ─────── -->
      <div class="border-t border-ink-100 dark:border-white/[0.06]">
        <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-5
                    flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-[12px] text-ink-500 dark:text-white/45">
            © {{ year }} Delux. Todos los derechos reservados.
          </p>
          <div class="flex items-center gap-5 text-[12px] text-ink-500 dark:text-white/45">
            <a routerLink="/" class="hover:text-ink-950 dark:hover:text-white transition">Términos</a>
            <span class="w-px h-3 bg-ink-200 dark:bg-white/15"></span>
            <a routerLink="/" class="hover:text-ink-950 dark:hover:text-white transition">Privacidad</a>
            <span class="w-px h-3 bg-ink-200 dark:bg-white/15"></span>
            <a routerLink="/" class="hover:text-ink-950 dark:hover:text-white transition">Cookies</a>
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono text-ink-400 dark:text-white/35 uppercase tracking-widest">
            <span>EC</span>
            <span class="w-1 h-1 rounded-full bg-current"></span>
            <span>USD</span>
            <span class="w-1 h-1 rounded-full bg-current"></span>
            <span>ES</span>
          </div>
        </div>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  readonly year = new Date().getFullYear();

  readonly socials = [
    { icon: 'fa-instagram', label: 'Instagram', url: 'https://instagram.com' },
    { icon: 'fa-tiktok', label: 'TikTok', url: 'https://tiktok.com' },
    { icon: 'fa-x-twitter', label: 'X', url: 'https://x.com' },
    { icon: 'fa-facebook', label: 'Facebook', url: 'https://facebook.com' },
    { icon: 'fa-youtube', label: 'YouTube', url: 'https://youtube.com' },
  ];

  readonly columns = [
    { title: 'Comprar', items: [
      { label: 'Zapatillas',  route: '/shop', qp: { category: 'zapatillas' } },
      { label: 'Ropa',        route: '/shop', qp: { category: 'ropa' } },
      { label: 'Mochilas',    route: '/shop', qp: { category: 'mochilas' } },
      { label: 'Accesorios',  route: '/shop', qp: { category: 'accesorios' } },
      { label: 'Todos los drops', route: '/shop' },
    ]},
    { title: 'Ayuda', items: [
      { label: 'Envíos y tiempos',        route: '/tracking', qp: null },
      { label: 'Cambios y devoluciones',  route: '/contact',  qp: null },
      { label: 'Guía de tallas',          route: '/contact',  qp: null },
      { label: 'FAQ',                     route: '/contact',  qp: null },
      { label: 'Rastrear pedido',         route: '/tracking', qp: null },
    ]},
    { title: 'Empresa', items: [
      { label: 'Sobre nosotros',         route: '/',         qp: null },
      { label: 'Sucursales',             route: '/',         qp: null },
      { label: 'Trabaja con nosotros',   route: '/contact',  qp: null },
      { label: 'Sé un partner',          route: '/contact',  qp: null },
      { label: 'Newsletter',             route: '/',         qp: null },
    ]},
  ];
}
