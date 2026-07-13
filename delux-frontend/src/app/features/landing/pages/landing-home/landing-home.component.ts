import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { RevealOnScrollDirective } from '@shared/directives/reveal-on-scroll.directive';
import { CountUpDirective } from '@shared/directives/count-up.directive';
import { PublicBranchesService } from '@shared/services/public-branches.service';
import { PublicCatalogService, PublicProduct } from '@shared/services/public-catalog.service';
import { BrandingService } from '@core/services/branding.service';

type Section = 'inicio' | 'nosotros' | 'ventas';

interface BranchCard { name: string; city: string; address: string; hours: string; }

const FALLBACK_BRANCHES: BranchCard[] = [
  { name: 'DLUX Quito',     city: 'Quito',     address: 'Av. Amazonas N24-03 y Colón',   hours: 'Lun-Sáb · 10:00 a 20:00' },
  { name: 'DLUX Guayaquil', city: 'Guayaquil', address: 'C.C. Mall del Sol, Local 128',   hours: 'Lun-Dom · 10:00 a 22:00' },
  { name: 'DLUX Cuenca',    city: 'Cuenca',    address: 'Av. Solano 5-23',                hours: 'Lun-Sáb · 10:00 a 19:00' },
];

/**
 * Landing corporativa DLUX — páginas separadas por URL:
 * /(inicio) · /nosotros · /ventas · /informacion. Diseño moderno índigo,
 * layouts variados (no solo tarjetas), galería social y mapa embebido.
 * Imágenes: URLs gratuitas (placeholder) hasta reemplazarlas por las reales.
 */
@Component({
  selector: 'dlx-landing-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ImgFallbackDirective, RevealOnScrollDirective, CountUpDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-home.component.html',
})
export class LandingHomeComponent implements OnInit {
  private branchSvc = inject(PublicBranchesService);
  private catalog = inject(PublicCatalogService);
  private route = inject(ActivatedRoute);
  private san = inject(DomSanitizer);
  branding = inject(BrandingService);

  section = signal<Section>('inicio');

  constructor() {
    const s = this.route.snapshot.data['section'] as Section | undefined;
    if (s) this.section.set(s);
  }

  branches = signal<BranchCard[]>(FALLBACK_BRANCHES);

  // Zapato flotante del hero: usa un producto real de la tienda; si no hay,
  // cae a una imagen DLUX (PNG transparente, ideal para flotar).
  heroShoe = signal<string>('assets/images/catalog/deux_blue.png');
  featured = signal<PublicProduct[]>([]);

  // ── Mapa: coordenadas de la SUCURSAL PRINCIPAL (cámbialas por las reales) ──
  readonly mapLat = -0.180653;   // <-- reemplazar latitud
  readonly mapLng = -78.467834;  // <-- reemplazar longitud
  readonly mapUrl: SafeResourceUrl = this.san.bypassSecurityTrustResourceUrl(
    `https://www.google.com/maps?q=${this.mapLat},${this.mapLng}&z=16&hl=es&output=embed`);

  // Imágenes gratuitas (Unsplash) — reemplazar por fotos reales de DLUX.
  readonly img = {
    hero:   'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1400&q=80',
    about:  'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1000&q=80',
    sales:  'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1000&q=80',
  };

  // Galería de la zona de ayuda social (varias fotos).
  readonly socialGallery = [
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
  ];

  // ── Inicio: cifras clave ──
  readonly stats = [
    { num: '+10',   label: 'Años de trayectoria' },
    { num: '+50k',  label: 'Pares vendidos' },
    { num: '3',     label: 'Sucursales en Ecuador' },
    { num: '+15k',  label: 'Clientes felices' },
  ];

  // ── Colecciones DLUX (priorizamos la marca propia) ──
  readonly colecciones = ['DLUX Urban', 'DLUX Sport', 'DLUX Classic', 'DLUX Premium', 'DLUX Kids'];

  // ── Quiénes somos: valores ──
  readonly valores = [
    { icon: 'fa-gem',                title: 'Calidad premium',    desc: 'Materiales premium en cada par.' },
    { icon: 'fa-certificate',        title: 'Autenticidad',       desc: '100% original, sin réplicas.' },
    { icon: 'fa-heart',              title: 'Cercanía',           desc: 'Atención cercana y personalizada.' },
    { icon: 'fa-hand-holding-heart', title: 'Compromiso social',  desc: 'Apoyamos a nuestra comunidad.' },
  ];

