import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface BrandConfig {
  site_name?: string;
  platform_tagline?: string;
  // Datos del negocio (emisor) para el comprobante impreso.
  business_legal_name?: string;
  business_ruc?: string;
  business_address?: string;
  business_phone?: string;
  site_logo_url?: string | null;
  site_favicon_url?: string | null;
  affiliate_commission_rate?: number;
  affiliate_min_payout?: number;
  payphone_available?: boolean;
  cod_enabled?: boolean;
  recaptcha_site_key?: string;
  tax_rate?: number;
  // Transferencia bancaria
  transfer_enabled?: boolean;
  bank_name?: string;
  bank_account_type?: string;
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_account_document?: string;
  bank_contact_email?: string;
  bank_contact_whatsapp?: string;
  transfer_instructions?: string;
  // DE UNA
  deuna_enabled?: boolean;
  deuna_qr_url?: string | null;
  deuna_instructions?: string;
  // Tienda en línea
  pickup_enabled?: boolean;
  delivery_enabled?: boolean;
  out_of_stock_display?: 'SHOW' | 'HIDE' | 'SOLD_OUT';
  // Contacto público + redes
  contact_email?: string;
  whatsapp_contact_number?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_youtube?: string;
  social_x?: string;
  social_tiktok?: string;
  social_telegram?: string;
}

export interface SocialLink { key: string; label: string; icon: string; url: string; }

export interface BankData {
  bank_name: string;
  account_type: string;
  account_holder: string;
  account_number: string;
  account_document: string;
  contact_email: string;
  contact_whatsapp: string;
  instructions: string;
}

