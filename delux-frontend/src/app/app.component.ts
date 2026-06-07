import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';

@Component({
  selector: 'dlx-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  private tenant = inject(TenantService);

  ngOnInit() {
    this.tenant.load().subscribe({ error: () => {} });
  }
}
