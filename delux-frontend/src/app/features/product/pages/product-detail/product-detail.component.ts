import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
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
import { BrandingService } from '@core/services/branding.service';

interface ColorOption { name: string; hex: string; image: string; }

interface ProductVM {
  id: number; name: string; subtitle: string; brand: string; category: string;
  slug: string; price: number; oldPrice?: number; rating: number; reviewsCount: number;
  tag: string; gallery: string[]; colors: ColorOption[]; sizes: string[]; description: string;
  variants: { id: number; size: string; color: string; stock_by_branch: Record<string, number>; total_stock: number }[];
  branches: { id: number; name: string; province: string; stock: number }[];
  branchNames: Record<string, string>;
  soldOut?: boolean;
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
  colors: [], sizes: [], description: '', variants: [], branches: [], branchNames: {},
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
  branding = inject(BrandingService);
  loading = signal(true);

  /** Producto agotado y la tienda decidió no permitir su compra. */
  buyBlocked = computed(() =>
    this.product().soldOut === true && this.branding.outOfStockDisplay() !== 'SHOW');

  activeImg = signal(0);
  activeColorIdx = signal(0);
  activeSize = signal<string | null>(null);
  /** Sucursal elegida para despachar este producto (multi-sucursal). */
  activeBranchId = signal<number | null>(null);
  sizeError = signal(false);
  zoomed = signal(false);
  zoomOrigin = signal('center');
  inWishlist = computed(() => this.me.wishlistIds().has(this.product().id));
  addedFeedback = signal(false);

  product = signal<ProductVM>(EMPTY_PRODUCT);

  /** Modal de guía de tallas. */
  sizeGuideOpen = signal(false);

  /** Sucursales (de la provincia activa) donde el producto tiene stock. */
  branches = computed(() => this.product().branches || []);
  /** Sucursal seleccionada (o la de mayor stock / primera por defecto). */
  selectedBranch = computed(() => {
    const list = this.branches();
    if (!list.length) return null;
    const id = this.activeBranchId();
    return list.find(b => b.id === id) || list[0];
  });
  /** Se puede agregar al carrito: no bloqueado por agotado y hay sucursal con stock. */
  canAdd = computed(() => !this.buyBlocked() && this.branches().length > 0);

  /** Color activo normalizado (vacío si el producto no maneja colores). */
  private activeColorNorm = computed(() => {
    const colors = this.product().colors;
    if (!colors.length) return '';
    return this.normColor(colors[this.activeColorIdx()]?.name || '');
  });

  /**
   * Tallas del color activo. Se muestran TODAS las que existan para ese color,
   * marcando `inStock` según el stock de la variante en la sucursal elegida.
   */
  sizeOptions = computed<{ size: string; inStock: boolean }[]>(() => {
    const colorNorm = this.activeColorNorm();
    const branchId = this.activeBranchId();
    const bySize = new Map<string, { size: string; inStock: boolean }>();
    for (const v of this.product().variants) {
      if (!this.colorMatches(v.color, colorNorm)) continue;
      const key = (v.size || '').trim();
      if (!key) continue;   // ignora la variante "por defecto" sin talla real
      const stock = branchId != null
        ? (v.stock_by_branch[String(branchId)] || 0)
        : (v.total_stock || 0);
      const inStock = stock > 0;
      const existing = bySize.get(key);
      if (existing) existing.inStock = existing.inStock || inStock;
      else bySize.set(key, { size: v.size, inStock });
    }
    // Ordena siguiendo el orden declarado del producto; extras al final.
    const result: { size: string; inStock: boolean }[] = [];
    const seen = new Set<string>();
    for (const s of this.product().sizes) {
      const key = (s || '').trim();
      const opt = bySize.get(key);
      if (opt) { result.push(opt); seen.add(key); }
    }
    for (const [key, opt] of bySize) if (!seen.has(key)) result.push(opt);
    return result;
  });

  /** El producto tiene tallas reales (al menos una variante con talla no vacía). */
  productHasSizes = computed(() => this.product().variants.some(v => (v.size || '').trim()));

  /** Variante que coincide con talla + color seleccionados. */
  selectedVariant = computed(() => {
    const size = this.activeSize();
    if (!size) return null;
    const colorNorm = this.activeColorNorm();
    return this.product().variants.find(
      v => (v.size || '').trim() === size.trim() && this.colorMatches(v.color, colorNorm)) || null;
  });

