import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicNavbarComponent } from '@features/landing/components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '@features/landing/components/public-footer/public-footer.component';
import { SplashIntroComponent } from '@shared/components/splash-intro/splash-intro.component';
import { ZonePickerComponent } from '@shared/components/zone-picker/zone-picker.component';
import { ZoneService } from '@shared/services/zone.service';

@Component({
  selector: 'dlx-public-layout',
  standalone: true,
  imports: [RouterOutlet, PublicNavbarComponent, PublicFooterComponent, SplashIntroComponent, ZonePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-splash-intro />
    <div class="min-h-screen flex flex-col
                bg-white dark:bg-ink-950
                text-ink-900 dark:text-white
                transition-colors duration-500">
      <dlx-public-navbar />
      <main class="flex-1"><router-outlet /></main>
      <dlx-public-footer />
    </div>
    <dlx-zone-picker />
  `,
})
export class PublicLayoutComponent implements OnInit {
  private zone = inject(ZoneService);
  ngOnInit(): void { this.zone.load(); }
}
