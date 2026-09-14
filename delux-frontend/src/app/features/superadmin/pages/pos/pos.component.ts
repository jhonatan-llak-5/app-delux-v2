import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { BarcodeScanDirective } from '@shared/directives/barcode-scan.directive';
import { DlxProvinceSelectComponent } from '@shared/ui/province-select.component';
import { DlxPhoneInputComponent } from '@shared/ui/phone-input.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { DlxQtyInputComponent } from '@shared/ui/qty-input.component';
import { AlertComponent } from '@shared/components/alert/alert.component';
import { AuthService } from '@core/services/auth.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { BrandingService } from '@core/services/branding.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { SEARCH_DEBOUNCE_MS } from '@shared/config/search';

import { InventoryService, Stock } from '@features/superadmin/services/inventory.service';
import { OrderService, Order } from '@features/superadmin/services/order.service';
import { AdminService, AdminBranch, AdminUser } from '@features/superadmin/services/admin.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { CustomerService, Customer } from '@features/superadmin/services/customer.service';
import { StoreSettingsService } from '@features/superadmin/services/store-settings.service';
import { CashService, CashSession } from '@features/superadmin/services/cash.service';
import { printVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { parseApiError } from '@shared/utils/api-error.util';
import { imgOrPlaceholder, onImageError } from '@shared/utils/img-placeholder';
import { ViewMode, readViewPref, writeViewPref } from '@shared/utils/view-pref.util';
import { ConfirmService } from '@shared/components/confirm/confirm.service';

/** Sondeo rápido mientras el cajero mira la pantalla de espera (ms). */
const WAIT_POLL_MS = 1000;
/** Sondeo lento una vez mostrado el popup: ahí ya solo falta que el SRI
 *  autorice, y eso nadie lo está esperando de pie (ms). */
const IDLE_POLL_MS = 3000;
/** Tope de la espera del popup. Pasado esto se muestra igual, con o sin código:
 *  el cajero no se queda bloqueado y la factura sigue resolviéndose atrás. */
const MAX_WAIT_MS = 5000;
/** Tope total del sondeo tras la venta. */
const MAX_POLL_MS = 60000;

interface CartItem {
  variant_id: number;
  product_name: string;
  product_image: string;
  sku: string;
  size: string;
  color: string;
  unit_price: number;
  /** null mientras el vendedor deja el contador vacío: bloquea el cobro. */
  quantity: number | null;
  max_stock: number;
}

@Component({
  selector: 'dlx-pos',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxSearchInputComponent, BarcodeScanDirective, CommonModule, FormsModule, RouterLink, DlxProvinceSelectComponent, DlxPhoneInputComponent, DlxPriceInputComponent, DlxQtyInputComponent, AlertComponent],
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
  private cashSvc = inject(CashService);
  /** Turno de caja abierto (si lo hay): las ventas en efectivo se le imputan. */
  cashSession = signal<CashSession | null>(null);
  cashChecked = signal(false);
  cfEnabled = signal(false);   // "Consumidor Final" activado por la tienda
  einvoiceEnabled = signal(false);  // facturación electrónica activa
  wantInvoice = signal(false);      // por venta: ¿generar factura de ESTA venta? (por defecto NO)
  cfMax = signal(50);          // tope $ para facturar como Consumidor Final
  private auth = inject(AuthService);
  branchCtx = inject(BranchContextService);
  private branding = inject(BrandingService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

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
  discount = signal<number | null>(null);
  saving = signal(false);
  confirmOpen = signal(false);
  paidWith: number | null = null;   // efectivo recibido (calculadora de vuelto)
  change(): number { return (Number(this.paidWith) || 0) - this.total(); }
  // ── Forma de pago (contrato SRI con el backend) ──
  paymentForm = signal<'01' | '16' | '19' | '20'>('01');
  aCredito = signal(false);
  plazo = signal(1);
  unidad = signal<'meses' | 'dias'>('meses');
  readonly paymentForms = [
    { v: '01', label: 'Efectivo' },
    { v: '16', label: 'Tarjeta de débito' },
    { v: '19', label: 'Tarjeta de crédito' },
    { v: '20', label: 'Transferencia' },
  ];
  /** "A crédito" solo aplica a Tarjeta de crédito (19); el resto es contado. */
  creditAllowed = computed(() => this.paymentForm() === '19');
  setPaymentForm(v: '01' | '16' | '19' | '20') {
    this.paymentForm.set(v);
    if (v !== '19') this.aCredito.set(false);  // efectivo/débito/transferencia = contado
  }
  error = signal<string | null>(null);
  completedOrder = signal<Order | null>(null);
  /** Pantalla de espera tras cobrar: retiene el popup los segundos en los que
   *  llega el código de la factura, para que el comprobante se imprima con él.
   *  No espera la autorización del SRI (eso tarda): basta el número y la clave,
   *  que el backend guarda apenas NovaFactura responde. */
  invoiceWait = signal(false);
  /** ¿La orden ya trae un código imprimible (N° de factura o clave de acceso)? */
  private hasInvoiceCode(o: Order | null): boolean {
    return !!(o && (o.invoice_number || o.invoice_access_key));
  }
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
    return r === 'SUPERADMIN' || r === 'BRANCH_MANAGER';
  });
  sellersForBranch = computed(() =>
    this.sellers().filter(u => u.id !== this.myId && (!this.branchId() || u.branch_id === this.branchId())));

  private search$ = new Subject<void>();

  taxRate = computed(() => +this.branding.taxRate() || 0);
  /** Suma total (los precios YA incluyen IVA). */
  subtotal = computed(() =>
    this.cart().reduce((sum, i) => sum + i.unit_price * (i.quantity ?? 0), 0)
  );
  /** Base sin IVA (desglose informativo). */
  netSubtotal = computed(() => { const r = this.taxRate(); return r ? this.subtotal() / (1 + r / 100) : this.subtotal(); });
  /** IVA contenido en el subtotal. */
  taxAmount = computed(() => this.subtotal() - this.netSubtotal());
  total = computed(() => Math.max(0, this.subtotal() - (this.discount() ?? 0)));
  /** Precio unitario (ya incluye IVA). */
  unitWithTax(i: CartItem): number { return i.unit_price; }
  /** Total de una línea; una cantidad vacía cuenta como 0. */
  lineTotal(i: CartItem): number { return i.unit_price * (i.quantity ?? 0); }

  /** Líneas con la cantidad vacía, en 0 o por encima del stock: no se cobran. */
  invalidQtyCount = computed(() =>
    this.cart().filter(i => i.quantity == null || i.quantity < 1 || i.quantity > i.max_stock).length
  );
  canCheckout = computed(() =>
    this.cart().length > 0 && !!this.branchId() && this.invalidQtyCount() === 0
  );

  /** Regla SRI: si la facturación está activa y la venta va como Consumidor
   *  Final (sin cédula/RUC), no se puede facturar desde el tope (def. $50).
   *  Se evalúa como método para reaccionar a los cambios del cliente en vivo. */
  cfBlock(): boolean {
    if (!this.einvoiceEnabled() || !this.wantInvoice()) return false;
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
    this.discount.set(null);
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
    this.loadCashSession();
  }

  /** Estado de la caja para el indicador del encabezado. */
  private loadCashSession(): void {
    this.cashSvc.current(this.branchId()).subscribe({
      next: r => { this.cashSession.set(r.session); this.cashChecked.set(true); },
      error: () => { this.cashSession.set(null); this.cashChecked.set(true); },
    });
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

  /** Lector USB (pistola HID): recibe el código y lo procesa como escaneo. */
  onBarcodeScanned(code: string): void {
    const c = (code || '').trim();
    if (!c) return;
    this.scanCode = c;
    this.onScan();
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
      // Si el contador quedó vacío, volver a agregar el producto lo deja en 1.
      const next = (existing.quantity ?? 0) + 1;
      if (next <= s.quantity) {
        const list = this.cart().map(c =>
          c.variant_id === s.variant ? { ...c, quantity: next } : c
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

  /** Cantidad escrita o pulsada en el contador. `null` = campo vacío: se guarda
   *  tal cual para que la línea quede marcada y el cobro bloqueado. */
  setQty(idx: number, qty: number | null) {
    const list = [...this.cart()];
    const item = list[idx];
    if (!item || item.quantity === qty) return;
    list[idx] = { ...item, quantity: qty };
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
          this.discount.set(r.discount ? +r.discount : null);
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
    this.discount.set(null);
    this.couponError.set(null);
  }

  confirmSale() {
    this.confirmOpen.set(false);
    this.checkout();
  }

  checkout() {
    if (!this.branchId() || this.cart().length === 0) return;
    if (this.invalidQtyCount() > 0) {
      this.error.set('Revisa las cantidades del carrito: hay líneas vacías o fuera del stock disponible.');
      return;
    }
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
      items: this.cart().map(i => ({ variant_id: i.variant_id, quantity: i.quantity! })),
      discount: this.discount() ?? 0,
      customer_id: this.customerId() ?? undefined,
      // Se envían siempre los datos: si hay cliente seleccionado, el backend los
      // actualiza (por si el vendedor los editó); si no, crea/reutiliza el cliente.
      customer_data: (this.customerData['full_name'] || this.customerData['email'])
        ? this.customerData : undefined,
      seller_id: this.isManager() ? this.sellerId : undefined,
      payment_form: this.paymentForm(),
      payment_plazo: this.aCredito() ? +this.plazo() : 0,
      payment_unidad: this.unidad(),
      want_invoice: this.einvoiceEnabled() ? this.wantInvoice() : false,
    };
    this.ord.posCheckout(payload).subscribe({
      next: order => {
        this.saving.set(false);
        this.completedOrder.set(order);
        this.playSaleSound();
        // Si la factura está en curso y todavía no tiene código, se muestra la
        // pantalla de espera en vez del popup de venta exitosa.
        const st = order.invoice_status || '';
        this.invoiceWait.set(
          this.einvoiceEnabled() && (st === 'PROCESSING' || st === 'PENDING_SRI')
          && !this.hasInvoiceCode(order),
        );
        this.startInvoicePolling(order);
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


  /** Beep corto y agradable ("ding-ding") al completar una venta. Web Audio,
   *  sin archivos. Ignora errores si el navegador bloquea el audio. */
  private playSaleSound(): void {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      ctx.resume?.();
      const now = ctx.currentTime;
      [880, 1174.66].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t0 = now + i * 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.20);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0); o.stop(t0 + 0.22);
      });
      setTimeout(() => { try { ctx.close(); } catch {} }, 700);
    } catch { /* audio bloqueado: sin sonido */ }
  }

  printVoucher() {
    if (this.completedOrder()) printVoucherPDF(this.completedOrder()!, this.branding.receiptBusiness());
  }

  /** El comprobante siempre se puede imprimir desde el popup: nunca se bloquea
   *  al cajero. Lo que sí avisamos es cuándo saldrá incompleto. */
  missingAccessKey(): boolean {
    const o = this.completedOrder();
    if (!o || !this.einvoiceEnabled()) return false;
    const st = o.invoice_status || '';
    return (st === 'PROCESSING' || st === 'PENDING_SRI') && !o.invoice_access_key;
  }

  /** Sale de la pantalla de espera y muestra el popup de una vez. El sondeo
   *  sigue corriendo: si el código llega después, aparece solo. */
  skipInvoiceWait(): void { this.invoiceWait.set(false); }

  /** Código de la factura para mostrar en el popup: la clave de acceso si ya
   *  llegó, si no el número de factura. */
  invoiceCode(): string {
    const o = this.completedOrder();
    return o?.invoice_access_key || o?.invoice_number || '';
  }

  /** Navega al detalle de la venta (donde también se puede imprimir). */
  goToSaleDetail() {
    const o = this.completedOrder();
    if (!o) return;
    this.stopInvoicePolling();
    this.router.navigate(['/app/admin/sales', o.id]);
  }

  // ── Polling del estado de la factura tras la venta ──
  private pollTimer: any = null;
  private startInvoicePolling(order: Order): void {
    this.stopInvoicePolling();
    // Solo consultamos si la factura está EN CURSO (PROCESSING/PENDING_SRI).
    // Sin facturación, ya autorizada, o venta sin factura: no hace falta.
    const st0 = order.invoice_status || '';
    if (!this.einvoiceEnabled() || (st0 !== 'PROCESSING' && st0 !== 'PENDING_SRI')) return;
    // Cadencia variable: rápido mientras hay alguien esperando la pantalla,
    // lento después. Por eso es setTimeout encadenado y no setInterval.
    let elapsed = 0;
    const DONE = ['AUTHORIZED', 'REJECTED', 'ANNULLED', 'ERROR'];
    const tick = () => {
      const delay = this.invoiceWait() ? WAIT_POLL_MS : IDLE_POLL_MS;
      this.pollTimer = setTimeout(() => {
        elapsed += delay;
        const cur = this.completedOrder();
        if (!cur || cur.id !== order.id) { this.stopInvoicePolling(); return; }
        // Al llegar al tope se suelta la espera aunque no haya código: el
        // comprobante saldrá sin número, pero el cajero sigue atendiendo.
        if (elapsed >= MAX_WAIT_MS) this.invoiceWait.set(false);
        this.ord.get(order.id).subscribe({
          next: o => {
            this.completedOrder.set(o);
            const done = DONE.includes(o.invoice_status || '');
            // En cuanto hay código (o el SRI ya resolvió), se suelta la espera y
            // aparece el popup de venta exitosa con el número a la vista.
            if (this.hasInvoiceCode(o) || done) this.invoiceWait.set(false);
            if (done || elapsed >= MAX_POLL_MS) { this.stopInvoicePolling(); return; }
            tick();
          },
          error: () => {
            if (elapsed >= MAX_POLL_MS) { this.stopInvoicePolling(); return; }
            tick();
          },
        });
      }, delay);
    };
    tick();
  }
  private stopInvoicePolling(): void {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  }
  ngOnDestroy(): void { this.stopInvoicePolling(); }

  newSale() {
    this.stopInvoicePolling();
    this.cart.set([]);
    this.discount.set(null);
    this.paidWith = null;
    this.paymentForm.set('01');
    this.aCredito.set(false);
    this.plazo.set(1);
    this.unidad.set('meses');
    this.completedOrder.set(null);
    this.invoiceWait.set(false);
    // La factura se pide POR VENTA: el check vuelve a apagarse en cada venta
    // nueva. Si quedara encendido, el vendedor facturaría sin querer la compra
    // del siguiente cliente, que casi siempre no la pide.
    this.wantInvoice.set(false);
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
