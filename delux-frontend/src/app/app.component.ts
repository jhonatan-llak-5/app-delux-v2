import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  ngOnInit() {
    this.tenant.load().subscribe({ error: () => {} });
    this.fileValidator.loadConfig();
    this.branding.load();
    this.ref.capture();  // Atribución de afiliado (?ref=)
  }
}