  /**
   * Stock por sucursal a mostrar en el selector: refleja la variante
   * seleccionada (talla + color); si aún no hay talla elegida, agrega el
   * stock de todas las variantes del color.
   */
  branchOptions = computed<{ id: number; name: string; stock: number }[]>(() => {
    const colorNorm = this.activeColorNorm();
    const size = this.activeSize();
    const variants = this.product().variants.filter(
      v => this.colorMatches(v.color, colorNorm) && (!size || (v.size || '').trim() === size.trim()));
    return this.branches().map(b => {
      const key = String(b.id);
      let stock = 0;
      for (const v of variants) stock += v.stock_by_branch[key] || 0;
      return { id: b.id, name: this.branchName(b), stock };
    });
  });

  private branchName(b: { id: number; name: string }): string {
    return this.product().branchNames[String(b.id)] || b.name;
  }
  private normColor(c: string): string { return (c || '').trim().toLowerCase(); }
  private colorMatches(variantColor: string, targetNorm: string): boolean {
    return this.normColor(variantColor) === targetNorm;
  }

  selectBranch(id: number) {
    this.activeBranchId.set(id);
    this.syncSelectedSize();
  }

  /** Elige por defecto la sucursal con más stock para el color activo. */
  private pickDefaultBranch() {
    const branches = this.branches();
    if (!branches.length) { this.activeBranchId.set(null); return; }
    const colorNorm = this.activeColorNorm();
    const variants = this.product().variants.filter(v => this.colorMatches(v.color, colorNorm));
    let bestId = branches[0].id;
    let bestStock = -1;
    for (const b of branches) {
      const key = String(b.id);
      let s = 0;
      for (const v of variants) s += v.stock_by_branch[key] || 0;
      if (s > bestStock) { bestStock = s; bestId = b.id; }
    }
    this.activeBranchId.set(bestId);
  }

  /**
   * Re-evalúa la talla seleccionada tras cambiar color/sucursal: si dejó de
   * tener stock, selecciona la primera talla disponible (o ninguna).
   */
  private syncSelectedSize() {
    const opts = this.sizeOptions();
    const cur = this.activeSize();
    if (cur && opts.some(o => (o.size || '').trim() === cur.trim() && o.inStock)) return;
    const firstAvail = opts.find(o => o.inStock);
    this.activeSize.set(firstAvail ? firstAvail.size : null);
    this.sizeError.set(false);
  }

  /** Tipo de guía de tallas a mostrar según la categoría del producto. */
  sizeGuideKind = computed<'shoes' | 'clothing' | 'both'>(() => {
    const cat = (this.product().category || '').toLowerCase();
    const shoeWords = ['calzado', 'zapat', 'sneak', 'tenis', 'bota', 'zapatilla'];
    const clothWords = ['ropa', 'camis', 'polo', 'pantal', 'chaqueta', 'buzo', 'vestido', 'short', 'abrigo', 'sudadera', 'jean', 'hoodie', 'top'];
    const isShoe = shoeWords.some(w => cat.includes(w));
    const isCloth = clothWords.some(w => cat.includes(w));
    if (isShoe && !isCloth) return 'shoes';
    if (isCloth && !isShoe) return 'clothing';
    return 'both';
  });

