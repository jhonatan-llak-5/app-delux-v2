import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '@core/services/branding.service';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';
import { shareFile } from '@shared/utils/share.util';
import { ExportColumn, PdfLogo, exportCsv, exportXlsx, exportPdf, pdfBlob } from '@shared/utils/export.util';

/**
 * Menú de exportación reutilizable (CSV / Excel / PDF / Compartir).
 *
 * Uso:
 *   <dlx-export-menu [columns]="cols" [rows]="visibleRows"
 *                    [loader]="fetchAll" filename="productos" title="Catálogo de productos" />
 *
 * - `rows`: datos ya cargados (fallback).
 * - `loader`: función opcional que trae TODOS los registros (respetando filtros,
 *   sin paginación). Si se define, tiene prioridad sobre `rows`.
 *
 * "Compartir PDF" va DENTRO del desplegable a propósito: así no suma ancho al
 * encabezado de cada página (que en móvil ya va justo) y aparece en los 11
 * módulos que exportan sin tocar ninguno.
 */
@Component({
  selector: 'dlx-export-menu',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canExport()) {
    <div class="relative inline-block">
      <button type="button" (click)="open.set(!open())" [disabled]="busy()"
              class="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-slate-300 dark:border-white/15
                     text-slate-700 dark:text-slate-200 text-sm font-semibold
                     hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50">
        @if (busy()) { <i class="fa-solid fa-spinner fa-spin"></i> }
        @else { <i class="fa-solid fa-file-export text-slate-400"></i> }
        Exportar
        <i class="fa-solid fa-chevron-down text-[10px]"></i>
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-30" (click)="open.set(false)"></div>
        <div class="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[#121826] shadow-xl
                    border border-slate-200 dark:border-white/10 overflow-hidden z-40">
          <button type="button" (click)="run('csv')"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 text-left">
            <i class="fa-solid fa-file-csv text-emerald-600 w-4"></i> CSV
          </button>
          <button type="button" (click)="run('xlsx')"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 text-left">
            <i class="fa-solid fa-file-excel text-green-600 w-4"></i> Excel (.xlsx)
          </button>
          <button type="button" (click)="run('pdf')"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 text-left">
            <i class="fa-solid fa-file-pdf text-rose-600 w-4"></i> PDF
          </button>
          @if (allowShare) {
            <div class="border-t border-slate-200 dark:border-white/10"></div>
            <button type="button" (click)="run('share')"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 text-left">
              <i class="fa-solid fa-share-nodes text-violet-600 w-4"></i> Compartir PDF
            </button>
          }
        </div>
      }
    </div>
    }
  `,
})
export class DlxExportMenuComponent {
  @Input({ required: true }) columns: ExportColumn<any>[] = [];
  @Input() rows: any[] = [];
  @Input() loader?: () => Promise<any[]>;
  @Input() filename = 'export';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() orientation: 'p' | 'l' = 'p';
  /**
   * Manejador PDF opcional. Si se define, la opción "PDF" delega en él (recibiendo
   * el logo ya cargado y el nombre de marca) en lugar de usar `exportPdf` genérico.
   * CSV/Excel siguen usando la utilidad compartida.
   */
  @Input() pdfHandler?: (o: { logo: PdfLogo | null; brandName: string }) => void | Promise<void>;
  /**
   * Devuelve el MISMO PDF de `pdfHandler` pero como Blob, para compartirlo.
   * Solo hace falta en páginas con PDF propio; si no se define, se comparte el
   * PDF genérico armado con `columns`.
   */
  @Input() pdfBlobHandler?: (o: { logo: PdfLogo | null; brandName: string }) => Blob | Promise<Blob>;
  /** Oculta la opción "Compartir PDF" si alguna página no la quiere. */
  @Input() allowShare = true;
  /** Texto que acompaña al archivo al compartirlo. */
  @Input() shareText = '';

  private branding = inject(BrandingService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  /** Exportar solo para superadmin, admin de tienda y gerente de sucursal. */
  readonly canExport = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'BRANCH_MANAGER';
  });
  open = signal(false);
  busy = signal(false);
  private logoCache: PdfLogo | null | undefined;

  async run(fmt: 'csv' | 'xlsx' | 'pdf' | 'share') {
    this.open.set(false);
    this.busy.set(true);
    try {
      const data = this.loader ? await this.loader() : this.rows;
      if (fmt === 'csv') { exportCsv(data, this.columns, this.filename); return; }
      if (fmt === 'xlsx') { exportXlsx(data, this.columns, this.filename); return; }

      const logo = await this.loadLogo();
      const brandName = this.branding.siteName();
      const opts = {
        title: this.title || this.filename, subtitle: this.subtitle,
        orientation: this.orientation, logo, brandName,
      };

      if (fmt === 'pdf') {
        if (this.pdfHandler) await this.pdfHandler({ logo, brandName });
        else exportPdf(data, this.columns, this.filename, opts);
        return;
      }

      // Compartir: se arma el mismo PDF pero en memoria.
      const blob = this.pdfBlobHandler
        ? await this.pdfBlobHandler({ logo, brandName })
        : pdfBlob(data, this.columns, opts);
      const result = await shareFile(blob, `${this.filename}.pdf`, {
        title: this.title || this.filename,
        text: this.shareText || `${this.title || this.filename} — ${brandName}`,
      });
      if (result === 'fallback') {
        this.notify.info('Tu navegador no comparte archivos', {
          description: 'Descargamos el PDF y abrimos WhatsApp: adjunta el archivo descargado.',
          duration: 7000,
        });
      }
    } catch {
      this.notify.error('No se pudo generar el archivo.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Carga el logo del app como dataURL escalado (máx. 16mm alto). Cachea el resultado. */
  private loadLogo(): Promise<PdfLogo | null> {
    if (this.logoCache !== undefined) return Promise.resolve(this.logoCache);
    const url = this.branding.logoUrl();
    if (!url) { this.logoCache = null; return Promise.resolve(null); }
    return new Promise<PdfLogo | null>(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const maxHmm = 14, maxWmm = 55;
          const ratio = img.naturalWidth / img.naturalHeight;
          let h = maxHmm, w = h * ratio;
          if (w > maxWmm) { w = maxWmm; h = w / ratio; }
          this.logoCache = { dataUrl, width: w, height: h, format: 'PNG' };
          resolve(this.logoCache);
        } catch { this.logoCache = null; resolve(null); }
      };
      img.onerror = () => { this.logoCache = null; resolve(null); };
      img.src = url;
    });
  }
}
