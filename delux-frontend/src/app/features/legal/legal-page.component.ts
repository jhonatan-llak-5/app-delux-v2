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
      { h: 'Entregas y retiro', p: 'Puedes elegir envío a domicilio o retiro en la sucursal de tu ciudad. Los tiempos se indican en el checkout. En el envío a domicilio debes proporcionar una dirección válida y estar disponible para recibir el pedido.' },
      { h: 'Devoluciones y cambios', p: 'Aceptamos cambios y devoluciones de productos en buen estado, con su empaque original y dentro del plazo indicado en la sección de devoluciones de tu cuenta. Algunos artículos pueden estar excluidos por higiene.' },
      { h: 'Cuenta del cliente', p: 'Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad de tu cuenta. Notifícanos cualquier uso no autorizado.' },
      { h: 'Propiedad intelectual', p: 'Las marcas, logos, imágenes y contenidos del sitio pertenecen a Delux o a sus respectivos titulares. No está permitido su uso sin autorización.' },
      { h: 'Cambios a los términos', p: 'Podemos actualizar estos términos cuando sea necesario. La versión vigente es la publicada en esta página.' },
      { h: 'Contacto', p: 'Para cualquier duda sobre estos términos, escríbenos desde la página de contacto.' },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    intro: 'Cuidamos tus datos. Aquí te explicamos qué recopilamos y para qué.',
    sections: [
      { h: 'Datos que recopilamos', p: 'Nombre, correo, teléfono y dirección para procesar tus pedidos y contactarte.' },
      { h: 'Uso de los datos', p: 'Usamos tus datos para gestionar compras, envíos, soporte y —si te suscribes— para enviarte novedades. No los vendemos a terceros.' },
      { h: 'Tus derechos', p: 'Puedes acceder, corregir o eliminar tus datos, así como retirar tu consentimiento, escribiéndonos desde la página de contacto.' },
      { h: 'Seguridad', p: 'Aplicamos medidas técnicas y organizativas razonables para proteger tu información. Los pagos se procesan por canales seguros y no almacenamos los datos de tu tarjeta.' },
      { h: 'Conservación', p: 'Conservamos tus datos el tiempo necesario para cumplir con los fines descritos y con las obligaciones legales aplicables.' },
      { h: 'Menores de edad', p: 'El registro está dirigido a personas mayores de edad. Si eres menor, usa el sitio con la supervisión de un adulto responsable.' },
      { h: 'Cookies', p: 'Usamos cookies necesarias y de preferencia. Revisa nuestra Política de cookies para más detalle.' },
      { h: 'Contacto', p: 'Si tienes preguntas sobre el tratamiento de tus datos, contáctanos desde la página de contacto.' },
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
