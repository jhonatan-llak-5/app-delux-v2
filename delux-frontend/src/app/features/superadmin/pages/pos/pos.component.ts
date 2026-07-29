import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { DlxProvinceSelectComponent } from '@shared/ui/province-select.component';
import { DlxPhoneInputComponent } from '@shared/ui/phone-input.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { AlertComponent } from '@shared/components/alert/alert.component';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { BrandingService } from '@core/services/branding.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '@shared/config/search';

import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { OrderService, Order } from '@features/superadmin/services/order.service';
import { AdminService, AdminBranch, AdminUser } from '@features/superadmin/services/admin.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { CustomerService, Customer } from '@features/superadmin/services/customer.service';
import { StoreSettingsService } from '@features/superadmin/services/store-settings.service';
import { generateVoucherPDF, printVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { parseApiError } from '@shared/utils/api-error.util';
import { imgOrPlaceholder, onImageError } from '@shared/utils/img-placeholder';
import { ViewMode, readViewPref, writeViewPref } from '@shared/utils/view-pref.util';
import { ConfirmService } from '@shared/components/confirm/confirm.service';

interface CartItem {
  variant_id: number;
  product_name: string;
  product_image: string;
  sku: string;
  size: string;
  color: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
}

@Component({
  selector: 'dlx-pos',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxSearchInputComponent, CommonModule, FormsModule, RouterLink, DlxProvinceSelectComponent, DlxPhoneInputComponent, DlxPriceInputComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit, OnDestroy {
  private inv = inject(InventoryService);
  private ord = inject(OrderService);
  private adminSvc = inject(AdminService);
  private couponSvc = inject(CouponService);
  private catSvc = inject(CategoryService);
  private custSvc = inject(CustomerService);
  private storeSet = inject(StoreSettingsService);
  cfEnabled = signal(false);   // "Consumidor Final" activado por la tienda
  einvoiceEnabled = signal(false);  // facturación electrónica activa
  cfMax = signal(50);          // tope $ para facturar como Consumidor Final
  private auth = inject(AuthService);
  branchCtx = inject(BranchContextService);
  private branding = inject(BrandingService);
  private confirm = inject(ConfirmService);

  couponInput = '';
  appliedCoupon = signal<CouponValidation | null>(null);
  validatingCoupon = signal(false);
  couponError = signal<string | null>(null);

  branchId = signal<number | null>(null);
  stocks = signal<Stock[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal(false);
  search = signal('');
  searched = signal(false);      // ¿ya se ejecutó una búsqueda?
  categories = signal<Category[]>([]);
  categoryFilter = signal<number | null>(null);
  view = signal<ViewMode>(readViewPref('dlx_pos_view', this.auth.user()?.id));
  scanCode = '';
  scanMsg = signal<{ ok: boolean; text: string } | null>(null);
  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private camStream?: MediaStream;
  private detector: any = null;
  private rafId: any = null;
  private lastScan = '';
  private lastScanAt = 0;
  discount = signal(0);
  saving = signal(false);
  confirmOpen = signal(false);
  paidWith: number | null = null;   // efectivo recibido (calculadora de vuelto)
  change(): number { return (Number(this.paidWith) || 0) - this.total(); }
  error = signal<string | null>(null);
  completedOrder = signal<Order | null>(null);
  customerData: Record<string, string> = {
    full_name: '', email: '', phone: '', document_id: '',
    document_type: '05', business_name: '', address: '', province: '',
  };
  customerId = signal<number | null>(null);   // cliente frecuente seleccionado
  custQuery = '';
  custResults = signal<Customer[]>([]);
  custOpen = signal(false);
  showCustForm = signal(false);
  private cust$ = new Subject<string>();

  // Vendedor de la venta (solo gerente/admin puede elegir; el vendedor queda a su nombre).
  sellers = signal<AdminUser[]>([]);
  sellerId: number | null = this.auth.user()?.id ?? null;
  myId = this.auth.user()?.id ?? null;
  myName = this.auth.user()?.full_name || this.auth.user()?.username || 'Yo';
  isManager = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  });
  sellersForBranch = computed(() =>
    this.sellers().filter(u => u.id !== this.myId && (!this.branchId() || u.branch_id === this.branchId())));

  private search$ = new Subject<void>();

  taxRate = computed(() => +this.branding.taxRate() || 0);
  /** Suma total (los precios YA incluyen IVA). */
  subtotal = computed(() =>
    this.cart().reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  );
  /** Base sin IVA (desglose informativo). */
  netSubtotal = computed(() => { const r = this.taxRate(); return r ? this.subtotal() / (1 + r / 100) : this.subtotal(); });
  /** IVA contenido en el subtotal. */
  taxAmount = computed(() => this.subtotal() - this.netSubtotal());
  total = computed(() => Math.max(0, this.subtotal() - this.discount()));
  /** Precio unitario (ya incluye IVA). */
  unitWithTax(i: CartItem): number { return i.unit_price; }
  canCheckout = computed(() => this.cart().length > 0 && !!this.branchId());

  /** Regla SRI: si la facturación está activa y la venta va como Consumidor
   *  Final (sin cédula/RUC), no se puede facturar desde el tope (def. $50).
   *  Se evalúa como método para reaccionar a los cambios del cliente en vivo. */
  cfBlock(): boolean {
    if (!this.einvoiceEnabled()) return false;
    const doc = (this.customerData?.['document_id'] || '').trim();
    const isCF = !doc || doc === '9999999999999';
    return isCF && this.total() >= this.cfMax();
  }

  constructor() {
    // Restaura el carrito y los datos del cliente guardados (por cuenta).
    this.cart.set(this.readCart());
    this.customerData = this.readCustomer();
    // Persiste el carrito ante cualquier cambio.
    effect(() => this.saveCart(this.cart()));
    // Sigue el selector global de sucursal del header.
    effect(() => {
      const id = this.branchCtx.current();
      this.branchId.set(id);
      // untracked: clearSearch()->reload() lee search()/categoryFilter(); sin esto el
      // effect dependería de ellos y borraría la búsqueda en cada tecla.
      untracked(() => this.clearSearch());
      // Al cambiar de sucursal, apaga la cámara si estaba encendida. Leemos
      // cameraOn() con untracked para NO volver dependiente el efecto de la
      // cámara (si no, al encenderla el efecto se re-ejecutaba y la apagaba).
      untracked(() => { if (this.cameraOn()) this.stopCamera(); });
    }, { allowSignalWrites: true });
  }

  private cartKey() { return `dlx_pos_cart::${this.auth.user()?.id ?? 'anon'}`; }
  private readCart(): CartItem[] {
    try { const v = localStorage.getItem(this.cartKey()); return v ? JSON.parse(v) : []; }
    catch { return []; }
  }
  private saveCart(c: CartItem[]) {
    try {
      if (c.length) localStorage.setItem(this.cartKey(), JSON.stringify(c));
      else localStorage.removeItem(this.cartKey());
    } catch { /* almacenamiento no disponible */ }
  }

  // --- Datos del cliente: también persisten por cuenta ---
  private customerKey() { return `dlx_pos_customer::${this.auth.user()?.id ?? 'anon'}`; }
  private blankCustomer(): Record<string, string> {
    return { full_name: '', email: '', phone: '', document_id: '', document_type: '05', business_name: '', address: '', province: '' };
  }
  private readCustomer() {
    const empty = this.blankCustomer();
    try { const v = localStorage.getItem(this.customerKey()); return v ? { ...empty, ...JSON.parse(v) } : empty; }
    catch { return empty; }
  }
  // ── Cliente frecuente ──
  onCustQuery(v: string) { this.custQuery = v; this.custOpen.set(true); this.cust$.next(v); }
  private searchCustomers(term: string) {
    const q = (term || '').trim();
    if (!q) { this.custResults.set([]); return; }
    this.custSvc.list({ search: q, page_size: 8 }).subscribe({
      next: r => this.custResults.set(r.results || []),
      error: () => this.custResults.set([]),
    });
  }
  pickCustomer(c: Customer) {
    this.customerId.set(c.id);
    this.customerData = {
      full_name: c.full_name || '', email: c.email || '', phone: c.phone || '',
      document_id: c.document_id || '', document_type: c.document_type || 'CEDULA',
      business_name: c.business_name || '', address: c.address || '', province: c.province || '',
    };
    this.custQuery = c.full_name;
    this.custOpen.set(false);
    this.showCustForm.set(false);
    this.persistCustomer();
  }
  clearCustomer() {
    this.customerId.set(null);
    this.customerData = this.blankCustomer();
    this.custQuery = '';
    this.custResults.set([]);
    this.custOpen.set(false);
    this.showCustForm.set(false);
    this.persistCustomer();
  }
  newCustomer() { this.clearCustomer(); this.showCustForm.set(true); }
  /** Guarda los datos del cliente en cada cambio (o los borra si están vacíos). */
  persistCustomer() {
    const c = this.customerData;
    const hasData = !!(c['full_name'] || c['email'] || c['phone'] || c['document_id']);
    try {
      if (hasData) localStorage.setItem(this.customerKey(), JSON.stringify(c));
      else localStorage.removeItem(this.customerKey());
    } catch { /* almacenamiento no disponible */ }
  }

  /** Vacía el carrito (con confirmación) y limpia los datos del cliente para una nueva venta. */
  async clearCart() {
    const n = this.cart().length;
    const ok = await this.confirm.ask({
      title: 'Vaciar carrito',
      message: n > 0
        ? `¿Quitar ${n} ${n === 1 ? 'producto' : 'productos'} y reiniciar los datos del cliente para una nueva venta?`
        : '¿Reiniciar los datos del cliente para una nueva venta?',
      variant: 'danger', confirmText: 'Vaciar carrito', cancelText: 'Cancelar',
    });
    if (!ok) return;
    this.cart.set([]);
    this.discount.set(0);
    this.appliedCoupon.set(null);
    this.couponError.set(null);
    this.customerData = this.blankCustomer();
    this.customerId.set(null);
    this.custQuery = '';
    this.custResults.set([]);
    this.showCustForm.set(false);
    this.persistCustomer();
  }

  ngOnInit() {
    this.search$.pipe(debounceTime(SEARCH_DEBOUNCE_MS)).subscribe(() => this.reload());
    this.cust$.pipe(debounceTime(SEARCH_DEBOUNCE_MS)).subscribe(v => this.searchCustomers(v));
    this.catSvc.list().subscribe(r => this.categories.set(r.results || []));
    this.storeSet.getStoreOptions().subscribe({ next: o => {
      this.cfEnabled.set(!!o.consumidor_final_enabled);
      this.einvoiceEnabled.set(!!o.einvoice_enabled);
      this.cfMax.set(Number(o.einvoice_consumidor_final_max) || 50);
    }, error: () => {} });
    if (this.isManager()) {
      this.adminSvc.listUsers({ role: 'SALESPERSON' }).subscribe(r => this.sellers.set(r.results || []));
    }
  }

  reload() {
    const term = this.search().trim();
    const cat = this.categoryFilter();
    // Corre si hay término de búsqueda O una categoría seleccionada.
    if (!this.branchId() || (!term && !cat)) {
      this.stocks.set([]);
      this.searched.set(false);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.searched.set(true);
    this.inv.stocks({
      branch: this.branchId()!,
      search: term || undefined,
      category: cat || undefined,
    }).subscribe({
      next: r => { this.stocks.set((r.results || []).filter(s => s.quantity > 0)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(v: string) {
    this.search.set(v);
    this.search$.next();
  }

  /** Cambio de categoría: filtra de inmediato (sin debounce). */
  onCategory(id: number | null) {
    this.categoryFilter.set(id);
    this.reload();
  }

  clearSearch() { this.search.set(''); this.reload(); }

  setView(v: ViewMode) {
    this.view.set(v);
    writeViewPref('dlx_pos_view', this.auth.user()?.id, v);
  }

  /** Escáner de código de barras: busca coincidencia exacta y la agrega al carrito. */
  onScan() {
    const code = this.scanCode.trim();
    if (!code || !this.branchId()) return;
    this.inv.stocks({ branch: this.branchId()!, search: code }).subscribe({
      next: r => {
        const list = (r.results || []).filter(s => s.quantity > 0);
        const lc = code.toLowerCase();
        const exact = list.find(s =>
          (s.barcode || '').toLowerCase() === lc || (s.variant_sku || '').toLowerCase() === lc);
        const hit = exact || (list.length === 1 ? list[0] : null);
        if (hit) {
          this.addToCart(hit);
          this.scanMsg.set({ ok: true, text: hit.product_name });
        } else {
          this.scanMsg.set({ ok: false, text: `Sin resultados para "${code}"` });
        }
        this.scanCode = '';
        setTimeout(() => this.scanMsg.set(null), 2600);
      },
      error: () => {
        this.scanMsg.set({ ok: false, text: 'Error al escanear' });
        this.scanCode = '';
        setTimeout(() => this.scanMsg.set(null), 2600);
      },
    });
  }

  private priceOf(s: Stock): number {
    return +(s.price_override || s.base_price || '0');
  }
  priceWithTax(s: Stock): number { return this.priceOf(s); }

  addToCart(s: Stock) {
    const existing = this.cart().find(c => c.variant_id === s.variant);
    if (existing) {
      if (existing.quantity < s.quantity) {
        const list = this.cart().map(c =>
          c.variant_id === s.variant ? { ...c, quantity: c.quantity + 1 } : c
        );
        this.cart.set(list);
      }
      return;
    }
    this.cart.update(list => [...list, {
      variant_id: s.variant,
      product_name: s.product_name,
      product_image: s.product_main_image,
      sku: s.variant_sku,
      size: s.variant_size,
      color: s.variant_color,
      unit_price: this.priceOf(s),
      quantity: 1,
      max_stock: s.quantity,
    }]);
  }

  changeQty(idx: number, delta: number) {
    const list = [...this.cart()];
    const item = list[idx];
    const next = item.quantity + delta;
    if (next < 1) return;
    if (next > item.max_stock) return;
    list[idx] = { ...item, quantity: next };
    this.cart.set(list);
  }

  removeItem(idx: number) {
    const list = [...this.cart()];
    list.splice(idx, 1);
    this.cart.set(list);
  }

  applyCoupon() {
    if (!this.couponInput) return;
    this.validatingCoupon.set(true);
    this.couponError.set(null);
    this.couponSvc.validate(this.couponInput.trim().toUpperCase(), this.subtotal()).subscribe({
      next: r => {
        this.validatingCoupon.set(false);
        if (r.valid) {
          this.appliedCoupon.set(r);
          this.discount.set(+(r.discount || 0));
          this.couponInput = '';
        } else {
          this.couponError.set(r.detail || 'Cupón inválido');
        }
      },
      error: e => {
        this.validatingCoupon.set(false);
        this.couponError.set(parseApiError(e).message || 'Cupón no válido');
      },
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.discount.set(0);
    this.couponError.set(null);
  }

  confirmSale() {
    this.confirmOpen.set(false);
    this.checkout();
  }

  checkout() {
    if (!this.canCheckout() || !this.branchId()) return;
    if (this.cfBlock()) {
      this.error.set(
        `Las ventas de $${this.cfMax().toFixed(2)} o más no pueden facturarse como ` +
        `Consumidor Final. Selecciona o crea un cliente con cédula o RUC para continuar.`,
      );
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const payload = {
      branch_id: this.branchId()!,
      items: this.cart().map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
      discount: this.discount(),
      customer_id: this.customerId() ?? undefined,
      // Se envían siempre los datos: si hay cliente seleccionado, el backend los
      // actualiza (por si el vendedor los editó); si no, crea/reutiliza el cliente.
      customer_data: (this.customerData['full_name'] || this.customerData['email'])
        ? this.customerData : undefined,
      seller_id: this.isManager() ? this.sellerId : undefined,
    };
    this.ord.posCheckout(payload).subscribe({
      next: order => {
        this.saving.set(false);
        this.completedOrder.set(order);
      },
      error: e => {
        this.saving.set(false);
        const parsed = parseApiError(e);
        const fieldMsg = Object.values(parsed.fieldErrors)[0];
        const detail = parsed.message || fieldMsg
          || (e?.error?.items ? JSON.stringify(e.error.items) : null)
          || 'Error al procesar venta';
        this.error.set(detail);
      },
    });
  }

  // ---- Escáner con cámara (BarcodeDetector) ----
  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta cámara para escanear. Usa una pistola o el buscador.');
      this.cameraOn.set(true);
      return;
    }
    try {
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara (requiere HTTPS y permiso).');
      this.cameraOn.set(true);
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.camVideo?.nativeElement;
      if (v && this.camStream) { v.srcObject = this.camStream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.camVideo?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) this.onCameraCode(codes[0].rawValue || '');
    } catch { /* frame sin código */ }
    if (this.cameraOn()) this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    this.camError.set(null);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.camStream?.getTracks().forEach(t => t.stop());
    this.camStream = undefined;
  }

  private onCameraCode(raw: string): void {
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (!code) return;
    const now = Date.now();
    if (code === this.lastScan && now - this.lastScanAt < 2500) return;
    this.lastScan = code; this.lastScanAt = now;
    this.scanCode = code;
    this.onScan();
  }

  ngOnDestroy(): void { this.stopCamera(); }

  printVoucher() {
    if (this.completedOrder()) printVoucherPDF(this.completedOrder()!);
  }

  newSale() {
    this.cart.set([]);
    this.discount.set(0);
    this.paidWith = null;
    this.completedOrder.set(null);
    this.customerData = this.blankCustomer();
    this.customerId.set(null);
    this.custQuery = '';
    this.custResults.set([]);
    this.showCustForm.set(false);
    this.persistCustomer();
    this.appliedCoupon.set(null);
    this.reload();
  }

  imgSrc(url?: string | null): string { return imgOrPlaceholder(url); }
}
