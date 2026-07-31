import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgxSonnerToaster } from 'ngx-sonner';
import { ConfirmHostComponent } from '@shared/components/confirm/confirm-host.component';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';
import { RefService } from '@core/services/ref.service';
import { FileValidatorService } from '@shared/services/file-validator.service';
import { BrandingService } from '@core/services/branding.service';

@Component({
  selector: 'dlx-root',
  standalone: true,
  imports: [RouterOutlet, NgxSonnerToaster, ConfirmHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <ngx-sonner-toaster
      position="top-right"
      [theme]="theme.isDark() ? 'dark' : 'light'"
      [richColors]="true"
      [closeButton]="true"
      [expand]="false"
      [duration]="4000" />
    <dlx-confirm-host />
  `,
})
export class AppComponent implements OnInit {
  private tenant = inject(TenantService);
  private fileValidator = inject(FileValidatorService);
  private branding = inject(BrandingService);
  theme = inject(ThemeService);
  private ref = inject(RefService);
  private router = inject(Router);

  /** URL actual, actualizada en cada NavigationEnd (fuente reactiva del forzado). */
  private currentUrl = signal(this.router.url);

  constructor() {
    // Forzado de tema reactivo: depende de la URL actual y de la preferencia de tienda.
    // - /app y /kiosko: respetan la preferencia del usuario (tema del dashboard).
    // - Rutas de compra (shop/product/cart/checkout/auth): respetan la preferencia de tienda.
    // - Resto de páginas públicas (marketing/legales/inicio): siempre claro.
    effect(() => {
      const url = this.currentUrl();
      const shopMode = this.theme.shopMode();
      if (url.startsWith('/app') || url.startsWith('/kiosko')) {
        this.theme.force(null);
      } else if (this.isShopUrl(url)) {
        this.theme.force(shopMode);
      } else {
        this.theme.force('light');
      }
    }, { allowSignalWrites: true });
  }

  private isShopUrl(url: string): boolean {
    return url.startsWith('/shop')
      || url.startsWith('/product')
      || url.startsWith('/cart')
      || url.startsWith('/checkout')
      || url.startsWith('/auth');
  }

  ngOnInit() {
    this.tenant.load().subscribe({ error: () => {} });
    this.fileValidator.loadConfig();
    this.branding.load();
    this.ref.capture();  // Atribución de afiliado (?ref=)

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.currentUrl.set(e.urlAfterRedirects));
  }
}
