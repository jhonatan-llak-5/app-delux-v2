import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';

/**
 * Landing minimal — solo hero (banner principal).
 * El navbar y footer los aporta public-layout.
 */
@Component({
  selector: 'dlx-landing-home',
  standalone: true,
  imports: [HeroSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dlx-hero-section />`,
})
export class LandingHomeComponent {}
