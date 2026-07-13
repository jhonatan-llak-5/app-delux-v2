import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Anima un número contando desde 0 hasta el valor objetivo cuando entra al
 * viewport. Conserva prefijos/sufijos como "+" o "k" (ej: "+50k").
 * Uso: <p [dlxCountUp]="'+50k'"></p>
 */
@Directive({
  selector: '[dlxCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnInit, OnDestroy {
  @Input('dlxCountUp') target = '';
  private el = inject(ElementRef<HTMLElement>);
  private obs?: IntersectionObserver;
  private done = false;

  ngOnInit(): void {
    const raw = (this.target || '').trim();
    const m = /^(\D*)(\d+)(\D*)$/.exec(raw);
    if (!m || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.textContent = raw;
      return;
    }
    const pre = m[1], target = parseInt(m[2], 10), suf = m[3];
    this.el.nativeElement.textContent = pre + '0' + suf;
    this.obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !this.done) {
          this.done = true;
          this.animate(pre, target, suf);
          this.obs?.disconnect();
        }
      });
    }, { threshold: 0.4 });
    this.obs.observe(this.el.nativeElement);
  }

  private animate(pre: string, target: number, suf: string): void {
    const dur = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      this.el.nativeElement.textContent = pre + Math.round(eased * target) + suf;
      if (p < 1) requestAnimationFrame(tick);
      else this.el.nativeElement.textContent = pre + target + suf;
    };
    requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.obs?.disconnect();
  }
}
