import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PublicFormsService } from '@shared/services/public-forms.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { environment } from '@env/environment';
import { BrandingService } from '@core/services/branding.service';

@Component({
  selector: 'dlx-public-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="bg-slate-950 border-t border-white/10">

      <!-- ─────── Newsletter strip (premium) ─────── -->
      <div class="border-b border-white/10">
        <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-12
                    grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div class="md:col-span-7">
            <h3 class="font-bold text-[22px] md:text-[26px] tracking-[-0.015em] leading-tight
                       text-white">
              Suscríbete y recibe los drops antes que nadie.
            </h3>
            <p class="text-white/60 text-[14px] mt-2">
              Sin spam. Sólo lanzamientos y ofertas exclusivas para suscriptores.
            </p>
          </div>
          <form class="md:col-span-5" (ngSubmit)="subscribe()">
            <div class="flex gap-2">
              <input type="email" required placeholder="tu@correo.com"
                     [(ngModel)]="email" name="footerEmail"
                     class="input-modern flex-1" />
              <button type="submit" class="btn-modern-primary" style="width:auto;padding:0 24px;">
                Suscribirme
              </button>
            </div>
            @if (fieldErr()) { <p class="text-xs text-rose-500 mt-2">{{ fieldErr() }}</p> }
          </form>
        </div>
      </div>

      <!-- ─────── Grid de columnas ─────── -->
      <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-16
                  grid grid-cols-2 md:grid-cols-12 gap-10">

        <!-- Brand block -->
        <div class="col-span-2 md:col-span-4">
          <a routerLink="/" class="flex items-center gap-2.5 w-fit">
            @if (branding.logoUrl()) {
              <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()"
                   class="h-10 w-auto max-w-[180px] object-contain rounded-xl" />
            } @else {
              <div class="w-10 h-10 rounded-xl bg-white grid place-items-center
                          font-bold text-ink-950 text-base">{{ branding.siteName().charAt(0) }}</div>
              <span class="font-bold text-xl tracking-tight text-white">{{ branding.siteName() }}</span>
            }
          </a>
          <p class="text-white/60 text-[14px] leading-relaxed mt-5 max-w-sm">
            Calzado original en Ecuador. Estilo, calidad y compromiso social;
            envíos a todo el país y retiro en nuestras sucursales.
          </p>

          <!-- Social row (dinámico según config) -->
          @if (branding.socialLinks().length) {
            <div class="flex items-center gap-2 mt-6 flex-wrap">
              @for (s of branding.socialLinks(); track s.key) {
                <a [href]="s.url" target="_blank" rel="noopener"
                   [attr.aria-label]="s.label"
                   class="w-10 h-10 grid place-items-center rounded-full
                          bg-white/[0.06]
                          text-white/70
                          hover:bg-[#0095f6] hover:text-white
                          transition-colors">
                  <i class="{{ s.icon }} text-[14px]"></i>
                </a>
              }
            </div>
          }

          <!-- Métodos de pago -->
          <div class="mt-7 flex items-center gap-3 text-[12px] text-white/45">
            <i class="fa-solid fa-building-columns text-[#0095f6]"></i>
            <span>Pagos por transferencia bancaria y DE UNA</span>
          </div>
        </div>

        <!-- Columnas de links -->
        @for (col of columns; track col.title) {
          <div class="md:col-span-2">
            <h4 class="font-bold text-[12px] uppercase tracking-[0.2em]
                       text-white mb-5">
              {{ col.title }}
            </h4>
            <ul class="space-y-3">
              @for (item of col.items; track item.label) {
                <li>
                  <a [routerLink]="item.route" [queryParams]="item.qp || null"
                     class="text-[14px] text-white/60
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
                     text-white mb-5">
            Contacto
          </h4>
          <ul class="space-y-3 text-[14px] text-white/60">
            @if (branding.contactEmail()) {
              <li class="flex items-start gap-2">
                <i class="fa-solid fa-envelope text-[#0095f6] text-[12px] mt-1"></i>
                <a [href]="'mailto:' + branding.contactEmail()" class="hover:text-[#0095f6] transition break-all">
                  {{ branding.contactEmail() }}
                </a>
              </li>
            }
            @if (branding.whatsappNumber()) {
              <li class="flex items-start gap-2">
                <i class="fa-brands fa-whatsapp text-[#0095f6] text-[13px] mt-0.5"></i>
                <a [href]="branding.whatsappLink()" target="_blank" rel="noopener" class="hover:text-[#0095f6] transition">
                  {{ branding.whatsappNumber() }}
                </a>
              </li>
            }
            <li class="flex items-start gap-2">
              <i class="fa-solid fa-location-dot text-[#0095f6] text-[12px] mt-1"></i>
              <span>Ecuador</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- ─────── Bottom bar ─────── -->
      <div class="border-t border-white/10">
        <div class="max-w-[1400px] mx-auto px-6 md:px-10 py-5
                    flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-[12px] text-white/45">
            © {{ year }} {{ branding.siteName() }}. Todos los derechos reservados.
            <span class="ml-2 opacity-60">· v{{ appVersion }}</span>
          </p>
          <div class="flex items-center gap-5 text-[12px] text-white/45">
            <a routerLink="/terms" class="hover:text-white transition">Términos</a>
            <span class="w-px h-3 bg-white/15"></span>
            <a routerLink="/privacy" class="hover:text-white transition">Privacidad</a>
            <span class="w-px h-3 bg-white/15"></span>
            <a routerLink="/cookies" class="hover:text-white transition">Cookies</a>
          </div>
          <div class="flex items-center gap-3 text-[11px] font-mono text-white/35 uppercase tracking-widest">
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
  private forms = inject(PublicFormsService);
  private notify = inject(NotifyService);
  branding = inject(BrandingService);
  email = '';
  fieldErr = signal<string | null>(null);
  readonly year = new Date().getFullYear();
  readonly appVersion = environment.appVersion;

  subscribe() {
    this.fieldErr.set(null);
    if (!this.email.includes('@')) { this.fieldErr.set('Ingresa un correo válido.'); return; }
    this.forms.subscribeNewsletter(this.email).subscribe({
      next: r => { this.notify.success(r.detail || '¡Suscrito!'); this.email = ''; },
      error: e => this.fieldErr.set(parseApiError(e).message || 'No se pudo suscribir.'),
    });
  }

  readonly columns = [
    { title: 'Comprar', items: [
      { label: 'Zapatillas',  route: '/shop', qp: { category: 'zapatillas' } },
      { label: 'Ropa',        route: '/shop', qp: { category: 'ropa' } },
      { label: 'Mochilas',    route: '/shop', qp: { category: 'mochilas' } },
      { label: 'Accesorios',  route: '/shop', qp: { category: 'accesorios' } },
      { label: 'Todos los drops', route: '/shop' },
    ]},
    { title: 'Ayuda', items: [
      { label: 'Cómo comprar',     route: '/contact',  qp: null },
      { label: 'Guía de tallas',   route: '/contact',  qp: null },
      { label: 'Preguntas frecuentes', route: '/contact',  qp: null },
      { label: 'Rastrear pedido',  route: '/tracking', qp: null },
      { label: 'Contacto',         route: '/contact',  qp: null },
    ]},
    { title: 'Empresa', items: [
      { label: 'Sobre nosotros',         route: '/nosotros', qp: null },
      { label: 'Sucursales',             route: '/contact',  qp: null },
      { label: 'Trabaja con nosotros',   route: '/contact',  qp: null },
      { label: 'Ventas mayoristas',      route: '/ventas',   qp: null },
      { label: 'Newsletter',             route: '/contact',  qp: null },
    ]},
  ];
}
