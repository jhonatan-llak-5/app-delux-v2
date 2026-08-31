import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotifyService } from '@shared/services/notify.service';
import { ShareResult, shareFile } from '@shared/utils/share.util';

/**
 * Botón "Compartir" con la hoja nativa del sistema (WhatsApp, Telegram, correo…).
 *
 * En móvil abre el selector nativo con el archivo adjunto. En escritorio, donde
 * los navegadores no soportan compartir archivos, descarga el PDF y abre
 * WhatsApp Web con el mensaje para que el usuario lo adjunte — y se lo avisa,
 * en vez de fallar en silencio.
 *
 * <dlx-share-button [blobFactory]="pdfBlob" filename="arqueo.pdf"
 *                   shareTitle="Arqueo de caja" [text]="'Cierre de caja...'" />
 */
@Component({
  selector: 'dlx-share-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="run()" [disabled]="busy() || !blobFactory"
            [class]="btnClass" [title]="label">
      @if (busy()) { <i class="fa-solid fa-spinner fa-spin"></i> }
      @else { <i class="fa-solid fa-share-nodes"></i> }
      @if (!iconOnly) { {{ label }} }
    </button>
  `,
})
export class DlxShareButtonComponent {
  /** Devuelve el archivo a compartir (se genera al pulsar, no antes). */
  @Input({ required: true }) blobFactory!: () => Blob | Promise<Blob>;
  @Input() filename = 'documento.pdf';
  /** Título de la hoja de compartir. */
  @Input() shareTitle = '';
  /** Texto que acompaña al archivo. */
  @Input() text = '';
  /** Teléfono destino del plan B de WhatsApp (opcional). */
  @Input() whatsapp = '';
  @Input() label = 'Compartir';
  @Input() iconOnly = false;
  @Input() btnClass = 'eg-btn-secondary';
  @Output() shared = new EventEmitter<ShareResult>();

  private notify = inject(NotifyService);
  busy = signal(false);

  async run(): Promise<void> {
    if (this.busy() || !this.blobFactory) return;
    this.busy.set(true);
    try {
      const blob = await this.blobFactory();
      const result = await shareFile(blob, this.filename, {
        title: this.shareTitle || this.label,
        text: this.text,
        whatsapp: this.whatsapp,
      });
      if (result === 'fallback') {
        this.notify.info('Tu navegador no comparte archivos', {
          description: 'Descargamos el PDF y abrimos WhatsApp: adjunta el archivo descargado.',
          duration: 7000,
        });
      }
      this.shared.emit(result);
    } catch {
      this.notify.error('No se pudo preparar el archivo para compartir.');
    } finally {
      this.busy.set(false);
    }
  }
}
