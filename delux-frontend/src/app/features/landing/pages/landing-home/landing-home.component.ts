import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeroSectionComponent } from '@features/landing/components/hero-section/hero-section.component';
import { BrandsMarqueeComponent } from '@features/landing/components/brands-marquee/brands-marquee.component';
import { CategoriesGridComponent } from '@features/landing/components/categories-grid/categories-grid.component';
import { DropsSectionComponent } from '@features/landing/components/drops-section/drops-section.component';
import { BranchesSectionComponent } from '@features/landing/components/branches-section/branches-section.component';
import { BenefitsSectionComponent } from '@features/landing/components/benefits-section/benefits-section.component';
import { TestimonialsSectionComponent } from '@features/landing/components/testimonials-section/testimonials-section.component';
import { NewsletterSectionComponent } from '@features/landing/components/newsletter-section/newsletter-section.component';

@Component({
  selector: 'dlx-landing-home',
  standalone: true,
  imports: [
    HeroSectionComponent,
    BrandsMarqueeComponent,
    CategoriesGridComponent,
    DropsSectionComponent,
    BenefitsSectionComponent,
    BranchesSectionComponent,
    TestimonialsSectionComponent,
    NewsletterSectionComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dlx-hero-section />
    <dlx-brands-marquee />
    <dlx-categories-grid />
    <dlx-drops-section />
    <dlx-benefits-section />
    <dlx-branches-section />
    <dlx-testimonials-section />
    <dlx-newsletter-section />
  `
})
export class LandingHomeComponent {}
