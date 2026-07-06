import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DlxEmptyStateComponent } from '@shared/ui/empty-state.component';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { RefService } from '@core/services/ref.service';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import * as L from 'leaflet';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '@features/checkout/services/cart.service';
import { CheckoutService } from '@features/checkout/services/checkout.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { PublicBranchesService, PublicBranch } from '@shared/services/public-branches.service';
import { ZoneService } from '@shared/services/zone.service';
import { BrandingService } from '@core/services/branding.service';
import { CouponService, CouponValidation } from '@features/superadmin/services/coupon.service';
import { AuthService } from '@core/services/auth.service';
import { MeService } from '@features/account/services/me.service';

@Component({
  selector: 'dlx-checkout-page',
  standalone: true,
  imports: [DlxEmptyStateComponent, ImgFallbackDirective, DlxFieldErrorComponent, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-page.component.html',
})
export class CheckoutPageComponent implements OnInit, AfterViewInit {
  cart = inject(CartService);
  private checkout = inject(CheckoutService);
  private notify = inject(NotifyService);
  private branchSvc = inject(PublicBranchesService);
  zone = inject(ZoneService);
  branding = inject(BrandingService);
  private couponSvc = inject(CouponService);
  private router = inject(Router);
  private ref = inject(RefService);
  private auth = inject(AuthService);
  private me = inject(MeService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // El paso 2 (sucursales) reacciona a la ciudad de la zona: si cambia
    // (chip del navbar o ubicación del mapa), recarga las sucursales.
    effect(() => {
      const city = this.zone.city() || undefined;
      this.loadBranches(city);
    });
  }

  private loadBranches(city?: string) {
    this.branchSvc.list(city).subscribe(r => {
      const list = r.results || [];
      this.branches.set(list);
      this.branchId = list.length ? list[0].id : null;
      this.cdr.markForCheck();
    });
  }

  branches = signal<PublicBranch[]>([]);
  branchId: number | null = null;
  fulfillment: 'SHIPPING' | 'PICKUP' = 'SHIPPING';
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  paymentMethod = signal<'PAYPHONE' | 'COD' | 'TRANSFER' | 'DEUNA'>('COD');
  voucherFile = signal<File | null>(null);
  voucherName = signal<string>('');
  shippingAddress = '';
  shipLat = signal<number | null>(null);
  shipLng = signal<number | null>(null);
  locating = signal(false);
  private map: any = null;
  private marker: any = null;
  private mapResizeObs: any = null;

  customer = { full_name: '', email: '', phone: '', document_id: '' };
  // El email se bloquea si es un cliente con sesion (el pedido va a su perfil).
  emailLocked = () => this.auth.role() === 'CUSTOMER';
  /** La sucursal de envío seleccionada ofrece envío a domicilio gratis. */
  freeShipping(): boolean {
    if (this.fulfillment !== 'SHIPPING') return false;
    const b = this.branches().find(x => x.id === this.branchId);
    return !!b?.free_shipping;
  }
  freeShippingLabel(): string {
    const b = this.branches().find(x => x.id === this.branchId);
    return (b?.free_shipping_label || '').trim() || 'Envío a domicilio gratis';
  }

  couponInput = '';
  appliedCoupon = signal<CouponValidation | null>(null);
  validating = signal(false);
  couponError = signal<string | null>(null);
  discount = signal(0);

  total = computed(() => Math.max(0, this.cart.subtotal() - this.discount()));

  /** Método (no computed): se reevalúa en cada ciclo de detección,
   *  así reacciona a los campos de cliente/sucursal que no son signals. */
  canPay(): boolean {
    const needsVoucher = this.paymentMethod() === 'TRANSFER' || this.paymentMethod() === 'DEUNA';
    return this.cart.lines().length > 0 && this.branchId !== null &&
      !!this.customer.full_name.trim() && !!this.customer.email.trim() &&
      !!this.customer.phone.trim() &&
      (this.fulfillment !== 'SHIPPING' || !!this.shippingAddress.trim()) &&
      (!needsVoucher || !!this.voucherFile());
  }

  onVoucherSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) { this.voucherFile.set(null); this.voucherName.set(''); return; }
    this.voucherFile.set(file);
    this.voucherName.set(file.name);
  }

  copy(text: string) {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      this.notify.success('Número de cuenta copiado.');
    } catch { /* clipboard no disponible */ }
  }

  ngAfterViewInit() {
    if (this.fulfillment === 'SHIPPING') this.onShippingSelected();
  }

  onShippingSelected() {
    setTimeout(() => this.initShipMap(), 150);
  }

  private ensureLeafletCss() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('leaflet-css-cdn')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  private initShipMap(retry = 0) {
    if (typeof document === 'undefined') return;
    this.ensureLeafletCss();
    const el = document.getElementById('dlx-ship-map') as HTMLElement | null;
    if (!el) { if (retry < 20) setTimeout(() => this.initShipMap(retry + 1), 120); return; }
    if (this.map) { this.map.invalidateSize(); return; }
    // No crear el mapa hasta que el contenedor tenga altura real (evita el mapa
    // gris cuando el bloque aún no está dimensionado en el primer render).
    if (!el.clientHeight && retry < 20) { setTimeout(() => this.initShipMap(retry + 1), 120); return; }
    const center: [number, number] = [this.shipLat() ?? -0.1807, this.shipLng() ?? -78.4678];
    this.map = L.map(el, { center, zoom: 13, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: 'OpenStreetMap contributors',
    }).addTo(this.map);
    const icon = L.divIcon({
      html: '<i class="fa-solid fa-location-dot" style="color:#dc2626;font-size:30px"></i>',
      className: '', iconSize: [30, 30], iconAnchor: [15, 30],
    });
    this.marker = L.marker(center, { draggable: true, icon }).addTo(this.map);
    this.marker.on('dragend', () => {
      const p = this.marker.getLatLng();
      this.setCoords(p.lat, p.lng);
    });
    this.map.on('click', (e: any) => {
      this.marker.setLatLng(e.latlng);
      this.setCoords(e.latlng.lat, e.latlng.lng);
    });
    // Recalcula el tamaño en cuanto el contenedor está listo / cambia de tamaño
    // (evita el mapa "a medias" cuando se renderiza dentro de un bloque que recién aparece).
    const refresh = () => this.map && this.map.invalidateSize();
    requestAnimationFrame(refresh);
    setTimeout(refresh, 250);
    setTimeout(refresh, 700);
    if (typeof ResizeObserver !== 'undefined') {
      this.mapResizeObs = new ResizeObserver(() => refresh());
      this.mapResizeObs.observe(el);
    }
  }

  private setCoords(lat: number, lng: number) {
    this.shipLat.set(lat);
    this.shipLng.set(lng);
    this.reverseGeocode(lat, lng);
  }

  private async reverseGeocode(lat: number, lng: number) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept': 'application/json' } });
      const j = await r.json();
      if (j && j.display_name) { this.shippingAddress = j.display_name; }
      if (j && j.address) { this.applyDetectedCity(j.address); }
      this.cdr.markForCheck();
    } catch { /* sin conexión a Nominatim: el usuario escribe manual */ }
  }

  /** Si la ubicación cae en una ciudad con sucursales, cambia la zona/sucursal. */
  private applyDetectedCity(nAddr: any) {
    const cands = [nAddr.city, nAddr.town, nAddr.village, nAddr.county,
                   nAddr.state_district, nAddr.state].filter(Boolean);
    const cities = this.zone.cities().map(c => c.city);
    for (const cn of cands) {
      const match = cities.find(c => c.toLowerCase() === String(cn).toLowerCase());
      if (match) {
        if (this.zone.city() !== match) {
          this.zone.setCity(match);  // el effect recarga las sucursales del paso 2
        }
        return;
      }
    }
  }

  useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.notify.warning('Geolocalización no disponible en este dispositivo.');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.locating.set(false);
        const { latitude, longitude } = pos.coords;
        this.initShipMap();
        if (this.map) { this.map.setView([latitude, longitude], 16); this.marker?.setLatLng([latitude, longitude]); }
        this.setCoords(latitude, longitude);
      },
      () => { this.locating.set(false); this.notify.warning('No pudimos obtener tu ubicación. Ubícala en el mapa.'); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  private shippingPayload() {
    return this.fulfillment === 'SHIPPING'
      ? { address: this.shippingAddress, latitude: this.shipLat(), longitude: this.shipLng() }
      : undefined;
  }

  ngOnInit() {
    // Método por defecto: contra entrega (PayPhone está oculto por ahora).
    this.paymentMethod.set('COD');
    // Carga las ciudades/sucursales de la zona; el effect cargará el paso 2.
    this.zone.load(false);
    // Autocompletar los datos de contacto con el perfil del usuario logueado
    // (solo campos vacíos, para no pisar lo que el usuario ya escribió).
    if (this.auth.isLogged()) {
      this.me.profile().subscribe({
        next: p => {
          this.customer.full_name = this.customer.full_name || p.full_name || '';
          this.customer.email = this.customer.email || p.email || '';
          this.customer.phone = this.customer.phone || p.phone || '';
          this.customer.document_id = this.customer.document_id || p.document_id || '';
          this.cdr.markForCheck();
        },
        error: () => {},
      });
    }
  }

  applyCoupon() {
    if (!this.couponInput) return;
    this.validating.set(true);
    this.couponError.set(null);
    this.couponSvc.validate(this.couponInput.trim().toUpperCase(), this.cart.subtotal()).subscribe({
      next: r => {
        this.validating.set(false);
        if (r.valid) {
          this.appliedCoupon.set(r);
          this.discount.set(+(r.discount || 0));
          this.couponInput = '';
        } else {
          this.couponError.set(r.detail || 'Cupón inválido');
        }
      },
      error: e => {
        this.validating.set(false);
        this.couponError.set(e?.error?.detail || 'Cupón no válido');
      },
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.discount.set(0);
  }

  payNow() {
    if (!this.canPay() || !this.branchId) return;
    const m = this.paymentMethod();
    if (m === 'COD') { this.placeCOD(); return; }
    if (m === 'TRANSFER' || m === 'DEUNA') { this.placeTransfer(m); return; }
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    const returnUrl = `${window.location.origin}/checkout/result`;
    this.checkout.initPayPhone({
      branch_id: this.branchId,
      fulfillment: this.fulfillment,
      customer_data: this.customer,
      items: this.cart.lines().map(l => ({ variant_id: l.variant_id, quantity: l.quantity })),
      discount: this.discount(),
      coupon_code: this.appliedCoupon()?.code,
      affiliate_ref: this.ref.currentRef() || undefined,
      return_url: returnUrl,
      shipping_address: this.shippingPayload(),
    }).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.error) {
          this.error.set(r.error);
          this.notify.error(r.error);
          return;
        }
        // Guardar referencia para confirmación tras volver
        sessionStorage.setItem('dlx_pending_payment', JSON.stringify({
          payment_id: r.payment_id,
          order_code: r.order_code,
          order_total: r.order_total,
        }));
        if (r.payment_url) {
          if (r.payment_url.startsWith('/')) {
            this.router.navigateByUrl(r.payment_url);
          } else {
            window.location.href = r.payment_url;
          }
        }
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        const msg = p.message || 'Error al iniciar el pago.';
        if (!Object.keys(p.fieldErrors).length) { this.error.set(msg); this.notify.error(msg); }
      },
    });
  }

  private placeCOD() {
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.checkout.placeCOD({
      branch_id: this.branchId!,
      fulfillment: this.fulfillment,
      customer_data: this.customer,
      items: this.cart.lines().map(l => ({ variant_id: l.variant_id, quantity: l.quantity })),
      discount: this.discount(),
      coupon_code: this.appliedCoupon()?.code,
      affiliate_ref: this.ref.currentRef() || undefined,
      shipping_address: this.shippingPayload(),
    }).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.error) { this.error.set(r.error); this.notify.error(r.error); return; }
        this.notify.success('¡Pedido registrado!');
        this.router.navigate(['/checkout/result'], {
          queryParams: { success: 'true', code: r.order_code, cod: 'true', track: r.tracking_code || '' },
        });
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        const msg = p.message || 'No se pudo registrar el pedido.';
        if (!Object.keys(p.fieldErrors).length) { this.error.set(msg); this.notify.error(msg); }
      },
    });
  }

  private placeTransfer(method: 'TRANSFER' | 'DEUNA') {
    const voucher = this.voucherFile();
    if (!voucher) {
      this.notify.warning('Debes subir el comprobante de pago.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    this.checkout.placeTransfer({
      method,
      branch_id: this.branchId!,
      fulfillment: this.fulfillment,
      customer_data: this.customer,
      items: this.cart.lines().map(l => ({ variant_id: l.variant_id, quantity: l.quantity })),
      discount: this.discount(),
      coupon_code: this.appliedCoupon()?.code,
      affiliate_ref: this.ref.currentRef() || undefined,
      shipping_address: this.shippingPayload(),
    }, voucher).subscribe({
      next: r => {
        this.saving.set(false);
        if (r.error) { this.error.set(r.error); this.notify.error(r.error); return; }
        this.notify.success('¡Pedido registrado! Validaremos tu comprobante.');
        this.router.navigate(['/checkout/result'], {
          queryParams: { success: 'true', code: r.order_code, pending: 'true' },
        });
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        const msg = p.message || 'No se pudo registrar el pedido.';
        if (!Object.keys(p.fieldErrors).length) { this.error.set(msg); this.notify.error(msg); }
      },
    });
  }

}
