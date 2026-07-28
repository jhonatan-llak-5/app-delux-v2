import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Botón + modal de escaneo de código de barras con la cámara (BarcodeDetector).
 * Reutilizable: emite el código leído por (scanned).
 *
 * Uso: <dlx-scan-button (scanned)="onScan($event)" />
 */
@Component({
  selector: 'dlx-scan-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="open()" [title]="label"
            class="shrink-0 h-11 px-3 rounded-xl border border-[var(--dash-primary)] text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/5 font-semibold text-sm inline-flex items-center gap-2">
      <i class="fa-solid fa-barcode"></i><span class="hidden sm:inline">{{ label }}</span>
    </button>

    @if (cameraOn()) {
      <div class="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
        <div class="w-full max-w-lg">
          <div class="flex items-center justify-between mb-3 text-white">
            <span class="font-semibold inline-flex items-center gap-2"><i class="fa-solid fa-barcode"></i> Escanear código</span>
            <button type="button" (click)="close()" class="w-9 h-9 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20"><i class="fa-solid fa-xmark"></i></button>
          </div>
          @if (camError()) {
            <div class="rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-3 text-sm">{{ camError() }}</div>
          } @else {
            <div class="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video #camVideo playsinline class="w-full h-full object-cover"></video>
              <div class="absolute inset-0 pointer-events-none">
                <div class="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-24 border-2 border-[var(--dash-primary)] rounded-xl"></div>
              </div>
            </div>
            <p class="text-center text-white/60 text-xs mt-3">Apunta al código de barras del producto.</p>
          }
        </div>
      </div>
    }
  `,
})
export class DlxScanButtonComponent implements OnDestroy {
  @Input() label = 'Escanear';
  @Output() scanned = new EventEmitter<string>();
  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;

  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private camStream?: MediaStream;
  private detector: any;
  private rafId: number | null = null;
  private lastScan = '';
  private lastScanAt = 0;

  async open(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta cámara para escanear. Usa una pistola lectora o escribe el código.');
      this.cameraOn.set(true);
      return;
    }
    try {
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara (requiere HTTPS y permiso).');
      this.cameraOn.set(true);
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.camVideo?.nativeElement;
      if (v && this.camStream) { v.srcObject = this.camStream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.camVideo?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) this.onCode(codes[0].rawValue || '');
    } catch { /* frame sin código */ }
    if (this.cameraOn()) this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  private onCode(raw: string): void {
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (!code) return;
    const now = Date.now();
    if (code === this.lastScan && now - this.lastScanAt < 2500) return;
    this.lastScan = code; this.lastScanAt = now;
    this.scanned.emit(code);
    this.close();
  }

  close(): void {
    this.cameraOn.set(false);
    this.camError.set(null);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.camStream?.getTracks().forEach(t => t.stop());
    this.camStream = undefined;
  }

  ngOnDestroy(): void { this.close(); }
}