  openSizeGuide() { this.sizeGuideOpen.set(true); }
  closeSizeGuide() { this.sizeGuideOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.sizeGuideOpen()) this.closeSizeGuide(); }

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
          variants: (d.variants || []).map(v => ({
            id: v.id,
            size: v.size,
            color: v.color || '',
            stock_by_branch: v.stock_by_branch || {},
            total_stock: v.total_stock ?? 0,
          })),
          branches: d.branches || [],
          branchNames: d.branch_names || {},
          soldOut: d.in_stock === false,
        });
        this.activeColorIdx.set(0);
        this.activeImg.set(0);
        // Sucursal por defecto: la de mayor stock para la variante inicial.
        this.pickDefaultBranch();
        // Selecciona la primera talla disponible para el color/sucursal actual.
        this.syncSelectedSize();
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

  /** Tablas de referencia para la guía de tallas (medidas aproximadas). */
  readonly shoeSizeRows = [
    { eu: '36', us: '4', cm: '22.5' },
    { eu: '37', us: '5', cm: '23.5' },
    { eu: '38', us: '6', cm: '24' },
    { eu: '39', us: '6.5', cm: '24.5' },
    { eu: '40', us: '7.5', cm: '25.5' },
    { eu: '41', us: '8', cm: '26' },
    { eu: '42', us: '9', cm: '26.5' },
    { eu: '43', us: '10', cm: '27.5' },
    { eu: '44', us: '10.5', cm: '28' },
    { eu: '45', us: '11.5', cm: '29' },
  ];
  readonly clothingSizeRows = [
    { size: 'XS', chest: '82 - 86', waist: '66 - 70' },
    { size: 'S', chest: '88 - 92', waist: '72 - 76' },
    { size: 'M', chest: '94 - 98', waist: '78 - 82' },
    { size: 'L', chest: '100 - 106', waist: '84 - 90' },
    { size: 'XL', chest: '108 - 114', waist: '92 - 98' },
    { size: 'XXL', chest: '116 - 122', waist: '100 - 106' },
  ];

  readonly features = [
    { icon: 'fa-truck-fast', label: 'Envío 24-72h' },
    { icon: 'fa-rotate-left', label: 'Cambios en 10 días' },
    { icon: 'fa-shield-halved', label: '100% original' },
    { icon: 'fa-store', label: 'Retiro en tienda' },
  ];

  // Solo la descripción real del producto (del backend). Si no tiene, no se
  // muestra el acordeón (no inventamos materiales, envíos ni políticas).
  accordions = computed(() => {
    const desc = (this.product().description || '').trim();
    return desc ? [{ id: 'desc', title: 'Descripción', body: desc }] : [];
  });


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
    // Al cambiar de color cambian las tallas y el stock por sucursal.
    this.pickDefaultBranch();
    this.syncSelectedSize();
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
    if (this.buyBlocked()) {
      this.notify.warning('Producto agotado', { description: 'Este producto no está disponible por ahora.' });
      return;
    }
    const branch = this.selectedBranch();
    if (!branch) {
      this.notify.warning('Sin stock en tu provincia', {
        description: 'Este producto no tiene stock disponible en tu provincia por ahora.',
      });
      return;
    }
    const hasSizes = this.productHasSizes();
    if (hasSizes && !this.activeSize()) {
      this.sizeError.set(true);
      this.notify.warning('Selecciona una talla', {
        description: 'Elige una talla antes de añadir al carrito.',
      });
      return;
    }

    const color = this.activeColor();
    const colorImage = color?.image || this.product().gallery[0];
    const colorName = color?.name || 'default';
    const colorLabel = color?.name || 'Único';
    const size = hasSizes ? this.activeSize()! : '';
    // Busca la variante REAL: por talla+color si hay tallas; si no, la única del color.
    const colorNorm = this.activeColorNorm();
    const match = this.product().variants.find(
      v => (!hasSizes || (v.size || '').trim() === size.trim()) && this.colorMatches(v.color, colorNorm));
    if (!match) {
      this.notify.error('Variante no disponible', {
        description: 'Esa combinación de talla y color no está disponible.',
      });
      return;
    }
    // Stock REAL de esa variante en la sucursal elegida.
    const stock = match.stock_by_branch[String(branch.id)] || 0;
    if (stock <= 0) {
      this.notify.warning('Sin stock en esta sucursal', {
        description: `No hay stock de la talla ${size} en ${this.branchName(branch)}. Prueba otra sucursal o talla.`,
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
      color: colorLabel,
      unit_price: this.product().price,
      max_stock: stock,
      branch_id: branch.id,
      branch_name: this.branchName(branch),
      brand_name: this.product().brand,
    }, 1);

    this.notify.success('Agregado al carrito', {
      description: `${this.product().name} · Talla ${size} · ${colorLabel} · ${this.branchName(branch)}`,
      action: {
        label: 'Ver carrito',
        onClick: () => this.router.navigate(['/cart']),
      },
    });
  }

  toggleWishlistWithToast() {
    if (!this.auth.isLogged()) {
      this.notify.warning('Inicia sesión', { description: 'Crea una cuenta para guardar tus favoritos.' });
      this.router.navigate(['/auth/login']);
      return;
    }
    // Los favoritos son una función de la tienda para clientes: el staff
    // (gerentes, vendedores, admins, afiliados) no puede guardarlos.
    if (this.auth.user()?.role !== 'CUSTOMER') {
      this.notify.warning('Solo para clientes', {
        description: 'Los favoritos están disponibles únicamente para perfiles de clientes.',
      });
      return;
    }
    const wasIn = this.inWishlist();
    this.me.toggleWishlist(this.product().id).subscribe({
      next: () => {
        if (!wasIn) this.notify.success('Añadido a tus favoritos', { description: this.product().name });
        else this.notify.message('Quitado de tus favoritos');
      },
      error: () => this.notify.error('No se pudo actualizar tus favoritos.'),
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
