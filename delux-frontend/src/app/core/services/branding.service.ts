import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface BrandConfig {
  site_name?: string;
  platform_tagline?: string;
  site_logo_url?: string | null;
  site_favicon_url?: string | null;
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
