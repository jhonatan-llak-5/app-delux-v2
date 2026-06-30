/**
 * Imagen por defecto (la misma que usa la tienda en línea) para productos sin
 * foto o cuya imagen falla al cargar. Es un SVG inline (no requiere red).
 */
export const IMG_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<g fill="none" stroke="#9aa0ab" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">' +
      '<rect x="32" y="44" width="56" height="40" rx="6"/>' +
      '<circle cx="60" cy="64" r="11"/>' +
      '<path d="M44 44l5-9h22l5 9"/>' +
      '</g></svg>',
  );

/** Devuelve la URL dada o el placeholder si está vacía. */
export function imgOrPlaceholder(url?: string | null): string {
  return url && url.trim() ? url : IMG_PLACEHOLDER;
}

/** Handler de (error) en <img>: cambia a placeholder una sola vez. */
export function onImageError(ev: Event): void {
  const img = ev.target as HTMLImageElement;
  if (img.dataset['ph'] === '1') return;
  img.dataset['ph'] = '1';
  img.src = IMG_PLACEHOLDER;
  img.classList.add('object-contain', 'opacity-70');
  img.classList.remove('object-cover');
}
