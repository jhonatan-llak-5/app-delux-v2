import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Soporte para LECTOR DE CÓDIGO DE BARRAS USB físico (pistola HID) — técnica
 * "keyboard wedge". El lector actúa como teclado: al leer un código "teclea"
 * los caracteres muy rápido (< ~30 ms entre teclas) y termina con Enter.
 *
 * Esta directiva escucha `document:keydown`, acumula los caracteres que llegan
 * en ráfaga y, al recibir Enter, si la secuencia fue rápida y suficientemente
 * larga, emite el código por `(scanned)`. El tecleo humano (lento) se ignora,
 * así que el buscador manual sigue funcionando igual.
 *
 * Uso:
 *   <div [dlxBarcodeScan] (scanned)="onBarcodeScanned($event)"> … </div>
 */
@Directive({
  selector: '[dlxBarcodeScan]',
  standalone: true,
})
export class BarcodeScanDirective {
  /** Largo mínimo del código para considerarlo un escaneo válido. */
  @Input() minLength = 3;
  /** Tolerancia máxima (ms) entre teclas para considerarlas parte de la ráfaga del lector. */
  @Input() interKeyMs = 40;
  /** Permite desactivar la captura sin quitar la directiva. */
  @Input() scanEnabled = true;

  /** Emite el código completo leído por el lector. */
  @Output() scanned = new EventEmitter<string>();

  /** Buffer de caracteres de la secuencia en curso. */
  private buffer = '';
  /** Timestamp de la última tecla acumulada. */
  private lastKeyAt = 0;
  /**
   * ¿La ráfaga actual proviene (probablemente) de un lector? Es true mientras
   * TODAS las teclas hayan llegado dentro de la ventana `interKeyMs`. El primer
   * carácter de una secuencia siempre arranca como "posible lector"; en cuanto
   * llega una tecla lenta se reinicia el buffer y vuelve a evaluarse.
   */
  private looksLikeScanner = false;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.scanEnabled) return;

    // Ignora combinaciones con modificadores (Ctrl/Alt/Meta): no forman parte
    // del "tecleo" de un lector, que solo envía caracteres simples + Enter.
    if (event.ctrlKey || event.altKey || event.metaKey) {
      this.reset();
      return;
    }

    // Si el foco está en un campo editable (el buscador, un input, etc.), NO
    // interferimos: dejamos que el lector "teclee" el código dentro del campo de
    // forma nativa (la búsqueda con debounce del input se dispara sola). La
    // captura global de esta directiva es solo para cuando NO hay un campo
    // enfocado (apuntar y disparar sin hacer clic en el buscador).
    if (this.isEditableTarget(event.target)) {
      this.reset();
      return;
    }

    const now = Date.now();
    const gap = now - this.lastKeyAt;

    if (event.key === 'Enter') {
      // Fin de secuencia. Solo la tratamos como escaneo si la ráfaga fue rápida
      // (looksLikeScanner) y el código tiene largo suficiente. El Enter final del
      // lector también llega dentro de la ventana respecto a la última tecla.
      const fastEnter = this.lastKeyAt !== 0 && gap <= this.interKeyMs;
      if (this.looksLikeScanner && fastEnter && this.buffer.length >= this.minLength) {
        const code = this.buffer;
        this.reset();
        // Evita que el Enter dispare submits del formulario / re-búsquedas.
        event.preventDefault();
        this.scanned.emit(code);
      } else {
        // Tecleo manual: dejamos pasar el Enter normal (no interferimos).
        this.reset();
      }
      return;
    }

    // Solo caracteres imprimibles (event.key de longitud 1). Teclas de control
    // (Shift, Tab, flechas, Backspace…) tienen key de longitud > 1: se ignoran
    // sin romper la ráfaga salvo que corten el ritmo.
    if (event.key.length !== 1) {
      return;
    }

    if (this.lastKeyAt === 0 || gap > this.interKeyMs) {
      // Nueva secuencia: primera tecla, o llegó demasiado tarde respecto a la
      // anterior (tecleo humano). Reiniciamos el buffer con esta tecla. El primer
      // carácter de cualquier secuencia se considera "posible lector": se
      // confirmará (o descartará) con las siguientes teclas y con el Enter final.
      this.buffer = event.key;
      this.looksLikeScanner = true;
    } else {
      // Tecla dentro de la ventana: sigue pareciendo lector.
      this.buffer += event.key;
    }
    this.lastKeyAt = now;
  }

  /** ¿El evento apunta a un campo editable (input/textarea/select o contentEditable)? */
  private isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
  }

  private reset(): void {
    this.buffer = '';
    this.lastKeyAt = 0;
    this.looksLikeScanner = false;
  }
}
