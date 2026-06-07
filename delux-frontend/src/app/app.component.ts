import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'dlx-root',
  standalone: true,
  imports: [RouterOutlet, NgxSonnerToaster],
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
  `,
})
export class AppComponent implements OnInit {
  private tenant = inject(TenantService);
  theme = inject(ThemeService);

  ngOnInit() {
    this.tenant.load().subscribe({ error: () => {} });
  }
}