/**
 * Carga el branding (nombre, logo, favicon) configurado por el superadmin
 * y lo aplica en toda la app: navbar, sidebar y el favicon del navegador.
 * Fuente: GET /admin/settings/public-config/ (público).
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);

  private _cfg = signal<BrandConfig | null>(null);

  /** Logo horizontal por defecto (empaquetado). Se usa si no se subió uno en Ajustes. */
  private readonly defaultLogo = 'assets/images/brand-logo.png';
  private readonly defaultLogoDark = 'assets/images/brand-logo-dark.png';

  readonly siteName = computed(() => this._cfg()?.site_name || 'Delux');
  readonly tagline = computed(() => this._cfg()?.platform_tagline || '');
  readonly logoUrl = computed(() => this._cfg()?.site_logo_url || this.defaultLogo);
  /** Variante para fondos oscuros (texto claro). Si hay logo subido, se usa el mismo. */
  readonly logoUrlDark = computed(() => this._cfg()?.site_logo_url || this.defaultLogoDark);
  readonly faviconUrl = computed(() => this._cfg()?.site_favicon_url || null);
  /** Métodos de pago disponibles (según config del superadmin). */
  readonly payphoneAvailable = computed(() => this._cfg()?.payphone_available === true);
  readonly codEnabled = computed(() => this._cfg()?.cod_enabled !== false);
  /** Transferencia bancaria disponible (habilitada + al menos banco y cuenta). */
  readonly transferEnabled = computed(() => {
    const c = this._cfg();
    return c?.transfer_enabled === true && !!(c?.bank_name && c?.bank_account_number);
  });
  readonly bankData = computed<BankData>(() => {
    const c = this._cfg();
    return {
      bank_name: c?.bank_name || '',
      account_type: c?.bank_account_type || '',
      account_holder: c?.bank_account_holder || '',
      account_number: c?.bank_account_number || '',
      account_document: c?.bank_account_document || '',
      contact_email: c?.bank_contact_email || '',
      contact_whatsapp: c?.bank_contact_whatsapp || '',
      instructions: c?.transfer_instructions || '',
    };
  });
  /** DE UNA disponible (habilitado + QR subido). */
  readonly deunaEnabled = computed(() =>
    this._cfg()?.deuna_enabled === true && !!this._cfg()?.deuna_qr_url);
  readonly deunaQrUrl = computed(() => this._cfg()?.deuna_qr_url || null);
  readonly deunaInstructions = computed(() => this._cfg()?.deuna_instructions || '');
  /** Métodos de entrega habilitados (por defecto true si no viene). */
  readonly pickupEnabled = computed(() => this._cfg()?.pickup_enabled !== false);
  readonly deliveryEnabled = computed(() => this._cfg()?.delivery_enabled !== false);
  /** Cómo mostrar productos sin stock: SHOW | HIDE | SOLD_OUT. */
  readonly outOfStockDisplay = computed(() => this._cfg()?.out_of_stock_display || 'SHOW');
  readonly recaptchaSiteKey = computed(() => this._cfg()?.recaptcha_site_key || '');

  // ─── Contacto público ───
  readonly contactEmail = computed(() => this._cfg()?.contact_email || '');
  readonly whatsappNumber = computed(() => this._cfg()?.whatsapp_contact_number || '');
  /** Enlace wa.me a partir del número (solo dígitos). Vacío si no hay número. */
  readonly whatsappLink = computed(() => {
    const n = (this._cfg()?.whatsapp_contact_number || '').replace(/[^0-9]/g, '');
    return n ? `https://wa.me/${n}` : '';
  });

  /** Redes sociales configuradas (solo las que tienen URL). */
  readonly socialLinks = computed<SocialLink[]>(() => {
    const c = this._cfg();
    const defs: SocialLink[] = [
      { key: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', url: c?.social_instagram || '' },
      { key: 'tiktok',    label: 'TikTok',    icon: 'fa-brands fa-tiktok',    url: c?.social_tiktok || '' },
      { key: 'x',         label: 'X',         icon: 'fa-brands fa-x-twitter', url: c?.social_x || '' },
      { key: 'facebook',  label: 'Facebook',  icon: 'fa-brands fa-facebook',  url: c?.social_facebook || '' },
      { key: 'youtube',   label: 'YouTube',   icon: 'fa-brands fa-youtube',   url: c?.social_youtube || '' },
      { key: 'telegram',  label: 'Telegram',  icon: 'fa-brands fa-telegram',  url: c?.social_telegram || '' },
    ];
    return defs.filter(s => !!s.url.trim());
  });
  /** Tasa de IVA (%) configurada por el superadmin. Default 15. */
  readonly affiliateCommissionRate = computed(() => +(this._cfg()?.affiliate_commission_rate ?? 10) || 0);
  readonly affiliateMinPayout = computed(() => +(this._cfg()?.affiliate_min_payout ?? 0) || 0);
  readonly taxRate = computed(() => {
    const r = this._cfg()?.tax_rate;
    return r != null && !isNaN(+r) ? +r : 15;
  });

  // ─── Datos del negocio (emisor) para el comprobante impreso ───
  readonly businessLegalName = computed(() => this._cfg()?.business_legal_name || '');
  readonly businessRuc = computed(() => this._cfg()?.business_ruc || '');
  readonly businessAddress = computed(() => this._cfg()?.business_address || '');
  readonly businessPhone = computed(() => this._cfg()?.business_phone || '');

  /** Datos del emisor para el encabezado del comprobante de venta impreso. */
  receiptBusiness() {
    return {
      tradeName: this.siteName(),
      legalName: this.businessLegalName(),
      ruc: this.businessRuc(),
      address: this.businessAddress(),
      phone: this.businessPhone(),
      taxRate: this.taxRate(),
    };
  }

  /** Llamar una vez al iniciar la app. */
  load(): void {
    this.http.get<BrandConfig>(`${environment.apiUrl}/admin/settings/public-config/`)
      .subscribe({
        next: cfg => { this._cfg.set(cfg); this.applyFavicon(cfg.site_favicon_url || null); },
        error: () => {},
      });
  }

  private applyFavicon(url: string | null): void {
    if (!url || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}
