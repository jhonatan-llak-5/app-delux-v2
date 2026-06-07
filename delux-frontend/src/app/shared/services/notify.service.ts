import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';

/**
 * NotifyService — wrapper sobre ngx-sonner para toasts efímeros.
 *
 *   notify.success('Agregado al carrito')
 *   notify.error('No se pudo cargar el producto')
 *   notify.warning('Stock limitado')
 *   notify.info('Tu pedido está en camino')
 *   notify.message('Sesión iniciada', { description: 'Bienvenido, Yessi' })
 *
 * Para alertas persistentes / modales de confirmación usa <dlx-alert>.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  success(title: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return toast.success(title, opts);
  }
  error(title: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return toast.error(title, opts);
  }
  warning(title: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return toast.warning(title, opts);
  }
  info(title: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return toast.info(title, opts);
  }
  message(title: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return toast(title, opts);
  }
  loading(title: string, opts?: { description?: string }) {
    return toast.loading(title, opts);
  }
  dismiss(id?: string | number) {
    toast.dismiss(id);
  }

  /** Helper para mensajes de error de servidor (HttpErrorResponse) */
  fromServerError(err: any, fallback = 'Algo salió mal. Intenta de nuevo.') {
    const msg = err?.error?.detail
             || err?.error?.message
             || (typeof err?.error === 'string' ? err.error : null)
             || err?.message
             || fallback;
    return this.error(msg);
  }
}
