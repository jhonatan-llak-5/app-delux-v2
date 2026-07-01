import { Injectable } from '@angular/core';

/**
 * Atribución de afiliados: captura el parámetro ?ref= de la URL y lo guarda
 * por 30 días. El checkout lo envía para atribuir la venta al afiliado
 * (modelo "last-click": el último enlace usado gana la comisión).
 */
@Injectable({ providedIn: 'root' })
export class RefService {
  private readonly KEY = 'dlx_ref';
  private readonly DAYS = 30;

  /** Lee ?ref= de la URL actual y lo persiste (si viene). */
  capture(): void {
    if (typeof window === 'undefined') return;
    const ref = (new URLSearchParams(window.location.search).get('ref') || '').trim();
    if (!ref) return;
    const exp = Date.now() + this.DAYS * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(this.KEY, JSON.stringify({ ref, exp })); } catch {}
  }

  /** Devuelve el código de afiliado vigente (o '' si no hay o expiró). */
  currentRef(): string {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return '';
      const { ref, exp } = JSON.parse(raw);
      if (!ref || Date.now() > exp) { localStorage.removeItem(this.KEY); return ''; }
      return ref;
    } catch { return ''; }
  }

  clear(): void {
    if (typeof window !== 'undefined') { try { localStorage.removeItem(this.KEY); } catch {} }
  }
}
