import { Directive, HostListener } from '@angular/core';
import { onImageError } from '@shared/utils/img-placeholder';

/**
 * Reemplaza la imagen por el placeholder estándar cuando falla al cargar.
 * Centraliza la lógica que antes se duplicaba como `onImgErr`/`onImgError`.
 *
 *   <img [src]="url" dlxImgFallback />
 */
@Directive({
  selector: 'img[dlxImgFallback]',
  standalone: true,
})
export class ImgFallbackDirective {
  @HostListener('error', ['$event'])
  onError(ev: Event) { onImageError(ev); }
}