  // ── Ventas: galería de espacios de la empresa (reemplazar por fotos reales) ──
  readonly espacios = [
    { title: 'Nuestra tienda',     img: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Zona de ropa',       img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=80' },
    { title: 'Sala de calzado',    img: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=800&q=80' },
    { title: 'Bodega y despacho',  img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' },
    { title: 'Detalle de producto', img: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&q=80' },
  ];

  // ── Ventas: a quién vendemos ──
  readonly segmentos = [
    { icon: 'fa-user',                title: 'Cliente final',           desc: 'Compra online o en tienda, con envíos a todo el país y atención directa.' },
    { icon: 'fa-boxes-stacked',       title: 'Mayoristas y empresas',   desc: 'Precios especiales por volumen para revendedores, tiendas y negocios.' },
    { icon: 'fa-hand-holding-dollar', title: 'Afiliados',               desc: 'Gana comisiones promocionando DLUX con tu código de referido.' },
    { icon: 'fa-building',            title: 'Instituciones y equipos', desc: 'Pedidos corporativos, uniformes y calzado por lote para tu organización.' },
  ];

  // ── Ventas: por qué DLUX ──
  readonly razones = [
    { icon: 'fa-shield-halved', title: 'Original garantizado',  desc: 'Cada producto es auténtico y verificado.' },
    { icon: 'fa-truck-fast',    title: 'Envíos a todo Ecuador', desc: 'Recíbelo en casa, rápido y seguro.' },
    { icon: 'fa-credit-card',   title: 'Pagos flexibles',       desc: 'Transferencia, DE UNA y pago contra entrega.' },
    { icon: 'fa-rotate-left',   title: 'Cambios sencillos',     desc: 'Cambios y devoluciones sin complicaciones.' },
  ];

  // ── Información general: servicios ──
  readonly servicios = [
    { icon: 'fa-truck-fast',      title: 'Envíos nacionales',  desc: 'Despachamos a todo el Ecuador. Envío gratis en compras seleccionadas.' },
    { icon: 'fa-money-bill-wave', title: 'Métodos de pago',    desc: 'Transferencia bancaria, DE UNA y pago contra entrega.' },
    { icon: 'fa-rotate-left',     title: 'Garantía y cambios', desc: 'Política clara de cambios y devoluciones para tu tranquilidad.' },
    { icon: 'fa-headset',         title: 'Soporte cercano',    desc: 'Te acompañamos por WhatsApp y correo en cada paso.' },
  ];

  // ── Información general: preguntas frecuentes ──
  readonly faqs = [
    { q: '¿Hacen envíos a todo el país?', a: 'Sí, despachamos a todo el Ecuador. En Quito y Guayaquil el envío suele ser al día siguiente.' },
    { q: '¿Qué métodos de pago aceptan?', a: 'Transferencia bancaria, DE UNA y pago contra entrega. Recibes tus datos de pago al confirmar el pedido.' },
    { q: '¿Puedo cambiar mi talla?',      a: 'Sí. Contáctanos y te guiamos con el cambio según nuestra política.' },
    { q: '¿Tienen tienda física?',        a: 'Sí, estamos presentes en Quito, Guayaquil y Cuenca. Puedes retirar en sucursal.' },
  ];

  // ── Testimonios / reseñas ──
  readonly testimonios = [
    { name: 'María Fernanda', role: 'Cliente frecuente · Quito', stars: 5,
      text: 'Los zapatos llegaron rapidísimo y son 100% originales. La atención por WhatsApp fue de otro nivel.',
      avatar: 'https://i.pravatar.cc/120?img=47' },
    { name: 'Andrés Cobos', role: 'Revendedor · Guayaquil', stars: 5,
      text: 'Trabajo con DLUX al por mayor hace un año. Cumplen con los tiempos y la calidad es constante.',
      avatar: 'https://i.pravatar.cc/120?img=12' },
    { name: 'Gabriela León', role: 'Afiliada', stars: 5,
      text: 'Me uní como afiliada y ya genero ingresos extra cada mes. El sistema de comisiones es súper claro.',
      avatar: 'https://i.pravatar.cc/120?img=32' },
  ];

  // ── Sellos de garantía / confianza ──
  readonly sellos = [
    { icon: 'fa-certificate',    title: 'Producto original',  sub: '100% auténtico, sin réplicas' },
    { icon: 'fa-lock',           title: 'Pago seguro',        sub: 'Tus datos siempre protegidos' },
    { icon: 'fa-shield-halved',  title: 'Compra protegida',   sub: 'Respaldo en cada pedido' },
    { icon: 'fa-rotate-left',    title: 'Garantía de cambios', sub: 'Cambios y devoluciones fáciles' },
  ];

  // ── Nuestro equipo ──
  readonly equipo = [
    { name: 'Pablo Andrade',    role: 'Fundador & CEO',        photo: 'https://i.pravatar.cc/300?img=68' },
    { name: 'María José Vera',  role: 'Gerente comercial',     photo: 'https://i.pravatar.cc/300?img=45' },
    { name: 'Carlos Muñoz',     role: 'Jefe de operaciones',   photo: 'https://i.pravatar.cc/300?img=59' },
    { name: 'Daniela Torres',   role: 'Atención al cliente',   photo: 'https://i.pravatar.cc/300?img=31' },
  ];

  // ── Trayectoria / hitos ──
  readonly hitos = [
    { year: '2014', title: 'Nace la marca',          desc: 'Abrimos con una idea: calzado original y accesible para el Ecuador.' },
    { year: '2017', title: 'Primera tienda física',  desc: 'Llegamos a Quito con una experiencia de compra cercana.' },
    { year: '2020', title: 'Tienda en línea',        desc: 'Lanzamos nuestra plataforma para vender a todo el país.' },
    { year: '2023', title: 'DLUX con causa',         desc: 'Formalizamos nuestro programa de ayuda social a la comunidad.' },
  ];

  ngOnInit(): void {
    this.loadBranches();
    this.loadHeroShoe();
  }

  private loadHeroShoe(): void {
    this.catalog.listProducts({ sort: 'featured', page_size: 8 }).subscribe({
      next: r => {
        const list = r.results || [];
        this.featured.set(list.slice(0, 5));
        const url = list[0]?.thumb_url || list[0]?.main_image_url;
        if (url) this.heroShoe.set(url);
      },
      error: () => {},
    });
  }

  private loadBranches(): void {
    this.branchSvc.list().subscribe({
      next: r => {
        const items = (r.results || []).map(b => ({
          name: b.name, city: b.city, address: b.address,
          hours: b.opening_hours || 'Lun-Sáb · 10:00 a 20:00',
        }));
        if (items.length) this.branches.set(items);
      },
      error: () => {},
    });
  }
}
