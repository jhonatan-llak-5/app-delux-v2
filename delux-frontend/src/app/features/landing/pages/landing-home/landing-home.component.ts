import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { IMG_PLACEHOLDER } from '@shared/utils/img-placeholder';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';
import { PublicCatalogService, PublicProduct } from '@shared/services/public-catalog.service';
import { PublicBranchesService } from '@shared/services/public-branches.service';
import { ZoneService } from '@shared/services/zone.service';
import { BrandingService } from '@core/services/branding.service';

interface DropCard {
  id: number; name: string; brand: string; price: string; tag: string; image: string;
}

interface BranchCard {
  code: string; name: string; city: string; address: string;
  hours: string; products: number;
}


const FALLBACK_BRANCHES: BranchCard[] = [
  { code: 'CENTRO', name: 'Delux Centro', city: 'Quito', address: 'Av. Amazonas N24-03 y Colón',
    hours: 'Lun-Sáb · 10:00 a 20:00', products: 0 },
  { code: 'GYE', name: 'Delux Mall del Sol', city: 'Guayaquil', address: 'C.C. Mall del Sol, Local 128',
    hours: 'Lun-Dom · 10:00 a 22:00', products: 0 },
  { code: 'CUENCA', name: 'Delux Cuenca', city: 'Cuenca', address: 'Av. Solano 5-23',
    hours: 'Lun-Sáb · 10:00 a 19:00', products: 0 },
];

/**
 * Landing — Diseño consistente con auth (Instagram-like clean).
 * Secciones: Hero + Categorías + Drops + Sucursales + Beneficios + CTA
 */
@Component({
  selector: 'dlx-landing-home',
  standalone: true,
  imports: [ImgFallbackDirective, CommonModule, RouterLink, HeroSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-home.component.html',
})
export class LandingHomeComponent implements OnInit {
  private catalog = inject(PublicCatalogService);
  private branchSvc = inject(PublicBranchesService);
  private zone = inject(ZoneService);
  branding = inject(BrandingService);

  constructor() {
    // Recarga los drops cuando el cliente cambia de ciudad.
    effect(() => { const c = this.zone.city(); this.loadDrops(c); });
  }

  drops = signal<DropCard[]>([]);
  loadingDrops = signal(true);

  // Sucursales: arranca con un fallback y se reemplaza con las registradas en superadmin.
  branches = signal<BranchCard[]>(FALLBACK_BRANCHES);

  ngOnInit(): void {
    this.loadBranches();
  }

  /** Comision de ejemplo sobre una venta de $120 (para la tarjeta ilustrativa). */
  exampleCommission(): string {
    const rate = +this.branding.affiliateCommissionRate() || 0;
    return '$' + (120 * rate / 100).toFixed(2);
  }

  private loadDrops(city: string | null): void {
    this.loadingDrops.set(true);
    this.catalog.listProducts({ sort: 'featured', city: city || undefined }).subscribe({
      next: r => {
        this.drops.set((r.results || []).slice(0, 4).map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand_name,
          price: p.base_price,
          tag: this.tagLabel(p.tag),
          image: p.thumb_url || p.main_image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85',
        })));
        this.loadingDrops.set(false);
      },
      error: () => this.loadingDrops.set(false),
    });
  }

  private tagLabel(t: string): string {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as any)[t] || 'Drop';
  }


  openMap(br: BranchCard): void {
    const q = encodeURIComponent(`Delux ${br.name}, ${br.address}, ${br.city}, Ecuador`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  private loadBranches(): void {
    this.branchSvc.list().subscribe({
      next: r => {
        const items = (r.results || []).map(b => ({
          code: b.code,
          name: b.name,
          city: b.city,
          address: b.address,
          hours: b.opening_hours || 'Lun-Sab - 10:00 a 20:00',
          products: b.products_count,
        }));
        if (items.length) this.branches.set(items);
      },
      error: () => {},
    });
  }

  readonly categories = [
    {
      slug: 'zapatillas',
      title: 'Zapatillas',
      description: 'Nike, Adidas, Jordan, New Balance y más. Drops semanales.',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=85&auto=format&fit=crop',
    },
    {
      slug: 'ropa',
      title: 'Ropa',
      description: 'Hoodies, camisetas, pantalones y outerwear con carácter urbano.',
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=85&auto=format&fit=crop',
    },
    {
      slug: 'accesorios',
      title: 'Accesorios',
      description: 'Mochilas, gorras y complementos para completar tu fit.',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=85&auto=format&fit=crop',
    },
  ];

  readonly benefits = [
    { icon: 'fa-bolt', title: 'Envío 24h', description: 'Recibe tu pedido al día siguiente en Quito y Guayaquil. Gratis sobre $50.' },
    { icon: 'fa-shield-halved', title: 'Pago 100% seguro', description: 'Procesado con PayPhone. Aceptamos todas las tarjetas y cuotas sin intereses.' },
    { icon: 'fa-rotate-left', title: 'Cambios sin estrés', description: 'Tienes 14 días para cambios y devoluciones. Sin preguntas, sin letra chica.' },
  ];

}
