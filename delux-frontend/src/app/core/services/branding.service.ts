import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface BrandConfig {
  site_name?: string;
  platform_tagline?: string;
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
}

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
  readonly recaptchaSiteKey = computed(() => this._cfg()?.recaptcha_site_key || '');
  /** Tasa de IVA (%) configurada por el superadmin. Default 15. */
  readonly affiliateCommissionRate = computed(() => +(this._cfg()?.affiliate_commission_rate ?? 10) || 0);
  readonly affiliateMinPayout = computed(() => +(this._cfg()?.affiliate_min_payout ?? 0) || 0);
  readonly taxRate = computed(() => {
    const r = this._cfg()?.tax_rate;
    return r != null && !isNaN(+r) ? +r : 15;
  });

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
