import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Aplica la clase `is-visible` cuando el elemento entra al viewport.
 * Funciona con las clases CSS `.reveal` y `.reveal-stagger` definidas en styles.css.
 *
 * Uso:
 *   <section class="reveal" dlxReveal>...</section>
 *   <div class="reveal-stagger" dlxReveal>...children...</div>
 */
@Directive({
  selector: '[dlxReveal]',
  standalone: true,
})
export class RevealOnScrollDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      this.el.nativeElement.classList.add('is-visible');
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          this.observer?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
