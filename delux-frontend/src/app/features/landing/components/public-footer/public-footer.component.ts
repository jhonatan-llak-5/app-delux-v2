import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dlx-public-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer id="contact" class="relative border-t border-ink-200 dark:border-white/10
                                bg-ink-50 dark:bg-ink-950 mt-16">
      <div class="h-px w-full bg-gradient-to-r from-transparent via-accent-500/40 dark:via-accent-400/50 to-transparent"></div>

      <div class="max-w-[1600px] mx-auto px-6 md:px-10 py-20">
        <div class="border-b border-ink-200 dark:border-white/10 pb-16 mb-16">
          <h2 class="display-xl text-[20vw] md:text-[14vw] leading-none
                     text-ink-200 dark:text-white/10 select-none">DELUX</h2>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-12">
          <div class="col-span-2">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 via-brand-violet to-brand-magenta
                          grid place-items-center font-display font-bold text-ink-950">D</div>
              <span class="font-display font-bold text-2xl text-ink-950 dark:text-white">Delux</span>
            </div>
            <p class="text-ink-600 dark:text-white/50 max-w-sm text-sm leading-relaxed">
              Streetwear premium en Ecuador. Drops exclusivos, retiro en sucursales
              y envíos a todo el país.
            </p>
            <div class="flex gap-2 mt-8">
              @for (s of socials; track s.icon) {
                <a class="w-11 h-11 grid place-items-center rounded-full
                          bg-ink-100 dark:bg-white/5
                          hover:bg-ink-200 dark:hover:bg-white/10
                          hover:scale-110 transition-all"
                   [attr.aria-label]="s.label">
                  <i class="fa-brands {{ s.icon }} text-ink-700 dark:text-white"></i>
                </a>
              }
            </div>
          </div>

          @for (col of columns; track col.title) {
            <div>
              <h4 class="font-display font-bold uppercase text-xs tracking-widest mb-5 text-ink-950 dark:text-white">
                {{ col.title }}
              </h4>
              <ul class="space-y-3 text-ink-600 dark:text-white/50 text-sm">
                @for (item of col.items; track item) {
                  <li><a [routerLink]="item.route" class="hover:text-ink-950 dark:hover:text-white transition">{{ item.label }}</a></li>
                }
              </ul>
            </div>
          }
        </div>
      </div>

      <div class="border-t border-ink-200 dark:border-white/10">
        <div class="max-w-[1600px] mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row
                    items-center justify-between gap-4">
          <p class="text-ink-500 dark:text-white/40 text-xs tracking-wide">
            © {{ year }} Delux. Todos los derechos reservados.
          </p>
          <div class="flex items-center gap-6 font-mono text-[10px] tracking-widest
                      text-ink-400 dark:text-white/30">
            <span>EC</span><span>USD</span><span>ES</span>
          </div>
          <p class="text-ink-500 dark:text-white/40 text-xs tracking-wide">
            Hecho con <i class="fa-solid fa-heart text-rose-500"></i> en Ecuador
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  readonly year = new Date().getFullYear();
  readonly socials = [
    { icon: 'fa-instagram', label: 'Instagram' },
    { icon: 'fa-x-twitter', label: 'X' },
    { icon: 'fa-facebook', label: 'Facebook' },
    { icon: 'fa-youtube', label: 'YouTube' },
    { icon: 'fa-tiktok', label: 'TikTok' },
  ];
  readonly columns = [
    { title: 'Comprar', items: [
      { label: 'Zapatillas',  route: '/shop', qp: { category: 'zapatillas' } },
      { label: 'Ropa',        route: '/shop', qp: { category: 'ropa' } },
      { label: 'Mochilas',    route: '/shop', qp: { category: 'mochilas' } },
      { label: 'Accesorios',  route: '/shop', qp: { category: 'accesorios' } },
      { label: 'Drops',       route: '/shop', qp: { sort: 'new' } },
    ]},
    { title: 'Ayuda', items: [
      { label: 'Envíos y tiempos',       route: '/tracking' },
      { label: 'Cambios y devoluciones',  route: '/account/orders' },
      { label: 'Guía de tallas',          route: '/contact' },
      { label: 'FAQ',                     route: '/contact' },
      { label: 'Contáctanos',             route: '/contact' },
    ]},
    { title: 'Empresa', items: [
      { label: 'Sobre Delux',           route: '/', fragment: 'about' },
      { label: 'Sucursales',            route: '/', fragment: 'branches' },
      { label: 'Trabaja con nosotros',  route: '/contact' },
      { label: 'Términos',              route: '/contact' },
      { label: 'Privacidad',            route: '/contact' },
    ]},
  ];
}
