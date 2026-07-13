import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ProductReviewsComponent } from '@shared/components/product-reviews/product-reviews.component';
import { MeService } from '@features/account/services/me.service';
import { AuthService } from '@core/services/auth.service';
import { RefService } from '@core/services/ref.service';
import { CartService } from '@features/checkout/services/cart.service';
import { NotifyService } from '@shared/services/notify.service';
import { PublicCatalogService } from '@shared/services/public-catalog.service';

interface ColorOption { name: string; hex: string; image: string; }

interface ProductVM {
  id: number; name: string; subtitle: string; brand: string; category: string;
  slug: string; price: number; oldPrice?: number; rating: number; reviewsCount: number;
  tag: string; gallery: string[]; colors: ColorOption[]; sizes: string[]; description: string;
  variants: { id: number; size: string; color: string }[];
}

const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
  + '<g fill="none" stroke="#9aa0ab" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">'
  + '<rect x="32" y="44" width="56" height="40" rx="6"/><circle cx="60" cy="64" r="11"/>'
  + '<path d="M44 44l5-9h22l5 9"/></g></svg>');

const EMPTY_PRODUCT: ProductVM = {
  id: 0, name: '', subtitle: '', brand: '', category: '', slug: '',
  price: 0, oldPrice: undefined, rating: 0, reviewsCount: 0, tag: '',
  gallery: [IMG_PLACEHOLDER],
  colors: [], sizes: [], description: '', variants: [],
};

