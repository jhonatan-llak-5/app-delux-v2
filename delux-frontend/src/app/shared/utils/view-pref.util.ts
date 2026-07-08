export type ViewMode = 'grid' | 'table';

/** Lee la preferencia de vista guardada por cuenta (localStorage). */
export function readViewPref(key: string, userId: number | string | null | undefined): ViewMode {
  try {
    const v = localStorage.getItem(`${key}::${userId ?? 'anon'}`);
    return v === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Guarda la preferencia de vista por cuenta (localStorage). */
export function writeViewPref(key: string, userId: number | string | null | undefined, mode: ViewMode): void {
  try {
    localStorage.setItem(`${key}::${userId ?? 'anon'}`, mode);
  } catch { /* almacenamiento no disponible */ }
}
