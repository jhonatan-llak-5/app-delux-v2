/**
 * Compartir archivos con la hoja nativa del sistema (Web Share API nivel 2).
 *
 * En móvil (Android/Chrome, iOS/Safari) abre el selector nativo: WhatsApp,
 * Telegram, correo, AirDrop, etc. En escritorio casi ningún navegador soporta
 * compartir ARCHIVOS, así que se cae a un plan B honesto: se descarga el PDF y
 * se abre WhatsApp Web con el texto, para que el usuario adjunte el archivo
 * recién descargado.
 */

export interface ShareOptions {
  /** Título de la hoja de compartir. */
  title?: string;
  /** Texto que acompaña al archivo. */
  text?: string;
  /** Número de WhatsApp del plan B (solo dígitos, con código de país). */
  whatsapp?: string;
}

export type ShareResult = 'shared' | 'cancelled' | 'fallback' | 'unsupported';

/** ¿El navegador puede compartir ESTE archivo por la hoja nativa? */
export function canShareFile(file: File): boolean {
  const nav = navigator as any;
  return !!(nav?.canShare && nav.canShare({ files: [file] }) && nav.share);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openWhatsApp(text: string, phone?: string): void {
  const base = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}`
    : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank');
}

/**
 * Comparte un archivo. Devuelve qué pasó para que la UI avise al usuario:
 *  - 'shared'    -> se abrió la hoja nativa y el usuario compartió.
 *  - 'cancelled' -> se abrió y el usuario la cerró (NO es un error).
 *  - 'fallback'  -> sin soporte: se descargó el archivo y se abrió WhatsApp.
 */
export async function shareFile(
  blob: Blob, filename: string, opts: ShareOptions = {},
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });

  if (canShareFile(file)) {
    try {
      await (navigator as any).share({
        files: [file],
        title: opts.title,
        text: opts.text,
      });
      return 'shared';
    } catch (err: any) {
      // AbortError = el usuario cerró la hoja; no hay que hacer nada más.
      if (err?.name === 'AbortError') return 'cancelled';
      // Cualquier otro fallo (permisos, contexto no seguro): plan B.
    }
  }

  triggerDownload(blob, filename);
  if (opts.text || opts.whatsapp) {
    openWhatsApp(opts.text || opts.title || '', opts.whatsapp);
  }
  return 'fallback';
}

/** Comparte solo texto/enlace (sin archivo). Cae a WhatsApp si no hay soporte. */
export async function shareText(text: string, opts: ShareOptions = {}): Promise<ShareResult> {
  const nav = navigator as any;
  if (nav?.share) {
    try {
      await nav.share({ title: opts.title, text });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  openWhatsApp(text, opts.whatsapp);
  return 'fallback';
}
