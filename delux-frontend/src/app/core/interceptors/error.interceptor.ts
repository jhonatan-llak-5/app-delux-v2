import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';

/**
 * errorInterceptor:
 *  - 0 (sin conexión) y 5xx (error del servidor) => toast de error (software).
 *  - 401 => limpia el token expirado y redirige a login solo si había sesión
 *    y la ruta es protegida (no pública).
 *  - 4xx (validación) los maneja cada formulario mostrando el error por campo.
 */
const PUBLIC_PREFIXES = ['/', '/shop', '/product', '/contact', '/cart',
                         '/tracking', '/auth', '/checkout'];

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0];
  return PUBLIC_PREFIXES.some(p => p === path || path.startsWith(p + '/') || (p === '/' && path === ''));
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const notify = inject(NotifyService);
  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 0) {
        notify.error('Sin conexión con el servidor. Revisa tu internet.');
      } else if (err?.status >= 500) {
        const { message } = parseApiError(err);
        notify.error(message || 'Ocurrió un error en el servidor. Inténtalo más tarde.');
      }

      if (err?.status === 401) {
        const hadSession =
          typeof window !== 'undefined' && !!localStorage.getItem('dlx_access_token');
        const onPublic = isPublicRoute(router.url);

        if (hadSession && typeof window !== 'undefined') {
          localStorage.removeItem('dlx_access_token');
          localStorage.removeItem('dlx_refresh_token');
        }
        if (hadSession && !onPublic) {
          router.navigate(['/auth/login']);
        }
      }
      return throwError(() => err);
    })
  );
};