@Component({
  selector: 'dlx-product-detail',
  standalone: true,
  imports: [ImgFallbackDirective, CommonModule, RouterLink, ProductReviewsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  Math = Math;
  private cart = inject(CartService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private catalog = inject(PublicCatalogService);
  private me = inject(MeService);
  private auth = inject(AuthService);
  private ref = inject(RefService);
  loading = signal(true);

  activeImg = signal(0);
  activeColorIdx = signal(0);
  activeSize = signal<string | null>(null);
  sizeError = signal(false);
  zoomed = signal(false);
  zoomOrigin = signal('center');
  inWishlist = computed(() => this.me.wishlistIds().has(this.product().id));
  addedFeedback = signal(false);

  product = signal<ProductVM>(EMPTY_PRODUCT);

  ngOnInit(): void {
    if (this.auth.isLogged()) this.me.wishlist().subscribe({ error: () => {} });
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.catalog.getProduct(id).subscribe({
      next: d => {
        this.product.set({
          id: d.id,
          name: d.name,
          subtitle: d.short_description || `${d.category_name} · ${this.genderLabel(d.gender)}`,
          brand: d.brand_name,
          category: d.category_name,
          slug: d.slug,
          price: Number(d.base_price),
          oldPrice: d.compare_at_price ? Number(d.compare_at_price) : undefined,
          rating: d.rating || 0,
          reviewsCount: d.reviews_count || 0,
          tag: this.tagLabel(d.tag),
          gallery: d.images?.length ? d.images : EMPTY_PRODUCT.gallery,
          colors: d.colors || [],
          sizes: d.sizes || [],
          description: d.description || '',
          variants: d.variants || [],
        });
        this.activeColorIdx.set(0);
        this.activeImg.set(0);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('No se pudo cargar el producto.'); },
    });
  }

  private genderLabel(g: string): string {
    return ({ MEN: 'Hombre', WOMEN: 'Mujer', KIDS: 'Niños', UNISEX: 'Unisex' } as any)[g] || 'Unisex';
  }
  private tagLabel(t: string): string {
    return ({ NEW: 'Nuevo', DROP: 'Drop', SALE: 'Oferta', EXCLUSIVE: 'Exclusivo' } as any)[t] || '';
  }

  // Galería activa según color (en este demo es la misma, pero soporta variantes)
  activeGallery = computed(() => this.product().gallery);
  activeColor = computed(() => this.product().colors[this.activeColorIdx()]);
  discount = computed(() => {
    const p = this.product();
    if (!p.oldPrice) return 0;
    return Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
  });

  readonly features = [
    { icon: 'fa-truck-fast', label: 'Envío 24-72h' },
    { icon: 'fa-rotate-left', label: 'Cambios en 14 días' },
    { icon: 'fa-shield-halved', label: '100% original' },
    { icon: 'fa-store', label: 'Retiro en tienda' },
  ];

  accordions = computed(() => [
    { id: 'desc', title: 'Descripción',
      body: this.product().description
            || `${this.product().name} de ${this.product().brand}. Producto original disponible en Delux.` },
    { id: 'mat', title: 'Materiales y cuidado',
      body: 'Capellada de cuero genuino curtido al cromo. Suela exterior de caucho con patrón de pivot. Plantilla acolchada con espuma de memoria. Limpia con paño húmedo, evita la lavadora.' },
    { id: 'env', title: 'Envío y devoluciones',
      body: 'Envío gratis a todo el país en pedidos sobre $50. Recibe en 24-72 horas en Quito y Guayaquil. Cambios sin costo durante los primeros 14 días, sin preguntas.' },
  ]);


  isDarkColor(hex: string): boolean {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return true;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // luminancia relativa
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
  }

  selectColor(i: number) {
    this.activeColorIdx.set(i);
    this.activeImg.set(0);
  }

  selectSize(s: string) {
    this.activeSize.set(s);
    this.sizeError.set(false);
  }

  toggleWishlist() {
    this.me.toggleWishlist(this.product().id).subscribe({ error: () => {} });
  }

  isAffiliate(): boolean {
    const u = this.auth.user();
    return u?.role === 'AFFILIATE' && !!u?.ref_code;
  }
  affiliateLink(): string {
    const code = this.auth.user()?.ref_code || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/product/${this.product().id}?ref=${code}`;
  }
  copyAffiliateLink(): void {
    const url = this.affiliateLink();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => this.notify.success('Enlace copiado')).catch(() => {});
    }
  }
  shareUrl(net: 'whatsapp' | 'facebook' | 'telegram' | 'x'): string {
    const url = encodeURIComponent(this.affiliateLink());
    const text = encodeURIComponent(`Mira este producto: ${this.product().name}`);
    switch (net) {
      case 'whatsapp': return `https://wa.me/?text=${text}%20${url}`;
      case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case 'telegram': return `https://t.me/share/url?url=${url}&text=${text}`;
      case 'x':        return `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    }
  }

  addToCart() {
    if (!this.activeSize()) {
      this.sizeError.set(true);
      this.notify.warning('Selecciona una talla', {
        description: 'Elige una talla antes de añadir al carrito.',
      });
      return;
    }

    const color = this.activeColor();
    const colorImage = color?.image || this.product().gallery[0];
    const colorName = color?.name || 'default';
    const size = this.activeSize()!;
    // Busca la variante REAL que coincide con talla + color y usa su id de BD.
    const match = this.product().variants.find(
      v => v.size === size && (v.color || '') === (colorName === 'default' ? '' : colorName));
    if (!match) {
      this.notify.error('Variante no disponible', {
        description: 'Esa combinación de talla y color no está disponible.',
      });
      return;
    }

    this.cart.add({
      variant_id: match.id,
      product_id: this.product().id,
      product_name: this.product().name,
      product_image: colorImage,
      product_slug: this.product().slug,
      sku: `${this.product().id}-${colorName.toLowerCase().replace(/\s+/g, '-')}-${size}`,
      size,
      color: color.name,
      unit_price: this.product().price,
      max_stock: 99,
      brand_name: this.product().brand,
    }, 1);

    this.notify.success('Agregado al carrito', {
      description: `${this.product().name} · Talla ${size} · ${color.name}`,
      action: {
        label: 'Ver carrito',
        onClick: () => this.router.navigate(['/cart']),
      },
    });
  }

  toggleWishlistWithToast() {
    if (!this.auth.isLogged()) {
      this.notify.warning('Inicia sesión', { description: 'Crea una cuenta para guardar favoritos.' });
      this.router.navigate(['/auth/login']);
      return;
    }
    const wasIn = this.inWishlist();
    this.me.toggleWishlist(this.product().id).subscribe({
      next: () => {
        if (!wasIn) this.notify.success('Añadido a tu wishlist', { description: this.product().name });
        else this.notify.message('Eliminado de tu wishlist');
      },
      error: () => this.notify.error('No se pudo actualizar tu wishlist.'),
    });
  }

  prevImg() {
    const len = this.activeGallery().length;
    this.activeImg.update(i => (i - 1 + len) % len);
  }
  nextImg() {
    const len = this.activeGallery().length;
    this.activeImg.update(i => (i + 1) % len);
  }
  onMouseMove(ev: MouseEvent) {
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    this.zoomOrigin.set(`${x}% ${y}%`);
  }
}
