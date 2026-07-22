import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { KioskService, KioskProduct, KioskSearchItem, KioskFeatured } from './kiosk.service';
import { KioskResultCardComponent } from './components/kiosk-result-card.component';
import { BrandingService } from '@core/services/branding.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'dlx-kiosk',
  standalone: true,
  imports: [ImgFallbackDirective, CommonModule, FormsModule, RouterLink, KioskResultCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kiosk.component.html',
})
export class KioskComponent implements OnInit, OnDestroy {
  private svc = inject(KioskService);
  private route = inject(ActivatedRoute);
  branding = inject(BrandingService);
  theme = inject(ThemeService);

  token = signal<string | null>(null);
  branchName = signal<string | null>(null);
  locked = signal(false);
  notFound = signal(false);
  pinError = signal<string | null>(null);
  pin = '';
  private pendingCode: string | null = null;

  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  query = '';
  loading = signal(false);
  searched = signal(false);
  results = signal<KioskSearchItem[]>([]);
  detail = signal<KioskProduct | null>(null);
  featured = signal<KioskFeatured[]>([]);
  slide = signal(0);
  expanded = signal(false);
  searchOpen = signal(false);
  private searchTimer: any = null;
  lightboxOpen = signal(false);
  lightboxImages = signal<string[]>([]);
  lightboxIndex = signal(0);
  lbZoom = signal(false);
  lbOrigin = signal('50% 50%');
  private attractTimer: any = null;

  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    this.token.set(token);
    this.pendingCode = this.route.snapshot.queryParamMap.get('code');
    if (!token) {
      // El kiosko solo es accesible por su enlace con token de sucursal.
      this.notFound.set(true);
      return;
    }
    this.svc.info(token).subscribe({
      next: (i) => {
        if (!i.found) { this.notFound.set(true); return; }
        this.branchName.set(i.branch_name || null);
        const unlocked = typeof window !== 'undefined' && sessionStorage.getItem('dlx_kiosk_' + token) === '1';
        if (i.pin_required && !unlocked) this.locked.set(true);
        else this.afterUnlock();
      },
      error: () => this.notFound.set(true),
    });
    this.svc.featured().subscribe({
      next: (r) => { this.featured.set(r.results); this.startAttract(); },
      error: () => {},
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.fsHandler);
    }
  }

  private startAttract(): void {
    if (this.attractTimer) clearInterval(this.attractTimer);
    if (this.featured().length < 2) return;
    this.attractTimer = setInterval(() => {
         this.slide.update(i => (i + 1) % Math.max(this.featured().length, 1));
    }, 4500);
  }

  showAttract(): boolean {
    return !this.locked() && !this.detail() && this.results().length === 0
      && !this.loading() && !this.cameraOn() && this.query.trim() === ''
      && this.featured().length > 0;
  }

  private afterUnlock(): void {
    if (this.pendingCode) { this.lookup(this.pendingCode); this.pendingCode = null; }
  }

  unlock(): void {
    const t = this.token();
    if (!t) return;
    this.svc.unlock(t, this.pin).subscribe({
      next: () => {
        if (typeof window !== 'undefined') sessionStorage.setItem('dlx_kiosk_' + t, '1');
        this.locked.set(false); this.pin = ''; this.pinError.set(null);
        this.afterUnlock();
      },
      error: () => this.pinError.set('PIN incorrecto.'),
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.attractTimer) clearInterval(this.attractTimer);
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', this.fsHandler);
  }

  doSearch(): void {
    const q = this.query.trim();
    if (!q) return;
    this.detail.set(null);
    this.loading.set(true);
    this.searched.set(true);
    this.svc.search(q, this.token() || undefined).subscribe({
      next: (r) => { this.results.set(r.results); this.loading.set(false); },
      error: () => { this.results.set([]); this.loading.set(false); },
    });
  }

  lookup(code: string): void {
    this.results.set([]);
    this.loading.set(true);
    this.svc.product({ code, token: this.token() || undefined }).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: () => { this.detail.set({ found: false, code }); this.loading.set(false); },
    });
  }

  loadById(id: number): void {
    this.loading.set(true);
    this.svc.product({ id, token: this.token() || undefined }).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clear(): void {
    this.detail.set(null);
    this.results.set([]);
    this.query = '';
    this.searched.set(false);
  }
  goHome(): void {
    this.clear();
    this.closeSearch();
    this.camError.set(null);
    if (this.cameraOn()) this.stopCamera();
    this.slide.set(0);
    this.startAttract();
  }

  money(v: string | number | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return '$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
  }
  pad2(n: number): string { return String(n).padStart(2, '0'); }
  private fsHandler = () => {
    const fs = typeof document !== 'undefined' && !!document.fullscreenElement;
    this.expanded.set(fs);
  };
  toggleExpand(): void {
    const goingFs = !this.expanded();
    this.expanded.set(goingFs);
    if (typeof document === 'undefined') return;
    try {
      if (goingFs) {
        const el: any = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
      } else if (document.fullscreenElement) {
        (document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen)?.call(document);
      }
    } catch { /* fullscreen no disponible: queda el maximizado por CSS */ }
  }
  openSearch(): void { this.searchOpen.set(true); }
  closeSearch(): void { this.searchOpen.set(false); }
  // ── Carrusel ──
  nextSlide(): void { const n = this.featured().length; if (n) this.slide.update(i => (i + 1) % n); }
  prevSlide(): void { const n = this.featured().length; if (n) this.slide.update(i => (i - 1 + n) % n); }
  goToSlide(i: number): void { this.slide.set(i); }
  // ── Galería / lightbox ──
  galleryImages(d: KioskProduct): string[] {
    if (d.images && d.images.length) return d.images;
    return d.image ? [d.image] : [];
  }
  openLightbox(images: string[], start = 0): void {
    if (!images.length) return;
    this.lightboxImages.set(images);
    this.lightboxIndex.set(start);
    this.lbZoom.set(false);
    this.lightboxOpen.set(true);
  }
  closeLightbox(): void { this.lightboxOpen.set(false); this.lbZoom.set(false); }
  lbNext(): void { const n = this.lightboxImages().length; if (n) { this.lightboxIndex.update(i => (i + 1) % n); this.lbZoom.set(false); this.lbOrigin.set('50% 50%'); } }
  lbPrev(): void { const n = this.lightboxImages().length; if (n) { this.lightboxIndex.update(i => (i - 1 + n) % n); this.lbZoom.set(false); this.lbOrigin.set('50% 50%'); } }
  lbGo(i: number): void { this.lightboxIndex.set(i); this.lbZoom.set(false); }
  lbZoomToggle(): void { this.lbZoom.update(v => !v); }
  onZoomMove(ev: MouseEvent): void {
    const el = ev.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
    this.lbOrigin.set(x + '% ' + y + '%');
    this.lbZoom.set(true);
  }
  onZoomLeave(): void { this.lbZoom.set(false); }
  onSearchType(v: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = (v || '').trim();
    if (q.length < 2) { return; }
    this.searchTimer = setTimeout(() => this.doSearch(), 300);
  }
  /** Precio final con IVA para mostrar al público. */
  withIva(v: string | number | undefined): number {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return +n || 0;  // el precio ya incluye IVA
  }
  taxRate(): number { return +this.branding.taxRate() || 0; }

  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta escaneo por cámara. Usa la búsqueda por texto (o prueba Chrome en Android).');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara. Revisa permisos (el sitio debe estar en HTTPS).');
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.videoRef?.nativeElement;
      if (v && this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.videoRef?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) { this.onCode(codes[0].rawValue || ''); return; }
    } catch { /* frame sin código */ }
    this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  private onCode(raw: string): void {
    this.stopCamera();
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (code) this.lookup(code);
  }
}
