import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
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

@Component({
  selector: 'dlx-checkout-page',
  standalone: true,
  imports: [DlxFieldErrorComponent, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1400px] mx-auto px-6 md:px-10 pt-32 pb-24 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Checkout</p>
      <h1 class="display-xl text-4xl md:text-6xl mt-4 mb-12 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Finalizar compra
      </h1>

      @if (cart.lines().length === 0) {
        <div class="text-center py-16">
          <p class="text-ink-700 dark:text-white/70 mb-4">Tu carrito está vacío.</p>
          <a routerLink="/shop" class="btn-outline">Ver catálogo</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          <form (ngSubmit)="payNow()" #f="ngForm" class="space-y-6">
            <!-- 1. Cliente -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">1</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Información de contacto</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Nombre completo *</label>
                  <input [(ngModel)]="customer.full_name" name="full_name" required maxlength="160"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                  <dlx-field-error [error]="fe(\'full_name\')" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Email *</label>
                  <input [(ngModel)]="customer.email" name="email" type="email" required
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                  <dlx-field-error [error]="fe(\'email\')" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Teléfono *</label>
                  <input [(ngModel)]="customer.phone" name="phone" required maxlength="30"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white" />
                  <dlx-field-error [error]="fe(\'phone\')" />
                </div>
                <div>
                  <label class="text-sm font-semibold text-ink-800 dark:text-white/80 mb-1.5 block">Cédula</label>
                  <input [(ngModel)]="customer.document_id" name="document_id" maxlength="30"
                         class="w-full px-3 py-3 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm focus:outline-none focus:border-ink-950 dark:focus:border-white font-mono" />
                </div>
              </div>
            </div>

            <!-- 2. Sucursal -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">2</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Sucursal de despacho</h2>
              </div>
              <p class="text-sm text-ink-700 dark:text-white/70 mb-4">El stock se reserva en la sucursal seleccionada.</p>

              <!-- Tipo de entrega -->
              <div class="grid grid-cols-2 gap-3 mb-4">
                <button type="button" (click)="fulfillment = 'SHIPPING'; onShippingSelected()"
                        class="p-3 rounded-xl border-2 text-left transition flex items-center gap-3"
                        [class.border-accent-500]="fulfillment === 'SHIPPING'"
                        [class.bg-accent-50]="fulfillment === 'SHIPPING'"
                        [class.dark:bg-white/10]="fulfillment === 'SHIPPING'"
                        [class.border-ink-200]="fulfillment !== 'SHIPPING'"
                        [class.dark:border-white/10]="fulfillment !== 'SHIPPING'">
                  <i class="fa-solid fa-truck text-accent-600"></i>
                  <span>
                    <span class="block font-semibold text-ink-950 dark:text-white text-sm">Envío a domicilio</span>
                    <span class="block text-xs text-ink-600 dark:text-white/55">Te lo llevamos</span>
                  </span>
                </button>
                <button type="button" (click)="fulfillment = 'PICKUP'"
                        class="p-3 rounded-xl border-2 text-left transition flex items-center gap-3"
                        [class.border-accent-500]="fulfillment === 'PICKUP'"
                        [class.bg-accent-50]="fulfillment === 'PICKUP'"
                        [class.dark:bg-white/10]="fulfillment === 'PICKUP'"
                        [class.border-ink-200]="fulfillment !== 'PICKUP'"
                        [class.dark:border-white/10]="fulfillment !== 'PICKUP'">
                  <i class="fa-solid fa-store text-accent-600"></i>
                  <span>
                    <span class="block font-semibold text-ink-950 dark:text-white text-sm">Retiro en tienda</span>
                    <span class="block text-xs text-ink-600 dark:text-white/55">Sin costo de envío</span>
                  </span>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                @for (b of branches(); track b.id) {
                  <button type="button" (click)="branchId = b.id"
                          class="p-4 rounded-xl border-2 text-left transition"
                          [class.border-accent-500]="branchId === b.id"
                          [class.bg-accent-50]="branchId === b.id"
                          [class.dark:bg-white/10]="branchId === b.id"
                          [class.border-ink-200]="branchId !== b.id"
                          [class.dark:border-white/10]="branchId !== b.id">
                    <p class="font-mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-white/50">{{ b.code }}</p>
                    <p class="font-semibold text-ink-950 dark:text-white mt-0.5">{{ b.name }}</p>
                    <p class="text-xs text-ink-700 dark:text-white/60 mt-0.5">{{ b.city }}</p>
                  </button>
                }
              </div>

              @if (fulfillment === 'SHIPPING') {
                <div class="mt-5 pt-5 border-t border-ink-200 dark:border-white/10">
                  <label class="block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-white/50 mb-2">
                    Dirección de entrega *
                  </label>
                  <div class="flex gap-2 mb-3">
                    <input [(ngModel)]="shippingAddress" name="ship_addr"
                           placeholder="Calle, número, referencia..."
                           class="flex-1 px-3 py-2.5 rounded-xl bg-ink-50 dark:bg-white/5
                                  border border-ink-200 dark:border-white/10 text-sm
                                  text-ink-950 dark:text-white focus:outline-none" />
                    <button type="button" (click)="useMyLocation()" [disabled]="locating()"
                            class="px-3 py-2.5 rounded-xl bg-ink-950 dark:bg-white text-white dark:text-ink-950
                                   text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 shrink-0">
                      @if (locating()) { <i class="fa-solid fa-spinner fa-spin"></i> }
                      @else { <i class="fa-solid fa-location-crosshairs"></i> }
                      Mi ubicación
                    </button>
                  </div>
                  <div id="dlx-ship-map"
                       class="w-full h-56 rounded-xl overflow-hidden border border-ink-200 dark:border-white/10
                              bg-ink-100 dark:bg-white/5"></div>
                  <p class="text-[11px] text-ink-500 dark:text-white/50 mt-2">
                    <i class="fa-solid fa-circle-info"></i>
                    Toca el mapa o arrastra el pin para ubicar tu dirección exacta.
                  </p>
                </div>
              }
            </div>

            <!-- 3. Pago -->
            <div class="editorial-card p-6">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-7 h-7 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 grid place-items-center font-bold text-sm">3</span>
                <h2 class="font-display font-bold text-xl text-ink-950 dark:text-white">Método de pago</h2>
              </div>

              <div class="space-y-3">
                <!-- Contra entrega -->
                <button type="button" (click)="paymentMethod.set('COD')"
                        class="w-full text-left p-5 rounded-xl border-2 transition flex items-center gap-3"
                        [class.border-emerald-400]="paymentMethod()==='COD'"
                        [class.bg-emerald-50]="paymentMethod()==='COD'"
                        [class.dark:bg-emerald-500/10]="paymentMethod()==='COD'"
                        [class.border-ink-200]="paymentMethod()!=='COD'"
                        [class.dark:border-white/10]="paymentMethod()!=='COD'">
                  <div class="w-12 h-12 rounded-lg bg-emerald-600 text-white grid place-items-center shrink-0">
                    <i class="fa-solid fa-hand-holding-dollar text-xl"></i>
                  </div>
                  <div class="flex-1">
                    <p class="font-bold text-ink-950 dark:text-white">Pago contra entrega</p>
                    <p class="text-xs text-ink-700 dark:text-white/70">Paga en efectivo al recibir tu pedido</p>
                  </div>
                  <i class="fa-solid text-xl"
                     [class.fa-circle-check]="paymentMethod()==='COD'" [class.text-emerald-600]="paymentMethod()==='COD'"
                     [class.fa-circle]="paymentMethod()!=='COD'" [class.text-ink-300]="paymentMethod()!=='COD'"></i>
                </button>

                <!-- PayPhone (bloqueado si no hay claves configuradas) -->
                @if (branding.payphoneAvailable()) {
                  <button type="button" (click)="paymentMethod.set('PAYPHONE')"
                          class="w-full text-left p-5 rounded-xl border-2 transition flex items-center gap-3"
                          [class.border-violet-400]="paymentMethod()==='PAYPHONE'"
                          [class.bg-violet-50]="paymentMethod()==='PAYPHONE'"
                          [class.dark:bg-violet-500/10]="paymentMethod()==='PAYPHONE'"
                          [class.border-ink-200]="paymentMethod()!=='PAYPHONE'"
                          [class.dark:border-white/10]="paymentMethod()!=='PAYPHONE'">
                    <div class="w-12 h-12 rounded-lg bg-violet-600 text-white grid place-items-center shrink-0">
                      <i class="fa-solid fa-mobile-screen text-xl"></i>
                    </div>
                    <div class="flex-1">
                      <p class="font-bold text-ink-950 dark:text-white">PayPhone</p>
                      <p class="text-xs text-ink-700 dark:text-white/70">Tarjeta de crédito, débito o PayPhone wallet</p>
                    </div>
                    <i class="fa-solid text-xl"
                       [class.fa-circle-check]="paymentMethod()==='PAYPHONE'" [class.text-violet-600]="paymentMethod()==='PAYPHONE'"
                       [class.fa-circle]="paymentMethod()!=='PAYPHONE'" [class.text-ink-300]="paymentMethod()!=='PAYPHONE'"></i>
                  </button>
                } @else {
                  <div class="w-full p-5 rounded-xl border-2 border-dashed border-ink-200 dark:border-white/10
                              bg-ink-50 dark:bg-white/5 flex items-center gap-3 opacity-80 cursor-not-allowed">
                    <div class="w-12 h-12 rounded-lg bg-ink-300 dark:bg-white/10 text-white grid place-items-center shrink-0">
                      <i class="fa-solid fa-mobile-screen text-xl"></i>
                    </div>
                    <div class="flex-1">
                      <p class="font-bold text-ink-500 dark:text-white/50">
                        PayPhone
                        <span class="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700
                                     dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">Próximamente</span>
                      </p>
                      <p class="text-xs text-ink-400 dark:text-white/40">Tarjeta de crédito, débito o wallet — disponible pronto</p>
                    </div>
                    <i class="fa-solid fa-lock text-ink-300 dark:text-white/30"></i>
                  </div>
                }
              </div>

              @if (error()) {
                <div class="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
                </div>
              }
            </div>
          </form>

          <!-- Resumen -->
          <aside class="lg:sticky lg:top-24 self-start">
            <div class="editorial-card p-6">
              <h2 class="font-display font-bold text-xl mb-4 text-ink-950 dark:text-white">Tu orden</h2>

              <ul class="space-y-3 max-h-72 overflow-y-auto pb-3 border-b border-ink-200 dark:border-white/10">
                @for (l of cart.lines(); track l.variant_id) {
                  <li class="flex gap-2.5">
                    <div class="relative w-14 h-14 rounded-lg bg-ink-100 dark:bg-white/5 overflow-hidden shrink-0">
                      <img [src]="l.product_image" [alt]="l.product_name"
                           class="w-full h-full object-cover"
                           crossorigin="anonymous" (error)="onImgErr($event)" />
                      <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 text-[10px] font-bold grid place-items-center">
                        {{ l.quantity }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold truncate text-ink-950 dark:text-white">{{ l.product_name }}</p>
                      <p class="text-[10px] text-ink-500 dark:text-white/50 font-mono truncate">{{ l.size }} · {{ l.color }}</p>
                    </div>
                    <span class="text-xs font-bold text-ink-950 dark:text-white">\${{ (l.unit_price * l.quantity).toFixed(2) }}</span>
                  </li>
                }
              </ul>

              <!-- Cupón -->
              @if (!appliedCoupon()) {
                <div class="mt-4 flex gap-2">
                  <input [(ngModel)]="couponInput" placeholder="Código de cupón"
                         class="flex-1 px-3 py-2 rounded-lg bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-xs font-mono uppercase focus:outline-none" />
                  <button type="button" (click)="applyCoupon()" [disabled]="!couponInput || validating()"
                          class="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40">
                    @if (validating()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { Aplicar }
                  </button>
                </div>
                @if (couponError()) {
                  <p class="text-[10px] text-rose-600 mt-1"><i class="fa-solid fa-circle-exclamation"></i> {{ couponError() }}</p>
                }
              } @else {
                <div class="mt-4 flex items-center justify-between p-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-400/30">
                  <div>
                    <p class="text-[10px] uppercase tracking-widest text-violet-600 dark:text-violet-300 font-bold">Cupón</p>
                    <p class="font-mono text-xs font-bold text-violet-700 dark:text-violet-200">{{ appliedCoupon()!.code }}</p>
                  </div>
                  <button (click)="removeCoupon()" class="text-violet-600 hover:text-violet-800">
                    <i class="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
              }

              <div class="mt-4 pt-4 border-t border-ink-200 dark:border-white/10 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-ink-700 dark:text-white/70">Subtotal</span>
                  <span class="text-ink-950 dark:text-white font-semibold">\${{ cart.subtotal().toFixed(2) }}</span>
                </div>
                @if (discount() > 0) {
                  <div class="flex justify-between text-violet-600">
                    <span>Descuento</span>
                    <span>-\${{ discount().toFixed(2) }}</span>
                  </div>
                }
                <div class="flex justify-between pt-3 border-t border-ink-200 dark:border-white/10">
                  <span class="font-bold text-ink-950 dark:text-white">TOTAL</span>
                  <span class="font-display text-2xl font-bold text-ink-950 dark:text-white">
                    \${{ total().toFixed(2) }}
                  </span>
                </div>
              </div>

              <button type="button" (click)="payNow()" [disabled]="!canPay() || saving()"
                      class="w-full mt-5 btn-accent text-sm font-semibold py-4 disabled:opacity-50">
                @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Procesando... }
                @else if (paymentMethod()==='COD') {
                  <i class="fa-solid fa-bag-shopping"></i> Confirmar pedido · \${{ total().toFixed(2) }}
                } @else {
                  <i class="fa-solid fa-lock"></i> Pagar \${{ total().toFixed(2) }}
                }
              </button>

              <p class="text-[10px] text-ink-500 dark:text-white/40 mt-3 text-center">
                @if (paymentMethod()==='COD') {
                  Pagarás en efectivo al recibir tu pedido.
                } @else {
                  Serás redirigido a PayPhone para completar el pago.
                }
              </p>
            </div>
          </aside>
        </div>
      }
    </section>
  `,
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
  paymentMethod = signal<'PAYPHONE' | 'COD'>('COD');
  shippingAddress = '';
  shipLat = signal<number | null>(null);
  shipLng = signal<number | null>(null);
  locating = signal(false);
  private map: any = null;
  private marker: any = null;

  customer = { full_name: '', email: '', phone: '', document_id: '' };

  couponInput = '';
  appliedCoupon = signal<CouponValidation | null>(null);
  validating = signal(false);
  couponError = signal<string | null>(null);
  discount = signal(0);

  total = computed(() => Math.max(0, this.cart.subtotal() - this.discount()));

  /** Método (no computed): se reevalúa en cada ciclo de detección,
   *  así reacciona a los campos de cliente/sucursal que no son signals. */
  canPay(): boolean {
    return this.cart.lines().length > 0 && this.branchId !== null &&
      !!this.customer.full_name.trim() && !!this.customer.email.trim() &&
      !!this.customer.phone.trim() &&
      (this.fulfillment !== 'SHIPPING' || !!this.shippingAddress.trim());
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

  private initShipMap() {
    if (typeof document === 'undefined') return;
    this.ensureLeafletCss();
    const el = document.getElementById('dlx-ship-map');
    if (!el) return;
    if (this.map) { this.map.invalidateSize(); return; }
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
    // Recalcula el tamaño cuando el contenedor ya tiene dimensiones (evita el
    // mapa "a medias" cuando se renderiza dentro de un bloque que recién aparece).
    setTimeout(() => this.map && this.map.invalidateSize(), 250);
    setTimeout(() => this.map && this.map.invalidateSize(), 700);
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
    // Método por defecto: PayPhone si está configurado; si no, contra entrega.
    this.paymentMethod.set(this.branding.payphoneAvailable() ? 'PAYPHONE' : 'COD');
    // Carga las ciudades/sucursales de la zona; el effect cargará el paso 2.
    this.zone.load(false);
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
    if (this.paymentMethod() === 'COD') { this.placeCOD(); return; }
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

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
