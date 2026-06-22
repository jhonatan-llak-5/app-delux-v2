import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface LegalContent { title: string; intro: string; sections: { h: string; p: string }[]; }

const CONTENT: Record<string, LegalContent> = {
  terms: {
    title: 'Términos y condiciones',
    intro: 'Al usar Delux aceptas estos términos. Léelos con atención.',
    sections: [
      { h: 'Uso del sitio', p: 'Delux es una tienda de calzado, ropa y accesorios con sucursales en Quito, Guayaquil y Cuenca. Al comprar, declaras que la información proporcionada es veraz.' },
      { h: 'Precios y disponibilidad', p: 'Los precios se muestran en dólares (USD) e incluyen impuestos. La disponibilidad depende del stock de la sucursal de tu ciudad; los productos sin stock local pueden ofrecerse para envío.' },
      { h: 'Pagos', p: 'Los pagos se procesan de forma segura mediante PayPhone. No almacenamos los datos de tu tarjeta.' },
      { h: 'Entregas y retiro', p: 'Puedes elegir envío a domicilio o retiro en la sucursal de tu ciudad. Los tiempos se indican en el checkout.' },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    intro: 'Cuidamos tus datos. Aquí te explicamos qué recopilamos y para qué.',
    sections: [
      { h: 'Datos que recopilamos', p: 'Nombre, correo, teléfono y dirección para procesar tus pedidos y contactarte.' },
      { h: 'Uso de los datos', p: 'Usamos tus datos para gestionar compras, envíos, soporte y —si te suscribes— para enviarte novedades. No los vendemos a terceros.' },
      { h: 'Tus derechos', p: 'Puedes acceder, corregir o eliminar tus datos escribiéndonos desde la página de contacto.' },
    ],
  },
  cookies: {
    title: 'Política de cookies',
    intro: 'Usamos cookies para que el sitio funcione y para recordar tus preferencias.',
    sections: [
      { h: 'Cookies necesarias', p: 'Mantienen tu sesión, tu carrito y la ciudad que seleccionaste.' },
      { h: 'Preferencias', p: 'Recordamos el tema (claro/oscuro) y tus filtros para mejorar tu experiencia.' },
    ],
  },
  about: {
    title: 'Sobre nosotros',
    intro: 'Delux es streetwear y calzado original, cerca de ti.',
    sections: [
      { h: 'Quiénes somos', p: 'Somos una marca ecuatoriana con sucursales en Quito, Guayaquil y Cuenca, dedicada a traer las mejores marcas (Nike, Adidas, Jordan, New Balance y más) con producto 100% original.' },
      { h: 'Nuestra promesa', p: 'Catálogo curado, stock real por ciudad, envío rápido y retiro en tienda. La cultura urbana, a tu alcance.' },
    ],
  },
};

@Component({
  selector: 'dlx-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content(); as c) {
      <section class="max-w-[820px] mx-auto px-6 md:px-10 pt-32 pb-24">
        <p class="text-[12px] tracking-[0.25em] uppercase text-[#0095f6] font-semibold mb-4">Legal</p>
        <h1 class="font-bold text-[36px] md:text-[44px] tracking-[-0.025em] text-ink-950 dark:text-white">{{ c.title }}</h1>
        <p class="text-ink-600 dark:text-white/60 text-[16px] mt-4 leading-relaxed">{{ c.intro }}</p>
        <div class="mt-10 space-y-8">
          @for (s of c.sections; track s.h) {
            <div>
              <h2 class="font-bold text-[18px] text-ink-950 dark:text-white mb-2">{{ s.h }}</h2>
              <p class="text-ink-600 dark:text-white/60 text-[15px] leading-relaxed">{{ s.p }}</p>
            </div>
          }
        </div>
        <p class="text-[13px] text-ink-400 dark:text-white/40 mt-12">
          ¿Dudas? <a routerLink="/contact" class="text-[#0095f6] font-semibold hover:underline">Contáctanos</a>.
        </p>
      </section>
    }
  `,
})
export class LegalPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private key = signal<string>('terms');
  content = computed(() => CONTENT[this.key()] ?? CONTENT['terms']);

  ngOnInit(): void {
    const page = this.route.snapshot.data['page'] as string | undefined;
    if (page && CONTENT[page]) this.key.set(page);
  }
}
