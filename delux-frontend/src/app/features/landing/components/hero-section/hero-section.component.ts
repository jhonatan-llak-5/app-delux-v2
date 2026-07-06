import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PublicCatalogService } from '@shared/services/public-catalog.service';
import { ZoneService } from '@shared/services/zone.service';

interface HeroProduct {
  id: string; name: string; collection: string; tagline: string; price: number;
  image: string; thumb?: string; haloClass: string; gradient: string; productId?: number;
}
type HeroPhase = 'showcase';

@Component({
  selector: 'dlx-hero-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.component.html',
})
export class HeroSectionComponent implements OnInit, OnDestroy {
  isDark = false;
  private catalog = inject(PublicCatalogService);
  private zone = inject(ZoneService);

  imgError = signal(false);

  constructor() {
    // Reinicia el estado de error de imagen al cambiar de producto.
    effect(() => { this.index(); this.imgError.set(false); });
  }

  private readonly fallbackHero: HeroProduct[] = [
    { id: '01', name: 'Air Force Stealth', collection: 'Performance',
      tagline: 'Energía vibrante y confort premium. Diseñada para máximo rendimiento en cada pisada.',
      price: 200,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-magenta',
      gradient:
        'radial-gradient(60% 80% at 70% 30%, rgba(255,87,168,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 30% 60%, rgba(255,120,73,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(124,58,237,0.4) 0%, transparent 70%),' +
        'radial-gradient(40% 60% at 80% 80%, rgba(34,211,238,0.4) 0%, transparent 70%)' },
    { id: '02', name: 'Court Vintage', collection: 'Lifestyle',
      tagline: 'Un calzado con personalidad que evoca la nostalgia urbana de los noventas reinventada.',
      price: 180,
      image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-violet',
      gradient:
        'radial-gradient(60% 80% at 30% 30%, rgba(124,58,237,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 70% 60%, rgba(224,57,154,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.3) 0%, transparent 70%)' },
    { id: '03', name: 'Pulse Runner', collection: 'Innovation',
      tagline: 'Simplifica tu carrera. Tecnología de respuesta dinámica para máximo retorno de energía.',
      price: 220,
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-accent-500',
      gradient:
        'radial-gradient(60% 80% at 70% 30%, rgba(20,184,166,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 30% 60%, rgba(34,211,238,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(124,58,237,0.3) 0%, transparent 70%)' },
    { id: '04', name: 'Heritage OG', collection: 'Heritage',
      tagline: 'Nacido en el campo deportivo. Adoptado por la cultura urbana mundial.',
      price: 160,
      image: 'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=1200&q=85&auto=format&fit=crop',
      haloClass: 'bg-brand-orange',
      gradient:
        'radial-gradient(60% 80% at 30% 30%, rgba(255,120,73,0.5) 0%, transparent 60%),' +
        'radial-gradient(50% 70% at 70% 60%, rgba(224,57,154,0.4) 0%, transparent 65%),' +
        'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.4) 0%, transparent 70%)' },
  ];

  products = signal<HeroProduct[]>(this.fallbackHero);

  private readonly defaultGradient =
    'radial-gradient(60% 80% at 70% 30%, rgba(224,57,154,0.45) 0%, transparent 60%),' +
    'radial-gradient(50% 70% at 30% 60%, rgba(124,58,237,0.4) 0%, transparent 65%),' +
    'radial-gradient(70% 90% at 50% 100%, rgba(20,184,166,0.35) 0%, transparent 70%),' +
    'radial-gradient(40% 60% at 80% 80%, rgba(255,120,73,0.35) 0%, transparent 70%)';

  phase = signal<HeroPhase>('showcase');
  index = signal(0);
  currentProduct = computed(() => this.products()[this.index()]);
  currentGradient = computed(() => this.currentProduct().gradient);
  paddedIndex = computed(() => String(this.index() + 1).padStart(2, '0'));
  paddedTotal = computed(() => String(this.products().length).padStart(2, '0'));
  progressPercent = computed(() => ((this.index() + 1) / this.products().length) * 100);

  private rotationTimer?: ReturnType<typeof setInterval>;
  private userInteractedSinceShowcase = false;

  ngOnInit(): void {
    this.loadFeatured();
    this.startAutoRotation();
  }

  private loadFeatured(): void {
    const city = this.zone.city() || undefined;
    this.catalog.listProducts({ sort: 'featured', city }).subscribe({
      next: r => {
        const items = (r.results || []).slice(0, 5);
        if (!items.length) return;
        const fb = this.fallbackHero;
        const mapped: HeroProduct[] = items.map((p, i) => ({
          id: String(i + 1).padStart(2, '0'),
          productId: p.id,
          name: p.name,
          collection: p.category_name || p.brand_name,
          tagline: `${p.brand_name} · disponible en tu ciudad. Calidad original Delux.`,
          price: Number(p.base_price),
          image: p.main_image_url || fb[i % fb.length].image,
          thumb: p.thumb_url || p.main_image_url || fb[i % fb.length].image,
          haloClass: fb[i % fb.length].haloClass,
          gradient: fb[i % fb.length].gradient,
        }));
        this.products.set(mapped);
        this.index.set(0);
      },
      error: () => {},
    });
  }
  ngOnDestroy(): void {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  }
  private startAutoRotation() {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    this.rotationTimer = setInterval(() => {
      if (!this.userInteractedSinceShowcase) this.next();
    }, 5500);
  }
  setIndex(i: number) { this.userInteractedSinceShowcase = true; this.index.set(i); }
  next() { this.index.update((i) => (i + 1) % this.products().length); }
  prev() { this.userInteractedSinceShowcase = true; this.index.update((i) => (i - 1 + this.products().length) % this.products().length); }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img.dataset['fallback'] === '1') return;
    img.dataset['fallback'] = '1';
    const name = (img.alt || 'Producto').replace(/[<>&]/g, '');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">'
      + '<rect width="300" height="300" fill="none"/>'
      + '<text x="150" y="150" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700"'
      + ' fill="#ffffff" fill-opacity="0.85" text-anchor="middle" dominant-baseline="middle">' + name + '</text>'
      + '</svg>';
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
}
